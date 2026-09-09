import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Mail, Pencil, Plus, Trash2, UsersRound, X } from 'lucide-react';
import { teamMembersApi, type TeamMember } from '@/features/team-members/api/team-members-api';
import { getApiErrorMessage } from '@/shared/api/client';
import { Button } from '@/shared/ui/Button';
import { useConfirm } from '@/shared/ui/ConfirmDialog';
import { Input } from '@/shared/ui/Input';
import { ListPagination } from '@/shared/ui/ListPagination';
import { SearchSuggest } from '@/shared/ui/SearchSuggest';
import { Spinner } from '@/shared/ui/Spinner';
import { useToast } from '@/shared/ui/toast';

const PER_PAGE = 20;

export function TeamMembersPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TeamMember | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const queryClient = useQueryClient();
  const toast = useToast();
  const { confirm } = useConfirm();

  const listQuery = useQuery({
    queryKey: ['team-members', 'list', search, page],
    queryFn: () =>
      teamMembersApi.list({
        search: search || undefined,
        page,
        perPage: PER_PAGE,
      }),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editing) {
        return teamMembersApi.update(editing.id, {
          name: name.trim(),
          email: email.trim().toLowerCase(),
        });
      }
      return teamMembersApi.create({
        name: name.trim(),
        email: email.trim().toLowerCase(),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['team-members'] });
      toast.success(
        editing
          ? 'Team member updated'
          : 'Team member added — login credentials emailed',
      );
      closeModal();
    },
    onError: (error) =>
      toast.error(getApiErrorMessage(error, 'Unable to save team member')),
  });

  const reinviteMutation = useMutation({
    mutationFn: (id: string) => teamMembersApi.reinvite(id),
    onSuccess: () => toast.success('New password emailed to team member'),
    onError: (error) =>
      toast.error(getApiErrorMessage(error, 'Unable to send reinvite')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => teamMembersApi.remove(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['team-members'] });
      toast.success('Team member removed');
    },
    onError: (error) =>
      toast.error(getApiErrorMessage(error, 'Unable to remove team member')),
  });

  function openCreate() {
    setEditing(null);
    setName('');
    setEmail('');
    setModalOpen(true);
  }

  function openEdit(member: TeamMember) {
    setEditing(member);
    setName(member.name);
    setEmail(member.email);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (name.trim().length < 2) {
      toast.error('Name must be at least 2 characters');
      return;
    }
    if (!email.trim()) {
      toast.error('Email is required');
      return;
    }
    await saveMutation.mutateAsync();
  }

  async function handleReinvite(member: TeamMember) {
    const ok = await confirm({
      title: 'Send reinvite email?',
      message: `Generate a new password for “${member.name}” and email it to ${member.email}? Their previous password will stop working.`,
      confirmLabel: 'Send new password',
      tone: 'primary',
    });
    if (!ok) return;
    await reinviteMutation.mutateAsync(member.id);
  }

  async function handleDelete(member: TeamMember) {
    const ok = await confirm({
      title: 'Remove team member?',
      message: `Delete “${member.name}” (${member.email})? They will no longer be able to sign in.`,
      confirmLabel: 'Remove',
      tone: 'danger',
    });
    if (!ok) return;
    await deleteMutation.mutateAsync(member.id);
  }

  const items = listQuery.data?.items ?? [];
  const meta = listQuery.data?.meta;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <span className="page-kicker">People</span>
          <h1>Team Members</h1>
          <p className="muted">
            Desk team accounts for check-in only. Adding a member emails a temporary password to
            their login page.
          </p>
        </div>
        <div className="page-header-actions">
          <Button onClick={openCreate}>
            <Plus size={16} />
            Add team member
          </Button>
        </div>
      </header>

      <div className="toolbar">
        <SearchSuggest
          label="Search"
          placeholder="Name or email…"
          value={search}
          onChange={(next) => {
            setSearch(next);
            setPage(1);
          }}
          loadSuggestions={async (draft) => {
            const result = await teamMembersApi.list({ search: draft, perPage: 6 });
            return result.items.map((item) => ({
              id: item.id,
              title: item.name,
              subtitle: item.email,
            }));
          }}
        />
      </div>

      {listQuery.isLoading ? (
        <Spinner label="Loading team members…" />
      ) : items.length === 0 ? (
        <div className="empty-state">
          <UsersRound size={28} />
          <h3>No team members yet</h3>
          <p className="muted">Add a name and email to invite someone to the desk check-in app.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((member) => (
                <tr key={member.id}>
                  <td>{member.name}</td>
                  <td>{member.email}</td>
                  <td>
                    <span className={`status-pill status-${member.status}`}>{member.status}</span>
                  </td>
                  <td>
                    <div className="row-actions">
                      <Button
                        variant="ghost"
                        onClick={() => void handleReinvite(member)}
                        disabled={reinviteMutation.isPending || member.status !== 'active'}
                        title="Send new password email"
                      >
                        <Mail size={16} />
                        Reinvite
                      </Button>
                      <Button variant="ghost" onClick={() => openEdit(member)}>
                        <Pencil size={16} />
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => void handleDelete(member)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {meta ? (
        <ListPagination
          page={meta.page}
          totalPages={meta.totalPages}
          total={meta.total}
          perPage={meta.perPage}
          onPageChange={setPage}
          label="team members"
        />
      ) : null}

      {modalOpen ? (
        <div className="modal-backdrop" role="presentation" onClick={closeModal}>
          <div
            className="modal-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="team-member-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="modal-header">
              <h2 id="team-member-modal-title">
                {editing ? 'Edit team member' : 'Add team member'}
              </h2>
              <button type="button" className="modal-close" onClick={closeModal} aria-label="Close">
                <X size={18} />
              </button>
            </header>
            <form className="modal-body stack" onSubmit={(event) => void onSubmit(event)}>
              <Input
                label="Full name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                autoFocus
              />
              <Input
                label="Email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
              {!editing ? (
                <p className="muted" style={{ margin: 0 }}>
                  A temporary password will be generated and emailed with the team login link.
                </p>
              ) : null}
              <div className="modal-actions">
                <Button type="button" variant="secondary" onClick={closeModal}>
                  Cancel
                </Button>
                <Button type="submit" loading={saveMutation.isPending}>
                  {editing ? 'Save' : 'Add & email password'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
