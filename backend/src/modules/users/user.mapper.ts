import type { PublicUser, User } from './user.types.js';
import { EMPTY_ATTENDEE_PROFILE } from './user.types.js';

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    fullName: user.name,
    role: user.role,
    status: user.status,
    speakerId: user.speakerId,
    sponsorId: user.sponsorId,
    photoUrl: user.photoUrl,
    title: user.title,
    business: user.business,
    industry: user.industry,
    location: user.location,
    bio: user.bio,
    goals: [...user.goals],
    interests: [...user.interests],
    networkingPrefs: user.networkingPrefs,
    linkedinUrl: user.linkedinUrl,
    instagramUrl: user.instagramUrl,
    websiteUrl: user.websiteUrl,
    isVip: user.isVip,
    points: user.points,
    profileCompleted: user.profileCompleted,
    mustChangePassword: user.mustChangePassword,
    ghlContactId: user.ghlContactId,
    firstName: user.firstName,
    lastName: user.lastName,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export function withDefaultProfile<T extends Partial<typeof EMPTY_ATTENDEE_PROFILE>>(
  input: T = {} as T,
): typeof EMPTY_ATTENDEE_PROFILE {
  return {
    ...EMPTY_ATTENDEE_PROFILE,
    ...input,
    goals: input.goals ? [...input.goals] : [],
    interests: input.interests ? [...input.interests] : [],
  };
}
