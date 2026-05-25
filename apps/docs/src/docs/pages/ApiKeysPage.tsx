import { KeyRound, LockKeyhole, ShieldCheck } from 'lucide-react';
import {
  Callout,
  CodeBlock,
  DefinitionList,
  DocSection,
  FeatureGrid,
} from '../components';

export function ApiKeysPage() {
  return (
    <>
      <DocSection title="Create a key">
        <p>
          API keys are created from organization settings by an owner or admin.
          A key belongs to one workspace and is intended for a caller such as a
          backend service, workflow automation, MCP bridge, or agent runtime.
        </p>
        <p>
          LEVERIE shows the raw secret only once. Store it immediately in the
          caller&apos;s secret manager or deployment environment. After that,
          the UI shows metadata such as name, prefix, scope, role, status, and
          last used time.
        </p>
        <CodeBlock
          title="Authorization header"
          code={`Authorization: Bearer lvr_your_secret_key`}
        />
      </DocSection>

      <DocSection title="Scopes">
        <p>
          Scopes control which logics a key can call. Use <code>all</code> for
          broad internal automation inside one workspace. Use allow-list scope
          for production integrations where the caller should only see a small
          set of approved logics.
        </p>
        <DefinitionList
          items={[
            [
              'Workspace boundary',
              'Every key is tied to one workspace. It cannot cross into another workspace.',
            ],
            [
              'all',
              'The key can access every non-deleted logic in the workspace that the route can evaluate.',
            ],
            [
              'allow-list',
              'The key can only access selected logics attached to the key. Hosted MCP tools/list only returns those tools.',
            ],
          ]}
        />
      </DocSection>

      <DocSection title="Roles">
        <p>
          Roles are intentionally narrow. Most runtime integrations should use a
          role that can evaluate logic but cannot manage workspace settings. The
          role model keeps authoring permissions and execution permissions
          separate.
        </p>
        <FeatureGrid
          items={[
            {
              icon: KeyRound,
              title: 'runner',
              body: 'Best fit for API and MCP callers that only need evaluation behavior.',
            },
            {
              icon: ShieldCheck,
              title: 'viewer',
              body: 'A read-oriented role for integrations that inspect metadata without editing.',
            },
            {
              icon: LockKeyhole,
              title: 'editor',
              body: 'Reserved for trusted automation that participates in authoring workflows.',
            },
          ]}
        />
      </DocSection>

      <DocSection title="Rotation">
        <p>
          Rotate keys by creating a replacement, deploying the new secret,
          verifying traffic, and revoking the old key. Revocation takes effect
          on the next authenticated request. A revoked key cannot evaluate logic
          or list MCP tools.
        </p>
        <Callout icon={LockKeyhole} title="Never commit lvr_ secrets">
          API keys should live in a secret manager, CI/CD secret store, or
          runtime environment variable. Treat them like production database
          credentials.
        </Callout>
      </DocSection>
    </>
  );
}
