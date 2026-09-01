/** Calendar date `YYYY-MM-DD` — last day new purchases are allowed (inclusive). */
export type MembershipSaleExpiresAt = string;

export interface MembershipLinkMeta {
  saleExpiresAt?: MembershipSaleExpiresAt | null;
  badgeLabel?: string | null;
}

export interface EventMembershipLinkInput {
  membershipId: string;
  saleExpiresAt?: MembershipSaleExpiresAt | null;
  badgeLabel?: string | null;
}

export function normalizeMembershipLinkInput(
  link: EventMembershipLinkInput,
): EventMembershipLinkInput {
  const saleExpiresAt = link.saleExpiresAt?.trim() || null;
  const badgeLabel = link.badgeLabel?.trim() || null;
  return {
    membershipId: link.membershipId,
    saleExpiresAt,
    badgeLabel,
  };
}

export function eventEndDateKey(endDate: Date | string): string {
  return new Date(endDate).toISOString().slice(0, 10);
}

/** True when no cutoff is set or today (UTC) is on/before the cutoff date. */
export function isMembershipSaleOpen(saleExpiresAt: string | null | undefined): boolean {
  if (!saleExpiresAt?.trim()) return true;
  const today = new Date().toISOString().slice(0, 10);
  return today <= saleExpiresAt.trim();
}

export function assertSaleExpiresBeforeEventEnd(
  saleExpiresAt: string | null | undefined,
  eventEndDate: Date | string,
  membershipLabel?: string,
): void {
  if (!saleExpiresAt?.trim()) return;
  const endKey = eventEndDateKey(eventEndDate);
  if (saleExpiresAt.trim() > endKey) {
    const prefix = membershipLabel ? `"${membershipLabel}" sale expiry` : 'Sale expiry';
    throw new Error(`${prefix} must be on or before the event end date (${endKey})`);
  }
}
