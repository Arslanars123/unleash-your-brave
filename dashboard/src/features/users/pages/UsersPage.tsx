import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { usersApi } from '@/features/users/api/users-api';
import type { UserStatus } from '@/shared/types/api';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { Spinner } from '@/shared/ui/Spinner';
import { getApiErrorMessage } from '@/shared/api/client';

export function UsersPage() {
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();

  const usersQuery = useQuery({
    queryKey: ['users', 'list', search],
    queryFn: () => usersApi.list({ search: search || undefined, perPage: 50 }),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: UserStatus }) =>
      usersApi.updateStatus(id, status),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['users', 'list'] }),
        queryClient.invalidateQueries({ queryKey: ['users', 'stats'] }),
      ]);
    },
  });

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Users</h1>
          <p className="muted">Search, review, and manage member accounts.</p>
        </div>
      </header>

      <div className="toolbar">
        <Input
          label="Search"
          placeholder="Name or email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {usersQuery.isLoading ? <Spinner /> : null}
      {usersQuery.isError ? (
        <p className="form-error">{getApiErrorMessage(usersQuery.error)}</p>
      ) : null}

      {usersQuery.data ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Joined</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {usersQuery.data.items.map((user) => (
                <tr key={user.id}>
                  <td>{user.name}</td>
                  <td>{user.email}</td>
                  <td>
                    <span className={`badge role-${user.role}`}>{user.role}</span>
                  </td>
                  <td>
                    <span className={`badge status-${user.status}`}>{user.status}</span>
                  </td>
                  <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                  <td className="actions">
                    {user.role !== 'admin' ? (
                      <Button
                        variant="secondary"
                        disabled={statusMutation.isPending}
                        onClick={() =>
                          statusMutation.mutate({
                            id: user.id,
                            status: user.status === 'active' ? 'suspended' : 'active',
                          })
                        }
                      >
                        {user.status === 'active' ? 'Suspend' : 'Activate'}
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted table-meta">
            Showing {usersQuery.data.items.length} of {usersQuery.data.meta.total} users
          </p>
        </div>
      ) : null}
    </div>
  );
}
