import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { CheckCircle2, Eye, PackageCheck } from 'lucide-react';
import { EditionSwitcher } from '@/features/events/components/EditionSwitcher';
import { useEditionScope } from '@/features/events/hooks/useEditionScope';
import { storeApi } from '@/features/store/api/store-api';
import { OrderDetailModal } from '@/features/store/components/OrderDetailModal';
import { getApiErrorMessage } from '@/shared/api/client';
import { formatUsDateTime } from '@/shared/lib/datetime';
import type { PublicStoreOrder, StoreFulfillmentStatus } from '@/shared/types/api';
import { Button } from '@/shared/ui/Button';
import { ListPagination } from '@/shared/ui/ListPagination';
import { SearchSuggest } from '@/shared/ui/SearchSuggest';
import { Spinner } from '@/shared/ui/Spinner';
import { useToast } from '@/shared/ui/toast';

const PER_PAGE = 20;

type StatusFilter = 'all' | StoreFulfillmentStatus;

function money(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

export function OrdersPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedOrder, setSelectedOrder] = useState<PublicStoreOrder | null>(null);
  const [completing, setCompleting] = useState(false);

  const queryClient = useQueryClient();
  const toast = useToast();
  const { eventId, workspaceQuery } = useEditionScope();

  const ordersQuery = useQuery({
    queryKey: ['store', 'orders', eventId, search, page, statusFilter],
    queryFn: () =>
      storeApi.listOrders({
        eventId,
        search: search || undefined,
        page,
        perPage: PER_PAGE,
        fulfillmentStatus: statusFilter === 'all' ? undefined : statusFilter,
      }),
    enabled: Boolean(eventId),
  });

  useEffect(() => {
    setPage(1);
  }, [eventId, statusFilter]);

  function applySearch(next: string) {
    setSearch(next);
    setPage(1);
  }

  async function handleMarkComplete(order: PublicStoreOrder) {
    setCompleting(true);
    try {
      const updated = await storeApi.markOrderCompleted(order.id);
      await queryClient.invalidateQueries({ queryKey: ['store', 'orders'] });
      setSelectedOrder(updated);
      toast.success('Order marked complete');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Unable to update order'));
    } finally {
      setCompleting(false);
    }
  }

  const meta = ordersQuery.data?.meta;
  const items = ordersQuery.data?.items ?? [];

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Orders</h1>
          <p className="muted">Shop purchases for the selected edition</p>
        </div>
        <EditionSwitcher />
      </header>

      {!eventId && !workspaceQuery.isLoading ? (
        <p className="muted">Select an edition to view orders.</p>
      ) : null}

      {eventId ? (
        <>
          <div className="toolbar">
            <SearchSuggest
              value={search}
              placeholder="Search product, email, phone, address…"
              onChange={applySearch}
              loadSuggestions={async (draft) => {
                if (!eventId) return [];
                const result = await storeApi.listOrders({
                  eventId,
                  search: draft,
                  perPage: 6,
                  fulfillmentStatus: statusFilter === 'all' ? undefined : statusFilter,
                });
                return result.items.map((order) => ({
                  id: order.id,
                  title: order.productName,
                  subtitle: order.email,
                }));
              }}
            />
            <div className="toolbar" style={{ gap: 8 }}>
              {(
                [
                  ['all', 'All'],
                  ['pending', 'Pending'],
                  ['completed', 'Completed'],
                ] as const
              ).map(([value, label]) => (
                <Button
                  key={value}
                  type="button"
                  variant={statusFilter === value ? 'primary' : 'secondary'}
                  onClick={() => setStatusFilter(value)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>

          {ordersQuery.isLoading ? (
            <Spinner />
          ) : ordersQuery.isError ? (
            <p className="field-error">Unable to load orders.</p>
          ) : items.length === 0 ? (
            <div className="empty-state">
              <PackageCheck size={40} />
              <p>No orders yet for this edition.</p>
            </div>
          ) : (
            <>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Customer</th>
                      <th>Phone</th>
                      <th>Qty</th>
                      <th>Total</th>
                      <th>Status</th>
                      <th>Ordered</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((order) => (
                      <tr key={order.id}>
                        <td>
                          <strong>{order.productName}</strong>
                          {order.sku ? <p className="muted" style={{ margin: 0 }}>{order.sku}</p> : null}
                        </td>
                        <td>
                          <div>
                            <strong>
                              {[order.firstName, order.lastName].filter(Boolean).join(' ') || '—'}
                            </strong>
                            <p className="muted" style={{ margin: 0 }}>{order.email}</p>
                          </div>
                        </td>
                        <td>{order.contactPhone || '—'}</td>
                        <td>{order.quantity}</td>
                        <td>{money(order.totalPrice, order.currency)}</td>
                        <td>
                          <span
                            className={`badge status-${order.fulfillmentStatus === 'completed' ? 'active' : 'pending'}`}
                          >
                            {order.fulfillmentStatus === 'completed' ? 'Completed' : 'Pending'}
                          </span>
                        </td>
                        <td>{formatUsDateTime(order.purchasedAt)}</td>
                        <td className="actions">
                          <Button variant="secondary" onClick={() => setSelectedOrder(order)}>
                            <Eye size={14} />
                            View
                          </Button>
                          {order.fulfillmentStatus !== 'completed' ? (
                            <Button
                              variant="secondary"
                              disabled={completing}
                              onClick={() => void handleMarkComplete(order)}
                            >
                              <CheckCircle2 size={14} />
                              Complete
                            </Button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {meta ? (
                <ListPagination
                  page={meta.page}
                  totalPages={meta.totalPages}
                  total={meta.total}
                  perPage={meta.perPage}
                  onPageChange={setPage}
                  label="orders"
                />
              ) : null}
            </>
          )}
        </>
      ) : null}

      {selectedOrder ? (
        <OrderDetailModal
          order={selectedOrder}
          busy={completing}
          onClose={() => setSelectedOrder(null)}
          onMarkComplete={() => void handleMarkComplete(selectedOrder)}
        />
      ) : null}
    </div>
  );
}
