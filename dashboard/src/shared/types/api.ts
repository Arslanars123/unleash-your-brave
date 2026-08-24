export type UserRole = 'admin' | 'member' | 'speaker' | 'sponsor';
export type UserStatus = 'active' | 'suspended';

export type NetworkingPref =
  | 'open_to_all'
  | 'industry_peers'
  | 'investors'
  | 'mentors'
  | 'closed';

export const NETWORKING_PREFS: NetworkingPref[] = [
  'open_to_all',
  'industry_peers',
  'investors',
  'mentors',
  'closed',
];

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  fullName: string;
  role: UserRole;
  status: UserStatus;
  speakerId: string | null;
  sponsorId: string | null;
  membershipId: string | null;
  membershipStatus?: 'active' | 'expired' | null;
  membershipExpiresAt?: string | null;
  renewalReminderSentAt?: string | null;
  photoUrl: string;
  title: string;
  business: string;
  industry: string;
  location: string;
  bio: string;
  goals: string[];
  interests: string[];
  networkingPrefs: NetworkingPref;
  linkedinUrl: string;
  instagramUrl: string;
  websiteUrl: string;
  isVip: boolean;
  points: number;
  profileCompleted: boolean;
  mustChangePassword?: boolean;
  ghlContactId?: string | null;
  firstName?: string;
  lastName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserPayload {
  email: string;
  name: string;
  password: string;
  role?: UserRole;
  status?: UserStatus;
  speakerId?: string | null;
  sponsorId?: string | null;
  membershipId?: string | null;
  photoUrl?: string;
  title?: string;
  business?: string;
  industry?: string;
  location?: string;
  bio?: string;
  goals?: string[];
  interests?: string[];
  networkingPrefs?: NetworkingPref;
  linkedinUrl?: string;
  instagramUrl?: string;
  websiteUrl?: string;
  isVip?: boolean;
  points?: number;
  profileCompleted?: boolean;
}

export interface UpdateUserPayload {
  name?: string;
  email?: string;
  password?: string;
  role?: UserRole;
  status?: UserStatus;
  speakerId?: string | null;
  sponsorId?: string | null;
  membershipId?: string | null;
  photoUrl?: string;
  title?: string;
  business?: string;
  industry?: string;
  location?: string;
  bio?: string;
  goals?: string[];
  interests?: string[];
  networkingPrefs?: NetworkingPref;
  linkedinUrl?: string;
  instagramUrl?: string;
  websiteUrl?: string;
  isVip?: boolean;
  points?: number;
  profileCompleted?: boolean;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: string;
}

export interface AuthResult {
  user: PublicUser;
  tokens: TokenPair;
}

export interface PaginationMeta {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
  unreadCount?: number;
  stats?: CheckInStats;
}

export interface CheckInStats {
  eventId: string;
  checkedInCount: number;
  attendeeCount: number;
}

export interface PublicCheckInRow {
  id: string;
  eventId: string;
  userId: string;
  checkedInAt: string;
  checkedInBy: string | null;
  membershipIdAtCheckIn?: string | null;
  membershipNameAtCheckIn?: string | null;
  createdAt: string;
  updatedAt: string;
  checkedIn: boolean;
  user?: PublicUser | null;
}

export interface PublicMembershipPurchase {
  id: string;
  eventId: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  membershipId: string;
  membershipName: string;
  price: number;
  currency: string;
  couponCode?: string | null;
  couponId?: string | null;
  originalPrice?: number | null;
  discountAmount?: number | null;
  kind: 'purchase' | 'upgrade' | 'renew';
  previousMembershipId: string | null;
  previousMembershipName: string | null;
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded';
  stripeCheckoutSessionId: string;
  stripePaymentIntentId: string | null;
  stripeCustomerId: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  purchasedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface AttendeePurchaseSummary {
  currentMembershipId: string | null;
  currentMembershipName: string | null;
  currentMembershipStatus: 'active' | 'expired' | null;
  currentMembershipExpiresAt: string | null;
  currentBillingKind: 'one_time' | 'renewable' | null;
  originalMembershipId: string | null;
  originalMembershipName: string | null;
  purchases: PublicMembershipPurchase[];
  upgrades: PublicMembershipPurchase[];
  renewals: PublicMembershipPurchase[];
  latestPurchase: PublicMembershipPurchase | null;
}

export interface CheckInScanMembershipSummary extends AttendeePurchaseSummary {
  membershipIdAtCheckIn: string | null;
  membershipNameAtCheckIn: string | null;
  isRecurring?: boolean;
  paymentPeriodActive?: boolean;
  qrEntitled?: boolean;
  qrDeniedReason?: string | null;
  qrStatusLabel?: string;
  eligibleForEventContent?: boolean;
  eligibleForEventQr?: boolean;
  blockQrWhenRenewalUnpaid?: boolean;
  carriedFromPrevious?: boolean;
}

export type CheckInFormFieldType = 'text' | 'textarea' | 'checkbox' | 'yes_no';

export interface CheckInFormField {
  id: string;
  label: string;
  type: CheckInFormFieldType;
  required: boolean;
  sortOrder: number;
}

export interface PublicCheckInForm {
  id: string;
  eventId: string;
  title: string;
  description: string;
  fields: CheckInFormField[];
  requireSignature: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertCheckInFormPayload {
  title: string;
  description?: string;
  fields: Array<{
    id?: string;
    label: string;
    type: CheckInFormFieldType;
    required?: boolean;
    sortOrder?: number;
  }>;
  requireSignature?: boolean;
  isActive?: boolean;
}

export interface CompleteCheckInWithFormPayload {
  token?: string;
  eventId?: string;
  userId?: string;
  expectedEventId?: string;
  answers: Record<string, string | boolean>;
  signatureDataUrl?: string;
  signedName: string;
}

export interface CheckInScanResult {
  /** True when an active form must be completed before check-in is created. */
  requiresForm?: boolean;
  form?: PublicCheckInForm | null;
  /** Null when requiresForm is true (check-in not created yet). */
  checkIn: PublicCheckInRow | null;
  alreadyCheckedIn: boolean;
  user: PublicUser;
  membership: CheckInScanMembershipSummary;
}

export interface MyCheckInQr {
  eventId: string;
  eventName: string;
  eventStatus: EventEditionStatus;
  userId: string;
  token: string;
  checkedIn: boolean;
  checkedInAt: string | null;
}

export interface SuccessEnvelope<T> {
  success: true;
  data: T;
  meta?: PaginationMeta;
}

export interface ErrorEnvelope {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface UserStats {
  active: number;
  suspended: number;
  total: number;
}

export interface PublicEventDay {
  dayNumber: number;
  date: string;
  label: string;
}

export interface EventDayPayload {
  dayNumber?: number;
  date: string;
  label?: string;
}

export type EventEditionStatus = 'upcoming' | 'live' | 'ended' | 'paused';

export interface PublicEvent {
  id: string;
  name: string;
  tagline: string;
  description: string;
  startDate: string;
  endDate: string;
  days: PublicEventDay[];
  dayCount: number;
  status: EventEditionStatus;
  paused?: boolean;
  venueName: string;
  venueAddress: string;
  venueCity: string;
  latitude: number | null;
  longitude: number | null;
  coverImage: string;
  allowPreviousAttendeesAccess?: boolean;
  blockQrWhenRenewalUnpaid?: boolean;
  /** When false, draft — hidden from public/app discovery. Defaults true. */
  published?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EventWorkspace {
  current: PublicEvent | null;
  /** Always true — upcoming editions can be created while another is live. */
  canScheduleNew: boolean;
  scheduleBlockedReason: string | null;
  /** All editions newest-first (including current). */
  editions: PublicEvent[];
  /** Ended editions only (excludes current when it is still active). */
  pastEditions: PublicEvent[];
  /** Upcoming/live editions that are not the preferred current row. */
  upcomingEditions: PublicEvent[];
}

export interface EventPayload {
  name: string;
  tagline?: string;
  description?: string;
  days: EventDayPayload[];
  venueName?: string;
  venueAddress?: string;
  venueCity?: string;
  latitude?: number | null;
  longitude?: number | null;
  coverImage?: string;
  allowPreviousAttendeesAccess?: boolean;
  blockQrWhenRenewalUnpaid?: boolean;
  paused?: boolean;
  published?: boolean;
  notifyAttendees?: boolean;
}

export interface ScheduleEventPayload {
  days: EventDayPayload[];
  tagline?: string;
  description?: string;
  venueName?: string;
  venueAddress?: string;
  venueCity?: string;
  latitude?: number | null;
  longitude?: number | null;
  coverImage?: string;
  copyDetailsFromPrevious?: boolean;
  allowPreviousAttendeesAccess?: boolean;
  blockQrWhenRenewalUnpaid?: boolean;
  /** Draft until published (default true when omitted). */
  published?: boolean;
  notifyAttendees?: boolean;
}

export interface PublicSpeaker {
  id: string;
  eventId: string;
  name: string;
  email: string;
  title: string;
  description: string;
  photo: string;
  createdAt: string;
  updatedAt: string;
}

export interface SpeakerPayload {
  eventId?: string;
  name: string;
  email?: string;
  title?: string;
  description?: string;
  photo?: string;
}

export type SessionMaterialType = 'pdf' | 'video' | 'doc' | 'link';

export interface PublicMembership {
  id: string;
  eventId: string;
  name: string;
  valueLink: string;
  price: number;
  description: string;
  features?: string[];
  paymentPlanNote?: string;
  featured?: boolean;
  tierRank?: number;
  sortOrder?: number;
  validForFutureEvents?: boolean;
  validForFutureQr?: boolean;
  billingKind?: 'one_time' | 'renewable';
  durationDays?: number;
  upgradeToMembershipId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MembershipPayload {
  eventId?: string;
  name: string;
  valueLink?: string;
  price?: number;
  description?: string;
  features?: string[];
  paymentPlanNote?: string;
  featured?: boolean;
  tierRank?: number;
  sortOrder?: number;
  validForFutureEvents?: boolean;
  validForFutureQr?: boolean;
  billingKind?: 'one_time' | 'renewable';
  durationDays?: number;
  upgradeToMembershipId?: string | null;
}

export interface EffectiveEventAccess {
  eventId: string;
  allowPreviousAttendeesAccess: boolean;
  blockQrWhenRenewalUnpaid?: boolean;
  entitled: boolean;
  qrEntitled: boolean;
  carriedFromPrevious: boolean;
  accessibleMembershipIds: string[];
  effectiveMembershipId: string | null;
  effectiveMembershipName: string | null;
  sourceMembershipId: string | null;
  sourceMembershipName: string | null;
  validForFutureEvents: boolean;
  validForFutureQr: boolean;
  billingKind?: 'one_time' | 'renewable' | null;
  membershipStatus?: 'active' | 'expired' | null;
  membershipExpiresAt?: string | null;
  paymentPeriodActive?: boolean;
  qrDeniedReason?: string | null;
  upgradeMembershipIds: string[];
}

export interface CouponMembershipDiscount {
  membershipId: string;
  percentOff: number;
}

export interface PublicCoupon {
  id: string;
  code: string;
  name: string;
  description: string;
  active: boolean;
  expiresAt: string | null;
  maxRedemptions: number;
  redemptionCount: number;
  membershipDiscounts: CouponMembershipDiscount[];
  createdAt: string;
  updatedAt: string;
}

export interface CouponPayload {
  code?: string;
  name: string;
  description?: string;
  active?: boolean;
  expiresAt?: string | null;
  maxRedemptions?: number;
  membershipDiscounts: CouponMembershipDiscount[];
}

export type SessionKind = 'session' | 'event';

export interface PublicSessionMaterial {
  id: string;
  type: SessionMaterialType;
  title: string;
  url: string;
}

export interface SessionMaterialPayload {
  id?: string;
  type: SessionMaterialType;
  title: string;
  url: string;
}

export interface SessionSpeakerSummary {
  id: string;
  name: string;
  title: string;
  photo: string;
}

export interface SessionFeedbackSummary {
  averageRating: number;
  ratingsCount: number;
}

export interface PublicSession {
  id: string;
  eventId: string;
  kind: SessionKind;
  name: string;
  description: string;
  speakerId: string | null;
  address: string;
  speaker: SessionSpeakerSummary | null;
  eventDayNumber: number;
  startTime: string;
  endTime: string;
  location: string;
  membershipIds: string[];
  materials: PublicSessionMaterial[];
  feedbackEnabled: boolean;
  feedbackSummary: SessionFeedbackSummary;
  accessRestricted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SessionPayload {
  eventId?: string;
  kind?: SessionKind;
  name: string;
  description?: string;
  speakerId?: string | null;
  address?: string;
  eventDayNumber: number;
  startTime?: string;
  endTime?: string;
  location?: string;
  membershipIds?: string[];
  materials?: SessionMaterialPayload[];
  feedbackEnabled?: boolean;
}

export interface PublicSessionFeedbackUser {
  id: string;
  name: string;
  email: string;
}

export interface PublicSessionFeedback {
  id: string;
  sessionId: string;
  userId: string;
  user: PublicSessionFeedbackUser | null;
  rating: number;
  comment: string;
  createdAt: string;
  updatedAt: string;
}

export interface SessionFeedbackSummaryDetail {
  sessionId: string;
  averageRating: number;
  ratingsCount: number;
  ratingDistribution: Record<'1' | '2' | '3' | '4' | '5', number>;
}

export interface UpsertSessionFeedbackPayload {
  rating: number;
  comment?: string;
}

export interface PublicSponsorOfferLink {
  id: string;
  label: string;
  url: string;
}

export interface PublicSponsorOffer {
  id: string;
  offerNumber: number;
  description: string;
  image: string;
  links: PublicSponsorOfferLink[];
}

export interface SponsorOfferLinkPayload {
  id?: string;
  label?: string;
  url: string;
}

export interface SponsorOfferPayload {
  id?: string;
  offerNumber?: number;
  description: string;
  image?: string;
  links?: SponsorOfferLinkPayload[];
}

export interface PublicSponsor {
  id: string;
  eventId: string;
  name: string;
  email: string;
  description: string;
  image: string;
  offers: PublicSponsorOffer[];
  createdAt: string;
  updatedAt: string;
}

export interface SponsorPayload {
  eventId?: string;
  name: string;
  email?: string;
  description?: string;
  image?: string;
  offers?: SponsorOfferPayload[];
}

export type AnnouncementKind = 'manual' | 'system';
export type AnnouncementStatus = 'draft' | 'scheduled' | 'published' | 'cancelled';
export type AudienceType = 'all' | 'roles' | 'users';
export type AnnouncementDelivery = 'immediate' | 'scheduled' | 'draft';
export type CountdownCadence = 'once' | 'daily' | 'weekly';

export interface PublicAnnouncement {
  id: string;
  title: string;
  description: string;
  kind: AnnouncementKind;
  status: AnnouncementStatus;
  audienceType: AudienceType;
  audienceRoles: UserRole[];
  audienceUserIds: string[];
  scheduledAt: string | null;
  publishedAt: string | null;
  sendPush: boolean;
  systemKey: string | null;
  createdAt: string;
  updatedAt: string;
  isRead?: boolean;
}

export interface AnnouncementPayload {
  title: string;
  description?: string;
  delivery: AnnouncementDelivery;
  audienceType?: AudienceType;
  audienceRoles?: UserRole[];
  audienceUserIds?: string[];
  scheduledAt?: string | null;
  sendPush?: boolean;
  status?: AnnouncementStatus;
}

export interface CountdownRule {
  id: string;
  label: string;
  enabled: boolean;
  offsetDays: number;
  cadence: CountdownCadence;
  titleTemplate: string;
  bodyTemplate: string;
}

export interface CountdownSettings {
  id: string;
  enabled: boolean;
  rules: CountdownRule[];
  updatedAt: string;
}

export interface UpdateCountdownSettingsPayload {
  enabled?: boolean;
  rules?: CountdownRule[];
}

export interface PublicPostAuthor {
  id: string;
  name: string;
  photoUrl: string;
}

export interface PublicPost {
  id: string;
  authorId: string;
  author: PublicPostAuthor | null;
  text: string;
  image: string;
  commentsEnabled: boolean;
  likesCount: number;
  commentsCount: number;
  likedByMe: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PostPayload {
  text: string;
  image?: string;
  commentsEnabled?: boolean;
}

export interface PublicPostCommentUser {
  id: string;
  name: string;
  email: string;
}

export interface PublicPostComment {
  id: string;
  postId: string;
  userId: string;
  user: PublicPostCommentUser | null;
  text: string;
  createdAt: string;
  updatedAt: string;
}

export interface PostCommentPayload {
  text: string;
}

export interface PublicStoreCategory {
  id: string;
  eventId: string;
  name: string;
  description: string;
  image: string;
  sortOrder: number;
  isActive: boolean;
  productCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface StoreCategoryPayload {
  eventId?: string;
  name: string;
  description?: string;
  image?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export interface PublicStoreProduct {
  id: string;
  eventId: string;
  categoryId: string | null;
  categoryName: string | null;
  name: string;
  description: string;
  sku: string;
  price: number;
  compareAtPrice: number | null;
  currency: string;
  images: string[];
  trackInventory: boolean;
  stockQty: number;
  lowStockThreshold: number;
  inStock: boolean;
  isLowStock: boolean;
  isActive: boolean;
  featured: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface StoreProductPayload {
  eventId?: string;
  categoryId?: string | null;
  name: string;
  description?: string;
  sku?: string;
  price: number;
  compareAtPrice?: number | null;
  currency?: string;
  images?: string[];
  stockQty?: number;
  lowStockThreshold?: number;
  isActive?: boolean;
  featured?: boolean;
  sortOrder?: number;
}

