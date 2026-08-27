import { useQuery } from '@tanstack/react-query';
import {
  BadgePercent,
  CircleDollarSign,
  Package,
  Ticket,
  UserCheck,
  Users,
  UserX,
} from 'lucide-react';
import { EditionSwitcher } from '@/features/events/components/EditionSwitcher';
import {
  formatEditionRange,
  useEditionScope,
} from '@/features/events/hooks/useEditionScope';
import { eventsApi } from '@/features/events/api/events-api';
import { usersApi } from '@/features/users/api/users-api';
import { Spinner } from '@/shared/ui/Spinner';

function formatMoney(amount: number, currency = 'usd'): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency.toUpperCase(),
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

export function OverviewPage() {
  const { eventId, selectedEdition, workspaceQuery } = useEditionScope();

  const usersQuery = useQuery({
    queryKey: ['users', 'stats'],
    queryFn: () => usersApi.stats(),
  });

  const overviewQuery = useQuery({
    queryKey: ['events', 'overview', eventId],
    queryFn: () => eventsApi.getOverview(eventId!),
    enabled: Boolean(eventId),
  });

  if (workspaceQuery.isLoading || usersQuery.isLoading) return <Spinner />;
  if (usersQuery.isError) {
    return <p className="form-error">Unable to load overview metrics.</p>;
  }

  const users = usersQuery.data!;
  const overview = overviewQuery.data;
  const currency = overview?.currency ?? 'usd';

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Overview</h1>
          <p className="muted">
            Platform health and per-event sales — memberships, store tickets, revenue, and coupon
            discounts.
          </p>
        </div>
      </header>

      <EditionSwitcher tipText="Pick an edition to see memberships sold, store sales, revenue, and coupon discounts for that event." />

      <section className="stat-grid" style={{ marginTop: 16 }}>
        <article className="stat-card">
          <Users size={20} />
          <div>
            <p>Total users</p>
            <strong>{users.total}</strong>
          </div>
        </article>
        <article className="stat-card success">
          <UserCheck size={20} />
          <div>
            <p>Active</p>
            <strong>{users.active}</strong>
          </div>
        </article>
        <article className="stat-card warn">
          <UserX size={20} />
          <div>
            <p>Suspended</p>
            <strong>{users.suspended}</strong>
          </div>
        </article>
      </section>

      {!eventId ? (
        <p className="muted" style={{ marginTop: 24 }}>
          No event selected.
        </p>
      ) : overviewQuery.isLoading ? (
        <div style={{ marginTop: 24 }}>
          <Spinner label="Loading event sales…" />
        </div>
      ) : overviewQuery.isError ? (
        <p className="form-error" style={{ marginTop: 24 }}>
          Unable to load sales metrics for this event.
        </p>
      ) : overview ? (
        <>
          <header className="page-header" style={{ marginTop: 28, marginBottom: 8 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.15rem' }}>
                {selectedEdition?.name ?? 'Event'} sales
              </h2>
              <p className="muted" style={{ marginBottom: 0 }}>
                {selectedEdition ? formatEditionRange(selectedEdition) : null}
                {selectedEdition?.status ? ` · ${selectedEdition.status}` : null}
              </p>
            </div>
          </header>

          <section className="stat-grid">
            <article className="stat-card">
              <Ticket size={20} />
              <div>
                <p>Memberships sold</p>
                <strong>{overview.memberships.soldCount}</strong>
                <p className="hint" style={{ margin: '4px 0 0' }}>
                  {overview.memberships.uniqueBuyers} unique buyers
                </p>
              </div>
            </article>
            <article className="stat-card">
              <Package size={20} />
              <div>
                <p>Store tickets / units</p>
                <strong>{overview.store.unitsSold}</strong>
                <p className="hint" style={{ margin: '4px 0 0' }}>
                  {overview.store.orderCount} paid orders
                </p>
              </div>
            </article>
            <article className="stat-card success">
              <CircleDollarSign size={20} />
              <div>
                <p>Total revenue</p>
                <strong>{formatMoney(overview.totals.revenue, currency)}</strong>
                <p className="hint" style={{ margin: '4px 0 0' }}>
                  Memberships {formatMoney(overview.memberships.revenue, currency)} · Store{' '}
                  {formatMoney(overview.store.revenue, currency)}
                </p>
              </div>
            </article>
            <article className="stat-card warn">
              <BadgePercent size={20} />
              <div>
                <p>Coupon discounts</p>
                <strong>{formatMoney(overview.memberships.discountTotal, currency)}</strong>
                <p className="hint" style={{ margin: '4px 0 0' }}>
                  {overview.memberships.couponRedemptions} redemption
                  {overview.memberships.couponRedemptions === 1 ? '' : 's'}
                </p>
              </div>
            </article>
            <article className="stat-card">
              <UserCheck size={20} />
              <div>
                <p>Checked in</p>
                <strong>{overview.checkins.checkedInCount}</strong>
              </div>
            </article>
          </section>

          <section className="panel" style={{ marginTop: 20 }}>
            <h3 style={{ marginTop: 0, fontSize: '1rem' }}>Membership breakdown</h3>
            {overview.memberships.byMembership.length === 0 ? (
              <p className="muted" style={{ marginBottom: 0 }}>
                No paid memberships for this event yet.
              </p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Membership</th>
                      <th>Sold</th>
                      <th>Revenue</th>
                      <th>Discounts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.memberships.byMembership.map((row) => (
                      <tr key={row.membershipId}>
                        <td>{row.membershipName}</td>
                        <td>{row.soldCount}</td>
                        <td>{formatMoney(row.revenue, currency)}</td>
                        <td>{formatMoney(row.discountTotal, currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="hint" style={{ marginBottom: 0, marginTop: 12 }}>
              By kind — purchases: {overview.memberships.byKind.purchase}, upgrades:{' '}
              {overview.memberships.byKind.upgrade}, renewals: {overview.memberships.byKind.renew}
            </p>
          </section>
        </>
      ) : null}
    </div>
  );
}
