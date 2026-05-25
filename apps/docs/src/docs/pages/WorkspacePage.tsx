import {
  Building2,
  KeyRound,
  Mail,
  ShieldCheck,
  SlidersHorizontal,
  UserMinus,
  UserPlus,
  Users,
} from 'lucide-react';
import {
  Callout,
  Checklist,
  DefinitionList,
  DocSection,
  FeatureGrid,
} from '../components';
import { pageHref } from '../metadata';

export function WorkspacePage() {
  return (
    <>
      <DocSection title="Organizations and workspaces">
        <p>
          LEVERIE Cloud has two nested concepts: an organization is the billing
          and member boundary, and a workspace is a logical container of logics
          inside that organization. When you sign up, an organization and a
          default workspace are created automatically. Most teams stay on this
          one-org, one-workspace structure for a long time.
        </p>
        <DefinitionList
          items={[
            [
              'Organization',
              'The unit of ownership. Members, invitations, and roles live here. One person is always the owner.',
            ],
            [
              'Workspace',
              'A container of logics inside an organization. Use multiple workspaces only when you need a strong boundary — for example, separating customer-facing rules from internal ops.',
            ],
            [
              'Membership',
              'A user has exactly one role per organization. The role is the same in every workspace inside that organization.',
            ],
            [
              'API key',
              'Belongs to a workspace, not to a user. See the API keys page for issuance, scopes, and rotation.',
            ],
          ]}
        />
      </DocSection>

      <DocSection title="Roles">
        <p>
          Five roles cover the common patterns. Roles are designed so that
          authoring permissions and execution permissions are separable.
        </p>
        <FeatureGrid
          items={[
            {
              icon: ShieldCheck,
              title: 'Owner',
              body: 'Full control. The only role that can grant or revoke ownership and request organization deletion. At least one owner must always exist.',
            },
            {
              icon: SlidersHorizontal,
              title: 'Admin',
              body: 'Manages members, invitations, workspaces, and API keys. Cannot grant ownership or delete the organization.',
            },
            {
              icon: UserPlus,
              title: 'Editor',
              body: 'Can author logic: create, edit, save drafts, publish, and pin production versions. Cannot manage members or keys.',
            },
            {
              icon: Users,
              title: 'Viewer',
              body: 'Read-only across the workspace. Can browse published logics and open runner URLs they have access to.',
            },
            {
              icon: Mail,
              title: 'Runner',
              body: 'The most restricted role. Can only open shared runner URLs and evaluate them. Cannot browse the workspace.',
            },
          ]}
        />
        <Callout icon={ShieldCheck} title="Last-owner protection">
          The system refuses to demote or remove the last remaining owner.
          Before transferring an organization, promote a teammate to owner so
          there are always two while the change happens.
        </Callout>
      </DocSection>

      <DocSection title="Organization settings">
        <p>
          Organization settings live at <code>/settings/org</code> and are
          reachable from the Account and workspace menu in the editor header.
          Only owners and admins can open the page. It is where membership,
          invitations, and roles are managed.
        </p>
        <DefinitionList
          items={[
            [
              'Members tab',
              'Lists every active member with their email, role, and the date they joined. Role changes and removals happen here.',
            ],
            [
              'Pending invitations',
              'Shows invitations sent but not yet accepted. You can revoke a pending invitation if it was sent in error.',
            ],
            [
              'Invite by email',
              'Sends a tokenized invitation. The recipient signs in or signs up; the system attaches them to your organization on acceptance.',
            ],
          ]}
        />
      </DocSection>

      <DocSection title="Workspace settings">
        <p>
          Workspace settings live at <code>/settings/workspace</code>. They are
          also owner and admin only. The most common reason to open this page is
          to issue or revoke <a href={pageHref('api-keys')}>API keys</a>, which
          are scoped to a single workspace.
        </p>
        <FeatureGrid
          items={[
            {
              icon: KeyRound,
              title: 'API key list',
              body: 'Shows every active key, its prefix, scope, role, who created it, and when it was last used. The full secret is only shown once at creation time.',
            },
            {
              icon: Building2,
              title: 'Workspace picker',
              body: 'If the organization owns more than one workspace, switch between them at the top of the page.',
            },
            {
              icon: ShieldCheck,
              title: 'Revoke',
              body: 'Marks a key revoked. The next authenticated request from that key is rejected — useful when a credential has leaked.',
            },
          ]}
        />
      </DocSection>

      <DocSection title="Inviting members">
        <p>
          Use the invite form on the organization settings page. Pick the role
          you want the person to start with — you can always change it later
          from the members list. The invitation email contains a one-time token;
          clicking it opens <code>/invite?token=...</code>.
        </p>
        <Checklist
          items={[
            'Invite people with the narrowest role that lets them do their job. Promote later if they need more.',
            'For stakeholders who only need to verify decisions, runner or viewer is almost always the right starting role.',
            'For build partners who help author logic, editor is the right starting role. Reserve admin for people who run the team.',
            'Revoke unaccepted invitations that are older than a week — they are usually forgotten.',
          ]}
        />
      </DocSection>

      <DocSection title="Removing access">
        <p>
          When someone changes roles or leaves the organization, the members
          list is where to act.
        </p>
        <DefinitionList
          items={[
            [
              'Change role',
              'Use the role dropdown next to a member. Owner and admin both edit roles, but only owner can grant ownership.',
            ],
            [
              'Remove member',
              'Drops the membership immediately. The user can still sign in with their own account but loses access to this organization, all its workspaces, and any logics they could see only through this membership.',
            ],
            [
              'Revoke API keys',
              'If the departing member owned credentials used by services they ran, rotate those keys from workspace settings. See API keys for the rotation pattern.',
            ],
          ]}
        />
        <Callout
          icon={UserMinus}
          title="Removing a member does not delete their logic"
        >
          Logics belong to the workspace, not to the person who created them.
          Removing the author keeps every logic, version, execution log, and
          audit event intact.
        </Callout>
      </DocSection>
    </>
  );
}
