import { Copy, ExternalLink } from 'lucide-react';
import type { AttendeePurchaseSummary, PublicMembershipPurchase } from '@/shared/types/api';
import { useToast } from '@/shared/ui/toast';

function display(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  const text = String(value).trim();
  return text.length > 0 ? text : '—';
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
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

function kindLabel(kind: PublicMembershipPurchase['kind']): string {
  return kind === 'upgrade' ? 'Upgrade' : 'Initial purchase';
}

function statusClass(status: PublicMembershipPurchase['paymentStatus']): string {
  switch (status) {
    case 'paid':
      return 'purchase-status purchase-status-paid';
    case 'pending':
      return 'purchase-status purchase-status-pending';
    case 'failed':
      return 'purchase-status purchase-status-failed';
    case 'refunded':
      return 'purchase-status purchase-status-refunded';
    default:
      return 'purchase-status';
  }
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function StripePaymentRef({ paymentIntentId }: { paymentIntentId: string }) {
  const toast = useToast();
  const stripeUrl = `https://dashboard.stripe.com/payments/${paymentIntentId}`;

  return (
    <div className="purchase-ref">
      <span className="purchase-ref-label">Stripe payment ID</span>
      <div className="purchase-ref-row">
        <code className="purchase-ref-code" title="Stripe Payment Intent ID">
          {paymentIntentId}
        </code>
        <button
          type="button"
          className="purchase-ref-btn"
          aria-label="Copy Stripe payment ID"
          onClick={() => {
            void copyText(paymentIntentId).then((ok) => {
              toast[ok ? 'success' : 'error'](
                ok ? 'Payment ID copied' : 'Could not copy',
              );
            });
          }}
        >
          <Copy size={14} />
        </button>
        <a
          className="purchase-ref-btn"
          href={stripeUrl}
          target="_blank"
          rel="noreferrer"
          aria-label="Open in Stripe"
          title="Open in Stripe"
        >
          <ExternalLink size={14} />
        </a>
      </div>
    </div>
  );
}

function PurchaseCard({ item }: { item: PublicMembershipPurchase }) {
  const planLabel =
    item.kind === 'upgrade'
      ? `${display(item.previousMembershipName)} → ${item.membershipName}`
      : item.membershipName;

  return (
    <article className="purchase-card">
      <div className="purchase-card-top">
        <div>
          <p className="purchase-card-kind">{kindLabel(item.kind)}</p>
          <h4 className="purchase-card-plan">{planLabel}</h4>
        </div>
        <span className={statusClass(item.paymentStatus)}>{item.paymentStatus}</span>
      </div>

      <dl className="purchase-card-meta">
        <div>
          <dt>Amount</dt>
          <dd>{money(item.price, item.currency)}</dd>
        </div>
        <div>
          <dt>Date</dt>
          <dd>{formatDate(item.purchasedAt)}</dd>
        </div>
      </dl>

      {item.stripePaymentIntentId ? (
        <StripePaymentRef paymentIntentId={item.stripePaymentIntentId} />
      ) : (
        <p className="muted purchase-card-note">No Stripe payment ID on this record</p>
      )}
    </article>
  );
}

interface MembershipRecordPanelProps {
  summary: AttendeePurchaseSummary;
  sourceLabel: string;
  ghlContactId?: string | null;
  productTitle?: string | null;
}

/** Clean membership summary + purchase history for attendee detail / check-in. */
export function MembershipRecordPanel({
  summary,
  sourceLabel,
  ghlContactId,
  productTitle,
}: MembershipRecordPanelProps) {
  const history = [...summary.purchases].sort(
    (a, b) => new Date(b.purchasedAt).getTime() - new Date(a.purchasedAt).getTime(),
  );

  return (
    <div className="membership-record">
      <div className="membership-summary-cards">
        <div className="membership-summary-card membership-summary-card-accent">
          <span className="membership-summary-label">Current plan</span>
          <strong>{display(summary.currentMembershipName)}</strong>
        </div>
        <div className="membership-summary-card">
          <span className="membership-summary-label">Started with</span>
          <strong>{display(summary.originalMembershipName)}</strong>
        </div>
        <div className="membership-summary-card">
          <span className="membership-summary-label">Latest payment</span>
          <strong>
            {summary.latestPurchase
              ? money(summary.latestPurchase.price, summary.latestPurchase.currency)
              : '—'}
          </strong>
          {summary.latestPurchase ? (
            <span className="membership-summary-sub">
              {summary.latestPurchase.membershipName} ·{' '}
              {formatDate(summary.latestPurchase.purchasedAt)}
            </span>
          ) : null}
        </div>
      </div>

      <dl className="attendee-detail-grid membership-source-grid">
        <div className="attendee-detail-row">
          <dt>Signup source</dt>
          <dd>{sourceLabel}</dd>
        </div>
        <div className="attendee-detail-row">
          <dt>GHL contact ID</dt>
          <dd>{display(ghlContactId)}</dd>
        </div>
        <div className="attendee-detail-row">
          <dt>Listed product / title</dt>
          <dd>{display(productTitle)}</dd>
        </div>
      </dl>

      <div className="purchase-history">
        <div className="purchase-history-head">
          <h4>Payment history</h4>
          <span className="muted">
            {history.length} record{history.length === 1 ? '' : 's'}
          </span>
        </div>

        {history.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            No Stripe purchases recorded yet.
          </p>
        ) : (
          <div className="purchase-card-list">
            {history.map((item) => (
              <PurchaseCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export { formatDate as formatMembershipDate, money as formatMembershipMoney };
