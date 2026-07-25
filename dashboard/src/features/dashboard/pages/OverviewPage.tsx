import { useQuery } from '@tanstack/react-query';
import { Users, UserCheck, UserX } from 'lucide-react';
import { usersApi } from '@/features/users/api/users-api';
import { Spinner } from '@/shared/ui/Spinner';

export function OverviewPage() {
  const statsQuery = useQuery({
    queryKey: ['users', 'stats'],
    queryFn: () => usersApi.stats(),
  });

  if (statsQuery.isLoading) return <Spinner />;
  if (statsQuery.isError) {
    return <p className="form-error">Unable to load overview metrics.</p>;
  }

  const stats = statsQuery.data!;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Overview</h1>
          <p className="muted">Platform health at a glance.</p>
        </div>
      </header>

      <section className="stat-grid">
        <article className="stat-card">
          <Users size={20} />
          <div>
            <p>Total users</p>
            <strong>{stats.total}</strong>
          </div>
        </article>
        <article className="stat-card success">
          <UserCheck size={20} />
          <div>
            <p>Active</p>
            <strong>{stats.active}</strong>
          </div>
        </article>
        <article className="stat-card warn">
          <UserX size={20} />
          <div>
            <p>Suspended</p>
            <strong>{stats.suspended}</strong>
          </div>
        </article>
      </section>
    </div>
  );
}
