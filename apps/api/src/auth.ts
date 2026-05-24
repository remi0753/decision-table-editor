import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { magicLink } from 'better-auth/plugins';
import { and, eq, gt, isNull } from 'drizzle-orm';
import type { Database } from './db/client.js';
import { invitation, user as userTable } from './db/schema.js';
import { sendMagicLinkEmail, sendVerificationEmail } from './email.js';
import type { SecondaryStorage } from './secondaryStorage.js';

type AuthConfig = {
  baseURL: string;
  secret: string;
  trustedOrigins: string[];
  googleClientId?: string;
  googleClientSecret?: string;
  resendApiKey?: string;
  emailFrom?: string;
  // Required in production: backs Better Auth's rate-limit counters across
  // Workers isolates. Without it, the auth router falls back to in-isolate
  // memory and rate limiting is effectively defeated by horizontal fan-out.
  secondaryStorage?: SecondaryStorage;
};

const generateDatabaseId = ({ model }: { model: string }) => {
  if (model === 'user') return false;
  return crypto.randomUUID();
};

const emailVerifiedToTimestamp = (value: unknown) => {
  if (value instanceof Date) return value;
  if (value === true) return new Date();
  return null;
};

// Better Auth core treats `emailVerified` as boolean; our DB column is a
// nullable timestamp. We declare the additionalField as type:'date' so the
// Drizzle adapter persists/reads a real Date — but we return that Date (or
// null) verbatim from output so the Drizzle adapter's customTransformOutput
// (which wraps any non-null date value in `new Date(...)`) does not coerce
// a coerced boolean back into `new Date(false)` === epoch. Better Auth's
// `if (user.emailVerified)` checks remain correct because a Date is truthy
// and null is falsy.
const emailVerifiedFromTimestamp = (value: unknown) => {
  if (value instanceof Date) return value;
  return null;
};

// Per-request Better Auth instance. Same rationale as createDb() — request
// isolation in Workers means each invocation gets its own auth handler. Cost
// is trivial; this is a thin wrapper around the Drizzle adapter.
//
// Better Auth exposes `emailVerified` as a boolean, while the production schema
// stores the verification instant in `email_verified_at`. The field override
// below keeps the auth API shape stable and maps storage to our timestamp.
export function createAuth(db: Database, config: AuthConfig) {
  const googleProvider =
    config.googleClientId && config.googleClientSecret
      ? {
          google: {
            clientId: config.googleClientId,
            clientSecret: config.googleClientSecret,
          },
        }
      : undefined;

  return betterAuth({
    appName: 'LEVERIE',
    baseURL: config.baseURL,
    secret: config.secret,
    trustedOrigins: config.trustedOrigins,
    database: drizzleAdapter(db, {
      provider: 'pg',
    }),
    secondaryStorage: config.secondaryStorage,
    session: {
      // Better Auth uses secondaryStorage as the primary session store unless
      // this is set. Cloudflare KV is eventually consistent, so an email
      // verification redirect can create a session and then immediately land
      // on /edit before KV reads see it, causing /api/me to return 401. Keep
      // sessions in Postgres as the source of truth while secondaryStorage
      // remains available for rate-limit counters and cache acceleration.
      storeSessionInDatabase: true,
    },
    // Better Auth's default rate limiter ships disabled outside production and
    // its in-memory storage is unusable on Workers (each isolate keeps its own
    // map). We force-enable it here and pin the storage to `secondary-storage`
    // so it always uses the KV/Redis backend wired above. Auth-sensitive
    // endpoints get tighter custom rules — the high-cost path is sending email.
    rateLimit: {
      enabled: true,
      storage: 'secondary-storage',
      window: 60,
      max: 100,
      customRules: {
        '/sign-up/email': { window: 600, max: 5 },
        '/sign-in/email': { window: 60, max: 10 },
        '/sign-in/magic-link': { window: 600, max: 5 },
        '/forget-password': { window: 600, max: 3 },
        '/send-verification-email': { window: 600, max: 3 },
      },
    },
    socialProviders: googleProvider,
    plugins: [
      magicLink({
        sendMagicLink: async ({ email, url }) => {
          await sendMagicLinkEmail(
            {
              resendApiKey: config.resendApiKey,
              from: config.emailFrom,
            },
            { email, url },
          );
        },
      }),
    ],
    advanced: {
      database: {
        // Let the production user table's `uuidv7()` DB default generate user
        // IDs. Auth implementation tables keep app-generated UUID strings.
        generateId: generateDatabaseId,
      },
    },
    user: {
      fields: {
        emailVerified: 'emailVerifiedAt',
      },
      additionalFields: {
        emailVerified: {
          type: 'date',
          fieldName: 'emailVerifiedAt',
          required: false,
          input: false,
          defaultValue: null,
          transform: {
            input: emailVerifiedToTimestamp,
            output: emailVerifiedFromTimestamp,
          },
        },
        lastLoginAt: {
          type: 'date',
          fieldName: 'lastLoginAt',
          required: false,
          input: false,
          returned: false,
        },
        deletedAt: {
          type: 'date',
          fieldName: 'deletedAt',
          required: false,
          input: false,
          returned: true,
        },
      },
    },
    emailAndPassword: {
      enabled: true,
      // Sign-up no longer creates a session; the user must click the link in
      // the verification email first. This blocks bulk signups against
      // unowned mailboxes.
      autoSignIn: false,
      requireEmailVerification: true,
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        await sendVerificationEmail(
          {
            resendApiKey: config.resendApiKey,
            from: config.emailFrom,
          },
          { email: user.email, url },
        );
      },
    },
    databaseHooks: {
      session: {
        create: {
          after: async (session) => {
            await db
              .update(userTable)
              .set({ lastLoginAt: new Date() })
              .where(eq(userTable.id, session.userId));
          },
        },
      },
      user: {
        create: {
          // An open invitation token in the user's inbox already proves they
          // own the address, so we pre-verify the account at creation time.
          // This lets the invite flow (signUp → signIn → acceptInvitation)
          // run end-to-end without bouncing through the email-link redirect.
          before: async (user) => {
            const email = user.email?.toLowerCase();
            if (!email) return;
            const [pending] = await db
              .select({ id: invitation.id })
              .from(invitation)
              .where(
                and(
                  eq(invitation.email, email),
                  isNull(invitation.acceptedAt),
                  isNull(invitation.revokedAt),
                  gt(invitation.expiresAt, new Date()),
                ),
              )
              .limit(1);
            if (!pending) return;
            // Pass `true` here, not a Date — the additionalFields transform
            // (input: emailVerifiedToTimestamp) converts it to `new Date()`
            // before the insert reaches the DB. Returning a Date directly
            // would bypass the transform and trip the boolean type.
            return { data: { ...user, emailVerified: true } };
          },
        },
        delete: {
          before: async (user) => {
            await db
              .update(userTable)
              .set({
                email: `deleted-${user.id}@deleted.leverie.invalid`,
                name: 'Deleted user',
                image: null,
                emailVerifiedAt: null,
                deletedAt: new Date(),
              })
              .where(eq(userTable.id, user.id));

            return false;
          },
        },
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
