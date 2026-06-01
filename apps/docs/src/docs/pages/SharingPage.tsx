import { Copy, ExternalLink, Mail, ShieldCheck, UserCheck } from 'lucide-react';
import {
  Callout,
  Checklist,
  DefinitionList,
  DocSection,
  FeatureGrid,
} from '../components';
import { asset, pageHref } from '../metadata';

export function SharingPage() {
  return (
    <>
      <DocSection title="What a runner is">
        <p>
          A runner is a sign-in protected page that lets someone evaluate a
          published version of a logic without seeing the editor. They enter
          inputs, see the outputs, and read the trace. They cannot edit the
          rules. This is the surface to send to a manager who needs to verify a
          decision, or to a stakeholder approving a policy change before it
          ships.
        </p>
        <p>
          Every runner URL has the shape{' '}
          <code>/run/&lt;workspaceId&gt;/&lt;logicId&gt;@vN</code>. The{' '}
          <code>@vN</code> pins the runner to a specific{' '}
          <a href={pageHref('publishing')}>published version</a>, so a reviewer
          always sees the version they were asked to look at — even if the team
          is already editing the next draft.
        </p>
        <Callout icon={ShieldCheck} title="Runners require sign-in">
          LEVERIE does not produce anonymous public runner links. Anyone you
          want to share a runner with must accept an invitation or already be a
          member of the workspace. Public, signed, or embedded share links are
          intentionally deferred to a later phase.
        </Callout>
      </DocSection>

      <DocSection title="Sharing from the editor">
        <p>
          Open the Account and workspace menu in the header, then choose{' '}
          <strong>Share runner</strong>. The dialog shows the version that would
          be served (production if pinned, otherwise latest), a button to copy
          the runner URL, and a small form to invite someone by email.
        </p>
        <FeatureGrid
          items={[
            {
              icon: Copy,
              title: 'Copy runner URL',
              body: 'Sends the URL to your clipboard. Paste it in Slack, an email, or a ticket — only people with access will be able to load it.',
            },
            {
              icon: ExternalLink,
              title: 'Open runner',
              body: 'Opens the runner in a new tab so you can preview what the reviewer will see before sharing.',
            },
            {
              icon: Mail,
              title: 'Invite by email',
              body: 'Sends an invitation that lets the reviewer sign in or sign up. After accepting, the runner page loads directly for them.',
            },
          ]}
        />
        <Callout icon={ShieldCheck} title="Publish before sharing">
          If no version is published yet, the dialog will tell you to{' '}
          <a href={pageHref('publishing')}>publish first</a>. A runner cannot
          serve a draft because the draft is mutable and changes underneath the
          reviewer.
        </Callout>
      </DocSection>

      <DocSection title="Inviting reviewers by email">
        <p>
          The invite form lets you choose a role. The default is{' '}
          <strong>runner</strong>, which is the most restricted: the reviewer
          can only open the shared runner URL and evaluate it. Use{' '}
          <strong>viewer</strong> if you want them to be able to see other
          published logics in the workspace too. Anything more permissive should
          be granted from organization settings, not the share dialog.
        </p>
        <DefinitionList
          items={[
            [
              'runner',
              'Can open shared runner URLs only. Cannot browse the workspace, view drafts, or edit anything.',
            ],
            [
              'viewer',
              'Read-only across the workspace. Can list published logics and open any runner they have access to.',
            ],
            [
              'editor and above',
              'Granted from the organization settings page, not the share dialog. See Workspace management for the full role table.',
            ],
          ]}
        />
        <p>
          The invitation email contains a token. Clicking it lands the reviewer
          on <code>/invite?token=...</code>, where the editor guides them
          through sign-in, account creation, or account switch.
        </p>
      </DocSection>

      <DocSection title="Accepting an invitation">
        <p>The invitation flow adapts to who is opening the link.</p>
        <DefinitionList
          items={[
            [
              'Unregistered user',
              'Sees a sign-up form pre-filled with the invitation email. After sign-up, the editor lands them directly on the runner URL or shared page.',
            ],
            [
              'Signed-in user with the same email',
              'Sees a one-click accept. After accepting, the editor redirects to the runner so they can immediately review the case.',
            ],
            [
              'Signed-in user with a different email',
              'Is asked to switch to the invited account. This prevents accidentally accepting an invitation under the wrong identity.',
            ],
          ]}
        />
        <figure className="media-card">
          <img
            src={asset('editor-auth.png')}
            alt="The LEVERIE auth screen with the sign-in form, a create-account option, and a link to continue without signing in."
          />
          <figcaption>
            The auth screen used by both sign-up and sign-in, including
            invitation acceptance.
          </figcaption>
        </figure>
      </DocSection>

      <DocSection title="Stakeholder review habits">
        <p>
          Runner review works best when it is a small, repeatable ritual rather
          than a one-off request. Use it as a checkpoint before any policy or
          routing rule reaches production.
        </p>
        <Checklist
          items={[
            'Publish a version before sharing, so the reviewer sees a stable target.',
            'Send a short message alongside the URL: what changed, why, and which cases you would like them to try.',
            'Encourage reviewers to try a no-match case, not just a happy path.',
            'When the reviewer signs off, record the version number — that is the version you keep pinned in production.',
            'When the next round of edits begins, share a fresh runner URL with the new version pinned.',
          ]}
        />
        <Callout icon={UserCheck} title="Combine with batch testing">
          Stakeholder runner review and{' '}
          <a href={pageHref('evaluation')}>batch testing</a> complement each
          other. Batch tests catch behavior changes; runner review confirms the
          new behavior matches business intent.
        </Callout>
      </DocSection>
    </>
  );
}
