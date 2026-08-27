import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { Bell, Copy, Pencil, Plus, TicketPercent, Trash2 } from 'lucide-react';
import { couponsApi } from '@/features/coupons/api/coupons-api';
import { CouponFormModal } from '@/features/coupons/components/CouponFormModal';
import { membershipsApi } from '@/features/memberships/api/memberships-api';
import { eventsApi } from '@/features/events/api/events-api';
import { getApiErrorMessage } from '@/shared/api/client';
import type { CouponPayload, PublicCoupon, PublicEvent } from '@/shared/types/api';
import { Button } from '@/shared/ui/Button';
import { useConfirm } from '@/shared/ui/ConfirmDialog';
import { ListPagination } from '@/shared/ui/ListPagination';
import { SearchSuggest } from '@/shared/ui/SearchSuggest';
import { Spinner } from '@/shared/ui/Spinner';
import { useToast } from '@/shared/ui/toast';

const PER_PAGE = 20;

function collectNonEndedEvents(workspace: {
  current: PublicEvent | null;
  upcomingEditions: PublicEvent[];
  editions?: PublicEvent[];
} | undefined): PublicEvent[] {
  if (!workspace) return [];
  const seen = new Set<string>();
  const out: PublicEvent[] = [];
  for (const event of [workspace.current, ...workspace.upcomingEditions]) {
    if (!event || event.status === 'ended' || seen.has(event.id)) continue;
    seen.add(event.id);
    out.push(event);
  }
  return out;
}

export function CouponsPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PublicCoupon | null>(null);
  const [modalEventId, setModalEventId] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();
  const toast = useToast();
  const { confirm } = useConfirm();

  const workspaceQuery = useQuery({
    queryKey: ['events', 'workspace'],
    queryFn: () => eventsApi.getWorkspace(),
  });

  const couponEvents = useMemo(
    () => collectNonEndedEvents(workspaceQuery.data),
    [workspaceQuery.data],
  );

  const eventNameById = useMemo(() => {
    const map = new Map<string, string>();
    const workspace = workspaceQuery.data;
    if (!workspace) return map;
    for (const event of [
      workspace.current,
      ...(workspace.upcomingEditions ?? []),
      ...(workspace.pastEditions ?? []),
      ...(workspace.editions ?? []),
    ]) {
      if (event) map.set(event.id, event.name);
    }
    return map;
  }, [workspaceQuery.data]);

  const handleModalEventChange = useCallback((eventId: string) => {
    setModalEventId(eventId || undefined);
  }, []);

  const membershipsQuery = useQuery({
    queryKey: ['memberships', 'coupons', modalEventId],
    queryFn: () => membershipsApi.list({ eventId: modalEventId, page: 1, perPage: 100 }),
    enabled: Boolean(modalEventId) && modalOpen,
  });

  const couponsQuery = useQuery({
    queryKey: ['coupons', 'list', search, page],
    queryFn: () =>
      couponsApi.list({
        search: search || undefined,
        page,
        perPage: PER_PAGE,
      }),
  });

  const membershipNameById = new Map(
    (membershipsQuery.data?.items ?? []).map((item) => [item.id, item.name]),
  );

  function applySearch(next: string) {
    setSearch(next);
    setPage(1);
  }

  function openCreate() {
    if (couponEvents.length === 0) {
      toast.error('Coupons can only be created for current or upcoming events');
      return;
    }
    setEditing(null);
    setModalEventId(couponEvents[0]?.id);
    setModalOpen(true);
  }

  function openEdit(coupon: PublicCoupon) {
    if (
      coupon.eventId &&
      !couponEvents.some((event) => event.id === coupon.eventId)
    ) {
      toast.error('Coupons for past events cannot be edited');
      return;
    }
    setEditing(coupon);
    setModalEventId(coupon.eventId || couponEvents[0]?.id);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
    setModalEventId(undefined);
  }

  async function handleSubmit(payload: CouponPayload) {
    setSaving(true);
    try {
      if (editing) {
        await couponsApi.update(editing.id, payload);
        toast.success('Coupon updated');
      } else {
        const created = await couponsApi.create(payload);
        toast.success(`Coupon ${created.code} created`);
      }
      await queryClient.invalidateQueries({ queryKey: ['coupons'] });
      closeModal();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Unable to save coupon'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(coupon: PublicCoupon) {
    const ok = await confirm({
      title: 'Delete coupon?',
      message: `Delete “${coupon.code}”? Attendees will no longer be able to use it.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await couponsApi.remove(coupon.id);
      await queryClient.invalidateQueries({ queryKey: ['coupons'] });
      toast.success('Coupon deleted');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Unable to delete coupon'));
    }
  }

  async function handleCopy(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      toast.success('Coupon code copied');
    } catch {
      toast.error('Unable to copy code');
    }
  }

  async function handleSend(coupon: PublicCoupon) {
    const ok = await confirm({
      title: 'Send coupon notification?',
      message: `Send code ${coupon.code} to all attendees as an announcement push notification? You can also copy the code and share it manually.`,
      confirmLabel: 'Send notification',
      cancelLabel: 'Cancel',
      tone: 'primary',
    });
    if (!ok) return;
    try {
      await couponsApi.send(coupon.id, {
        title: `Coupon: ${coupon.code}`,
        message:
          coupon.description?.trim() ||
          `Use code ${coupon.code} at checkout for a membership discount.`,
        sendPush: true,
      });
      toast.success('Coupon notification sent');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Unable to send coupon'));
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Coupons</h1>
          <p className="muted">
            Generate discount codes with per-membership percentages for a current or upcoming
            event. Send by push notification or copy and share manually.
          </p>
        </div>
        <div className="page-header-actions">
          <Button type="button" onClick={openCreate} disabled={couponEvents.length === 0}>
            <Plus size={16} /> Create coupon
          </Button>
        </div>
      </header>

      <div className="toolbar">
        <SearchSuggest
          label="Search"
          value={search}
          onChange={applySearch}
          placeholder="Search code or name…"
          loadSuggestions={async (draft) => {
            const result = await couponsApi.list({
              search: draft,
              perPage: 6,
            });
            return result.items.map((coupon) => ({
              id: coupon.id,
              title: coupon.code,
              subtitle: coupon.name,
            }));
          }}
        />
      </div>

      {couponsQuery.isLoading ? (
        <Spinner label="Loading coupons…" />
      ) : couponsQuery.isError ? (
        <p className="form-error">{getApiErrorMessage(couponsQuery.error)}</p>
      ) : !couponsQuery.data || couponsQuery.data.items.length === 0 ? (
        <div className="empty-state">
          <TicketPercent size={28} />
          <p>No coupons yet. Create one to offer membership discounts.</p>
          <Button type="button" onClick={openCreate} disabled={couponEvents.length === 0}>
            Create coupon
          </Button>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Event</th>
                <th>Name</th>
                <th>Discounts</th>
                <th>Uses</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {couponsQuery.data.items.map((coupon) => (
                <tr key={coupon.id}>
                  <td>
                    <strong>{coupon.code}</strong>
                  </td>
                  <td>{eventNameById.get(coupon.eventId) ?? (coupon.eventId ? 'Event' : '—')}</td>
                  <td>{coupon.name}</td>
                  <td>
                    <div style={{ display: 'grid', gap: 4 }}>
                      {coupon.membershipDiscounts.map((item) => (
                        <span key={`${coupon.id}-${item.membershipId}`} className="hint">
                          {membershipNameById.get(item.membershipId) ?? 'Membership'} —{' '}
                          {item.percentOff}% off
                        </span>
                      ))}
                    </div>
                  </td>
                  <td>
                    {coupon.redemptionCount}
                    {coupon.maxRedemptions > 0 ? ` / ${coupon.maxRedemptions}` : ' / ∞'}
                  </td>
                  <td>
                    {coupon.active ? (
                      <span className="status-pill is-live">Active</span>
                    ) : (
                      <span className="status-pill">Inactive</span>
                    )}
                    {coupon.expiresAt ? (
                      <div className="hint">
                        Exp {new Date(coupon.expiresAt).toLocaleString()}
                      </div>
                    ) : null}
                  </td>
                  <td>
                    <div className="row-actions">
                      <button
                        type="button"
                        className="icon-button"
                        aria-label="Copy code"
                        onClick={() => void handleCopy(coupon.code)}
                      >
                        <Copy size={16} />
                      </button>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label="Send notification"
                        onClick={() => void handleSend(coupon)}
                      >
                        <Bell size={16} />
                      </button>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label="Edit"
                        onClick={() => openEdit(coupon)}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label="Delete"
                        onClick={() => void handleDelete(coupon)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <ListPagination
            page={couponsQuery.data.meta.page}
            totalPages={couponsQuery.data.meta.totalPages}
            total={couponsQuery.data.meta.total}
            perPage={couponsQuery.data.meta.perPage}
            onPageChange={setPage}
            label="coupons"
          />
        </div>
      )}

      <CouponFormModal
        open={modalOpen}
        mode={editing ? 'edit' : 'create'}
        initialCoupon={editing}
        events={couponEvents}
        memberships={membershipsQuery.data?.items ?? []}
        loading={saving}
        onEventChange={handleModalEventChange}
        onClose={closeModal}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
