import {
  ArrowLeft,
  Ban,
  Building2,
  Loader2,
  MailPlus,
  Shield,
  UserMinus,
  Users,
} from 'lucide-react';
import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Toaster, toast } from 'sonner';
import logoUrl from '@/assets/logo.svg';
import {
  CloudApiError,
  type CloudInvitation,
  type CloudMember,
  type CloudOrg,
  type CloudRole,
  createInvitation,
  getMe,
  listInvitations,
  listMembers,
  removeMember,
  revokeInvitation,
  updateMemberRole,
} from '@/lib/cloudApi';

type ManageableOrg = {
  org: CloudOrg;
  role: Extract<CloudRole, 'owner' | 'admin'>;
};

const inviteRoles: Exclude<CloudRole, 'owner'>[] = [
  'admin',
  'editor',
  'viewer',
  'runner',
];
const memberRoles: CloudRole[] = [
  'owner',
  'admin',
  'editor',
  'viewer',
  'runner',
];

function errorMessage(error: unknown) {
  if (error instanceof CloudApiError) return error.message;
  return error instanceof Error ? error.message : 'Request failed.';
}

function roleLabel(role: CloudRole) {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}

function invitationStatus(invitation: CloudInvitation) {
  if (invitation.acceptedAt) return 'Accepted';
  if (invitation.revokedAt) return 'Revoked';
  if (new Date(invitation.expiresAt).getTime() < Date.now()) return 'Expired';
  return 'Pending';
}

export function OrgSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [orgs, setOrgs] = useState<ManageableOrg[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [members, setMembers] = useState<CloudMember[]>([]);
  const [invitations, setInvitations] = useState<CloudInvitation[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Exclude<CloudRole, 'owner'>>('viewer');
  const [submitting, setSubmitting] = useState(false);

  const selectedOrg = useMemo(
    () => orgs.find((entry) => entry.org.id === selectedOrgId) ?? null,
    [orgs, selectedOrgId],
  );
  const isOwner = selectedOrg?.role === 'owner';
  const pendingInvitations = invitations.filter(
    (invitation) => invitationStatus(invitation) === 'Pending',
  );

  const loadOrgData = useCallback(async (orgId: string, showSpinner = true) => {
    if (showSpinner) setRefreshing(true);
    try {
      const [memberResult, invitationResult] = await Promise.all([
        listMembers(orgId),
        listInvitations(orgId),
      ]);
      setMembers(memberResult.members);
      setInvitations(invitationResult.invitations);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      if (showSpinner) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await getMe();
        if (cancelled) return;
        const manageable = me.orgs
          .filter(
            (
              membership,
            ): membership is (typeof me.orgs)[number] & {
              role: 'owner' | 'admin';
            } => membership.role === 'owner' || membership.role === 'admin',
          )
          .map((membership) => ({
            org: membership.org,
            role: membership.role,
          }));
        setOrgs(manageable);
        const firstOrgId = manageable[0]?.org.id ?? '';
        setSelectedOrgId(firstOrgId);
        if (firstOrgId) await loadOrgData(firstOrgId, false);
      } catch (error) {
        toast.error(errorMessage(error));
        if (error instanceof CloudApiError && error.status === 401) {
          window.location.assign('/auth');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadOrgData]);

  const handleOrgChange = async (orgId: string) => {
    setSelectedOrgId(orgId);
    await loadOrgData(orgId);
  };

  const handleInvite = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedOrg || !email.trim()) return;

    setSubmitting(true);
    try {
      await createInvitation(selectedOrg.org.id, email, role);
      setEmail('');
      toast.success('Invitation sent.');
      await loadOrgData(selectedOrg.org.id);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRoleChange = async (member: CloudMember, nextRole: CloudRole) => {
    if (!selectedOrg || member.role === nextRole) return;
    try {
      await updateMemberRole(selectedOrg.org.id, member.membershipId, nextRole);
      toast.success('Member role updated.');
      await loadOrgData(selectedOrg.org.id);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const handleRemoveMember = async (member: CloudMember) => {
    if (!selectedOrg) return;
    if (
      !window.confirm(`Remove ${member.email} from ${selectedOrg.org.name}?`)
    ) {
      return;
    }
    try {
      await removeMember(selectedOrg.org.id, member.membershipId);
      toast.success('Member removed.');
      await loadOrgData(selectedOrg.org.id);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const handleRevokeInvitation = async (invitation: CloudInvitation) => {
    if (!selectedOrg) return;
    try {
      await revokeInvitation(selectedOrg.org.id, invitation.id);
      toast.success('Invitation revoked.');
      await loadOrgData(selectedOrg.org.id);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <Toaster position="top-right" richColors />
      <header className="flex h-14 items-center justify-between border-b border-gray-200 bg-white px-4">
        <a href="/edit" className="inline-flex items-center gap-3">
          <img src={logoUrl} alt="LEVERIE" className="h-9" />
        </a>
        <a
          href="/edit"
          className="inline-flex h-8 items-center gap-2 rounded border border-gray-200 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to editor
        </a>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded border border-emerald-200 bg-emerald-50 text-emerald-700">
              <Building2 className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-semibold text-gray-950">
              Organization settings
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">
              Manage members and pending invitations for Runner and editor
              access.
            </p>
          </div>

          {orgs.length > 0 ? (
            <label className="min-w-64">
              <span className="mb-1 block text-xs font-medium text-gray-600">
                Organization
              </span>
              <select
                value={selectedOrgId}
                onChange={(event) => void handleOrgChange(event.target.value)}
                className="h-10 w-full rounded border border-gray-200 bg-white px-3 text-sm focus:outline-none focus:ring-1 focus:ring-violet-300"
              >
                {orgs.map((entry) => (
                  <option key={entry.org.id} value={entry.org.id}>
                    {entry.org.name} ({roleLabel(entry.role)})
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>

        {loading ? (
          <div className="flex min-h-72 items-center justify-center rounded border border-gray-200 bg-white">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        ) : orgs.length === 0 ? (
          <section className="rounded border border-gray-200 bg-white p-8 text-center">
            <Shield className="mx-auto h-8 w-8 text-gray-300" />
            <h2 className="mt-3 text-base font-semibold text-gray-900">
              Owner or admin access required
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              Ask an organization owner or admin to manage members for this
              workspace.
            </p>
          </section>
        ) : selectedOrg ? (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
            <section className="rounded border border-gray-200 bg-white">
              <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-gray-400" />
                  <h2 className="text-sm font-semibold text-gray-900">
                    Members
                  </h2>
                </div>
                {refreshing ? (
                  <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                ) : null}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      <th className="px-4 py-2">Member</th>
                      <th className="px-4 py-2">Role</th>
                      <th className="px-4 py-2">Joined</th>
                      <th className="w-16 px-4 py-2 text-right">Remove</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((member) => (
                      <tr
                        key={member.membershipId}
                        className="border-b border-gray-100 last:border-0"
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">
                            {member.name || member.email}
                          </div>
                          {member.name ? (
                            <div className="text-xs text-gray-500">
                              {member.email}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={member.role}
                            onChange={(event) =>
                              void handleRoleChange(
                                member,
                                event.target.value as CloudRole,
                              )
                            }
                            className="h-8 rounded border border-gray-200 bg-white px-2 text-xs font-medium text-gray-700 focus:outline-none focus:ring-1 focus:ring-violet-300"
                          >
                            {memberRoles
                              .filter((candidateRole) =>
                                isOwner ? true : candidateRole !== 'owner',
                              )
                              .map((candidateRole) => (
                                <option
                                  key={candidateRole}
                                  value={candidateRole}
                                >
                                  {roleLabel(candidateRole)}
                                </option>
                              ))}
                          </select>
                        </td>
                        <td className="px-4 py-3 text-gray-500">
                          {formatDate(member.joinedAt)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => void handleRemoveMember(member)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded border border-gray-200 text-gray-500 hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                            aria-label={`Remove ${member.email}`}
                          >
                            <UserMinus className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <aside className="space-y-5">
              <section className="rounded border border-gray-200 bg-white p-4">
                <div className="mb-4 flex items-center gap-2">
                  <MailPlus className="h-4 w-4 text-gray-400" />
                  <h2 className="text-sm font-semibold text-gray-900">
                    Invite member
                  </h2>
                </div>
                <form onSubmit={handleInvite} className="space-y-3">
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-gray-600">
                      Email
                    </span>
                    <input
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      type="email"
                      required
                      className="h-10 w-full rounded border border-gray-200 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-violet-300"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-gray-600">
                      Role
                    </span>
                    <select
                      value={role}
                      onChange={(event) =>
                        setRole(
                          event.target.value as Exclude<CloudRole, 'owner'>,
                        )
                      }
                      className="h-10 w-full rounded border border-gray-200 bg-white px-3 text-sm focus:outline-none focus:ring-1 focus:ring-violet-300"
                    >
                      {inviteRoles.map((inviteRole) => (
                        <option key={inviteRole} value={inviteRole}>
                          {roleLabel(inviteRole)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex h-10 w-full items-center justify-center gap-2 rounded bg-violet-600 px-3 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
                  >
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <MailPlus className="h-4 w-4" />
                    )}
                    Send invitation
                  </button>
                </form>
              </section>

              <section className="rounded border border-gray-200 bg-white">
                <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <MailPlus className="h-4 w-4 text-gray-400" />
                    <h2 className="text-sm font-semibold text-gray-900">
                      Pending invitations
                    </h2>
                  </div>
                  <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                    {pendingInvitations.length}
                  </span>
                </div>
                <div className="divide-y divide-gray-100">
                  {pendingInvitations.length === 0 ? (
                    <div className="px-4 py-5 text-sm text-gray-500">
                      No pending invitations.
                    </div>
                  ) : (
                    pendingInvitations.map((invitation) => {
                      const status = invitationStatus(invitation);
                      return (
                        <div key={invitation.id} className="px-4 py-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium text-gray-900">
                                {invitation.email}
                              </div>
                              <div className="mt-1 text-xs text-gray-500">
                                {roleLabel(invitation.role)} · {status} ·
                                expires {formatDate(invitation.expiresAt)}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                void handleRevokeInvitation(invitation)
                              }
                              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded border border-gray-200 text-gray-500 hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                              aria-label={`Revoke invitation for ${invitation.email}`}
                            >
                              <Ban className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </section>
            </aside>
          </div>
        ) : null}
      </main>
    </div>
  );
}
