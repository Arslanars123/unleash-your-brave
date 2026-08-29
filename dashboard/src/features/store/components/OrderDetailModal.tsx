import { CheckCircle2, X } from 'lucide-react';
import type { PublicStoreOrder } from '@/shared/types/api';
import { Button } from '@/shared/ui/Button';
import { formatUsDateTime } from '@/shared/lib/datetime';

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="attendee-detail-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

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

interface OrderDetailModalProps {
  order: PublicStoreOrder;
  busy?: boolean;
  onClose: () => void;
  onMarkComplete: () => void;
}

export function OrderDetailModal({
  order,
  busy = false,
  onClose,
  onMarkComplete,
}: OrderDetailModalProps) {
  const customerName = [order.firstName, order.lastName].filter(Boolean).join(' ').trim() || '—';
  const isPending = order.fulfillmentStatus !== 'completed';

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-panel modal-panel-wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-detail-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <div>
            <h2 id="order-detail-title">Order details</h2>
            <p className="muted">{order.productName}</p>
          </div>
          <button type="button" className="icon-button" aria-label="Close" onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        <div className="modal-body">
          <section className="attendee-detail-section">
            <h3>Customer</h3>
            <dl className="attendee-detail-grid">
              <DetailRow label="Name" value={customerName} />
              <DetailRow label="Email" value={order.email} />
              <DetailRow label="Phone" value={order.contactPhone || '—'} />
              <DetailRow label="Delivery address" value={order.deliveryAddress || '—'} />
            </dl>
          </section>

          <section className="attendee-detail-section">
            <h3>Order</h3>
            <dl className="attendee-detail-grid">
              <DetailRow label="Product" value={order.productName} />
              <DetailRow label="SKU" value={order.sku || '—'} />
              <DetailRow label="Quantity" value={String(order.quantity)} />
              <DetailRow label="Unit price" value={money(order.unitPrice, order.currency)} />
              <DetailRow label="Total" value={money(order.totalPrice, order.currency)} />
              <DetailRow label="Payment" value={order.paymentStatus} />
              <DetailRow
                label="Fulfillment"
                value={order.fulfillmentStatus === 'completed' ? 'Completed' : 'Pending'}
              />
              <DetailRow label="Ordered" value={formatUsDateTime(order.purchasedAt)} />
              {order.completedAt ? (
                <DetailRow label="Completed" value={formatUsDateTime(order.completedAt)} />
              ) : null}
            </dl>
          </section>
        </div>

        <div className="modal-actions">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            Close
          </Button>
          {isPending ? (
            <Button type="button" onClick={onMarkComplete} disabled={busy}>
              <CheckCircle2 size={16} />
              Mark complete
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
