import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { eq } from 'drizzle-orm';
import type { Database } from './db/client.js';
import { user as userTable } from './db/schema.js';

const generateDatabaseId = ({ model }: { model: string }) => {
  if (model === 'user') return false;
  return crypto.randomUUID();
};

const emailVerifiedToTimestamp = (value: unknown) => {
  if (value instanceof Date) return value;
  if (value === true) return new Date();
  return null;
};

// Per-request Better Auth instance. Same rationale as createDb() — request
// isolation in Workers means each invocation gets its own auth handler. Cost
// is trivial; this is a thin wrapper around the Drizzle adapter.
//
// Better Auth exposes `emailVerified` as a boolean, while the production schema
// stores the verification instant in `email_verified_at`. The field override
// below keeps the auth API shape stable and maps storage to our timestamp.
export function createAuth(
  db: Database,
  baseURL: string,
  secret: string,
  trustedOrigins: string[],
) {
  return betterAuth({
    baseURL,
    secret,
    trustedOrigins,
    database: drizzleAdapter(db, {
      provider: 'pg',
    }),
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
            output: (value) => value !== null,
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
          returned: false,
        },
      },
    },
    emailAndPassword: {
      enabled: true,
      autoSignIn: true,
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
        delete: {
          before: async (user) => {
            await db
              .update(userTable)
              .set({
                name: 'Deleted user',
                image: null,
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
