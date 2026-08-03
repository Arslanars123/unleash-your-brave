export const USER_ROLES = ['admin', 'member', 'speaker', 'sponsor'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUSES = ['active', 'suspended'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

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
}
