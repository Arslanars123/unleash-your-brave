import type { AttendeePurchaseSummary, PublicMembershipPurchase } from '@/shared/types/api';

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
  if (kind === 'upgrade') return 'Upgrade';
  if (kind === 'renew') return 'Renewal';
  return 'Initial purchase';
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

function membershipStatusLabel(status: AttendeePurchaseSummary['currentMembershipStatus']): string {
  if (status === 'expired') return 'Expired';
  if (status === 'active') return 'Active';
  return '—';
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
        {item.periodEnd ? (
          <div>
            <dt>Valid until</dt>
            <dd>{formatDate(item.periodEnd)}</dd>
          </div>
        ) : null}
      </dl>
    </article>
  );
}

interface MembershipRecordPanelProps {
  summary: AttendeePurchaseSummary & {
    membershipIdAtCheckIn?: string | null;
    membershipNameAtCheckIn?: string | null;
    isRecurring?: boolean;
    paymentPeriodActive?: boolean;
    qrEntitled?: boolean;
    qrDeniedReason?: string | null;
    qrStatusLabel?: string;
    eligibleForEventContent?: boolean;
    eligibleForEventQr?: boolean;
    blockQrWhenRenewalUnpaid?: boolean;
    carriedFromPrevious?: boolean;
  };
  sourceLabel: string;
  productTitle?: string | null;
  preferredEventId?: string;
}

/** Clean membership summary + purchase history for attendee detail / check-in. */
export function MembershipRecordPanel({
  summary,
  sourceLabel,
  productTitle,
  preferredEventId,
}: MembershipRecordPanelProps) {
  const history = [...summary.purchases].sort((a, b) => {
    if (preferredEventId) {
      const aMatch = a.eventId === preferredEventId ? 0 : 1;
      const bMatch = b.eventId === preferredEventId ? 0 : 1;
      if (aMatch !== bMatch) return aMatch - bMatch;
    }
    return new Date(b.purchasedAt).getTime() - new Date(a.purchasedAt).getTime();
  });

  const preferredCount = preferredEventId
    ? history.filter((item) => item.eventId === preferredEventId).length
    : 0;

  const isRecurring =
    summary.isRecurring ?? summary.currentBillingKind === 'renewable';
  const showAccess = summary.qrStatusLabel != null || summary.qrEntitled != null;

  return (
    <div className="membership-record">
      <div className="membership-summary-cards">
        <div className="membership-summary-card membership-summary-card-accent">
          <span className="membership-summary-label">Current plan</span>
          <strong>{display(summary.currentMembershipName)}</strong>
          <span className="membership-summary-sub">
            {membershipStatusLabel(summary.currentMembershipStatus)}
            {isRecurring ? ' · recurring' : ''}
            {summary.currentMembershipExpiresAt
              ? ` · expires ${formatDate(summary.currentMembershipExpiresAt)}`
              : ''}
          </span>
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
              {kindLabel(summary.latestPurchase.kind)} ·{' '}
              {summary.latestPurchase.membershipName} ·{' '}
              {formatDate(summary.latestPurchase.purchasedAt)}
            </span>
          ) : null}
        </div>
      </div>

      <dl className="attendee-detail-grid membership-source-grid">
        <div className="attendee-detail-row">
          <dt>Membership status</dt>
          <dd>{membershipStatusLabel(summary.currentMembershipStatus)}</dd>
        </div>
        <div className="attendee-detail-row">
          <dt>Plan type</dt>
          <dd>{isRecurring ? 'Recurring / renewable' : 'One-time'}</dd>
        </div>
        <div className="attendee-detail-row">
          <dt>Renewal / expiry</dt>
          <dd>
            {summary.currentMembershipExpiresAt
              ? formatDate(summary.currentMembershipExpiresAt)
              : isRecurring
                ? 'Not set'
                : 'No expiry (one-time)'}
          </dd>
        </div>
        <div className="attendee-detail-row">
          <dt>Payment period</dt>
          <dd>
            {summary.paymentPeriodActive == null
              ? summary.currentMembershipStatus === 'expired'
                ? 'Inactive / unpaid'
                : membershipStatusLabel(summary.currentMembershipStatus)
              : summary.paymentPeriodActive
                ? 'Active (paid period valid)'
                : 'Inactive — renewal unpaid or expired'}
          </dd>
        </div>
        {showAccess ? (
          <>
            <div className="attendee-detail-row">
              <dt>QR code status</dt>
              <dd>
                {summary.qrStatusLabel ??
                  (summary.qrEntitled ? 'Valid for this event' : 'Invalid / not entitled')}
                {summary.qrDeniedReason === 'renewal_payment_required' ? (
                  <span className="hint" style={{ display: 'block', marginTop: 4 }}>
                    QR was not updated for the next event because the required renewal payment is
                    still pending.
                  </span>
                ) : null}
              </dd>
            </div>
            <div className="attendee-detail-row">
              <dt>Eligible for event content</dt>
              <dd>{summary.eligibleForEventContent ? 'Yes' : 'No'}</dd>
            </div>
            <div className="attendee-detail-row">
              <dt>Eligible for event QR</dt>
              <dd>{summary.eligibleForEventQr || summary.qrEntitled ? 'Yes' : 'No'}</dd>
            </div>
            {summary.carriedFromPrevious ? (
              <div className="attendee-detail-row">
                <dt>Access source</dt>
                <dd>Carried from previous edition</dd>
              </div>
            ) : null}
          </>
        ) : null}
        <div className="attendee-detail-row">
          <dt>Signup source</dt>
          <dd>{sourceLabel}</dd>
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
            {preferredEventId && preferredCount > 0
              ? ` · ${preferredCount} for selected event first`
              : ''}
            {summary.renewals?.length
              ? ` · ${summary.renewals.length} renewal${summary.renewals.length === 1 ? '' : 's'}`
              : ''}
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
