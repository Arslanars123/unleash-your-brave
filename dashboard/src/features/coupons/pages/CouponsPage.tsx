import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Bell, Copy, Pencil, Plus, TicketPercent, Trash2 } from 'lucide-react';
import { couponsApi } from '@/features/coupons/api/coupons-api';
import { CouponFormModal } from '@/features/coupons/components/CouponFormModal';
import { membershipsApi } from '@/features/memberships/api/memberships-api';
import { eventsApi } from '@/features/events/api/events-api';
import { getApiErrorMessage } from '@/shared/api/client';
import type { CouponPayload, PublicCoupon } from '@/shared/types/api';
import { Button } from '@/shared/ui/Button';
import { useConfirm } from '@/shared/ui/ConfirmDialog';
import { ListPagination } from '@/shared/ui/ListPagination';
import { SearchSuggest } from '@/shared/ui/SearchSuggest';
import { Spinner } from '@/shared/ui/Spinner';
import { useToast } from '@/shared/ui/toast';

const PER_PAGE = 20;

export function CouponsPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PublicCoupon | null>(null);
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();
  const toast = useToast();
  const { confirm } = useConfirm();

  const workspaceQuery = useQuery({
    queryKey: ['events', 'workspace'],
    queryFn: () => eventsApi.getWorkspace(),
  });
  const eventId = workspaceQuery.data?.current?.id;

  const membershipsQuery = useQuery({
    queryKey: ['memberships', 'coupons', eventId],
    queryFn: () => membershipsApi.list({ eventId, page: 1, perPage: 100 }),
    enabled: Boolean(eventId),
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
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(coupon: PublicCoupon) {
    setEditing(coupon);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
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
            Generate discount codes with per-membership percentages. Send by push notification or
            copy and share manually.
          </p>
        </div>
        <div className="page-header-actions">
          <Button type="button" onClick={openCreate}>
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
          <Button type="button" onClick={openCreate}>
            Create coupon
          </Button>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
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
        memberships={membershipsQuery.data?.items ?? []}
        loading={saving}
        onClose={closeModal}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
