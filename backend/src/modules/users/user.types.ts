export const USER_ROLES = ['admin', 'member', 'speaker', 'sponsor'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUSES = ['active', 'suspended'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

/** Lifecycle of the attendee’s current membership entitlement (payment period). */
export const MEMBERSHIP_STATUSES = ['active', 'expired'] as const;
export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];

export const DASHBOARD_ROLES = ['admin', 'speaker', 'sponsor'] as const;
export type DashboardRole = (typeof DASHBOARD_ROLES)[number];

export const NETWORKING_PREFS = [
  'open_to_all',
  'industry_peers',
  'investors',
  'mentors',
  'closed',
] as const;
export type NetworkingPref = (typeof NETWORKING_PREFS)[number];

/** Attendee profile fields (primarily for `member` role). */
export interface AttendeeProfile {
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
}

export const EMPTY_ATTENDEE_PROFILE: AttendeeProfile = {
  photoUrl: '',
  title: '',
  business: '',
  industry: '',
  location: '',
  bio: '',
  goals: [],
  interests: [],
  networkingPrefs: 'open_to_all',
  linkedinUrl: '',
  instagramUrl: '',
  websiteUrl: '',
  isVip: false,
  points: 0,
  profileCompleted: false,
};

/** Internal representation. Never leaves the service layer as-is. */
export interface User {
  id: string;
  email: string;
  /** Full name (attendee `full_name`). */
  name: string;
  role: UserRole;
  status: UserStatus;
  /** Linked speaker profile when role is `speaker`. */
  speakerId: string | null;
  /** Linked sponsor profile when role is `sponsor`. */
  sponsorId: string | null;
  /** Membership tier for `member` role. */
  membershipId: string | null;
  /**
   * Payment/lifecycle status for the current membership.
   * `null` for legacy users without an expiry cycle (treated as active when they have a membership).
   */
  membershipStatus: MembershipStatus | null;
  /** When the current renewable period ends. `null` = no expiry (one-time / legacy). */
  membershipExpiresAt: Date | null;
  /** Last time a renewal reminder was sent for the current period. */
  renewalReminderSentAt: Date | null;
  /** Last time we notified that QR is blocked until renewal payment. */
  qrRenewalBlockedNoticeSentAt: Date | null;
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
  passwordHash: string;
  /** Hashed one-time invite / login code from purchase email. */
  inviteCodeHash: string | null;
  inviteCodeExpiresAt: Date | null;
  /** Hashed 6-digit OTP for forgot-password flow. */
  passwordResetOtpHash: string | null;
  passwordResetOtpExpiresAt: Date | null;
  /** True until the attendee sets their own password after invite login. */
  mustChangePassword: boolean;
  /** GoHighLevel contact id when created/updated via purchase webhook. */
  ghlContactId: string | null;
  firstName: string;
  lastName: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Shape returned over the wire. */
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
  membershipStatus: MembershipStatus | null;
  membershipExpiresAt: string | null;
  renewalReminderSentAt: string | null;
  qrRenewalBlockedNoticeSentAt: string | null;
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
  mustChangePassword: boolean;
  ghlContactId: string | null;
  firstName: string;
  lastName: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserInput {
  email: string;
  name: string;
  password: string;
  role?: UserRole;
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
  status?: UserStatus;
}

export interface UpdateUserInput {
  name?: string;
  email?: string;
  password?: string;
  role?: UserRole;
  status?: UserStatus;
  speakerId?: string | null;
  sponsorId?: string | null;
  membershipId?: string | null;
  membershipStatus?: MembershipStatus | null;
  membershipExpiresAt?: Date | null;
  renewalReminderSentAt?: Date | null;
  qrRenewalBlockedNoticeSentAt?: Date | null;
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

export interface ListUsersQuery {
  page: number;
  perPage: number;
  search?: string;
  role?: UserRole;
  status?: UserStatus;
  /** When true: members + any role that holds a membership (speaker/sponsor attendees). */
  attendeesOnly?: boolean;
}
