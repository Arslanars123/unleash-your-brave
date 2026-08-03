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

export type EventEditionStatus = 'upcoming' | 'live' | 'ended';

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
  venueName: string;
  venueAddress: string;
  venueCity: string;
  coverImage: string;
  createdAt: string;
  updatedAt: string;
}

export interface EventWorkspace {
  current: PublicEvent | null;
  canScheduleNew: boolean;
  scheduleBlockedReason: string | null;
  pastEditions: PublicEvent[];
}

export interface EventPayload {
  name: string;
  tagline?: string;
  description?: string;
  days: EventDayPayload[];
  venueName?: string;
  venueAddress?: string;
  venueCity?: string;
  coverImage?: string;
}

export interface ScheduleEventPayload {
  days: EventDayPayload[];
  tagline?: string;
  description?: string;
  venueName?: string;
  venueAddress?: string;
  venueCity?: string;
  coverImage?: string;
  copyDetailsFromPrevious?: boolean;
}

export interface PublicSpeaker {
  id: string;
  eventId: string;
  name: string;
  title: string;
  description: string;
  photo: string;
  createdAt: string;
  updatedAt: string;
}

export interface SpeakerPayload {
  eventId?: string;
  name: string;
  title?: string;
  description?: string;
  photo?: string;
}

export type SessionMaterialType = 'pdf' | 'video' | 'doc' | 'link';

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
  name: string;
  description: string;
  speakerId: string;
  speaker: SessionSpeakerSummary | null;
  eventDayNumber: number;
  startTime: string;
  endTime: string;
  location: string;
  materials: PublicSessionMaterial[];
  feedbackEnabled: boolean;
  feedbackSummary: SessionFeedbackSummary;
  createdAt: string;
  updatedAt: string;
}

export interface SessionPayload {
  eventId?: string;
  name: string;
  description?: string;
  speakerId: string;
  eventDayNumber: number;
  startTime?: string;
  endTime?: string;
  location?: string;
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
  description: string;
  image: string;
  offers: PublicSponsorOffer[];
  createdAt: string;
  updatedAt: string;
}

export interface SponsorPayload {
  eventId?: string;
  name: string;
  description?: string;
  image?: string;
  offers?: SponsorOfferPayload[];
}

export interface PublicAnnouncement {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface AnnouncementPayload {
  title: string;
  description?: string;
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
