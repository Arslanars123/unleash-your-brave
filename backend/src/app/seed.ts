import type { AnnouncementService } from '../modules/announcements/announcement.service.js';
import type { EventService } from '../modules/events/event.service.js';
import type { PostService } from '../modules/posts/post.service.js';
import type { SessionFeedbackService } from '../modules/sessions/feedback/session-feedback.service.js';
import type { SessionService } from '../modules/sessions/session.service.js';
import type { SpeakerService } from '../modules/speakers/speaker.service.js';
import type { SponsorService } from '../modules/sponsors/sponsor.service.js';
import type { MembershipService } from '../modules/memberships/membership.service.js';
import type { UserService } from '../modules/users/user.service.js';
import { logger } from '../core/logger.js';
import { ConflictError } from '../core/errors/app-error.js';

/**
 * Seeds demo accounts + sample event edition with speakers/sessions/sponsors.
 * Safe to call on every boot — existing emails are skipped independently.
 */
export async function seedDemoData(
  userService: UserService,
  eventService: EventService,
  speakerService: SpeakerService,
  sessionService: SessionService,
  sponsorService: SponsorService,
  membershipService: MembershipService,
  sessionFeedbackService: SessionFeedbackService,
  announcementService: AnnouncementService,
  postService: PostService,
): Promise<void> {
  await ensureUser(userService, {
    email: 'admin@unleashyourbrave.com',
    name: 'Platform Admin',
    password: 'Admin123!',
    role: 'admin',
  });

  let eventId: string | null = null;
  const existingEvents = await eventService.list({ page: 1, perPage: 1 });
  if (existingEvents.total === 0) {
    const event = await eventService.create({
      tagline: 'Three days. One transformation.',
      description:
        'A luxury personal development and leadership conference for ambitious women ready to scale and step into their power.',
      days: [
        { date: '2026-09-10', label: 'Day 1' },
        { date: '2026-09-11', label: 'Day 2' },
        { date: '2026-09-12', label: 'Day 3' },
      ],
      venueName: 'The Vinoy',
      venueAddress: '501 5th Ave NE',
      venueCity: 'St. Petersburg, FL',
      latitude: 27.773056,
      longitude: -82.631389,
      coverImage: '',
    });
    eventId = event.id;
    logger.info('Seeded demo event edition');
  } else {
    eventId = existingEvents.items[0]!.id;
  }

  let standardMembershipId: string | null = null;
  let vipMembershipId: string | null = null;
  const existingMemberships = await membershipService.list({ page: 1, perPage: 1, eventId: eventId! });
  if (existingMemberships.total === 0 && eventId) {
    const standard = await membershipService.create({
      eventId,
      name: 'Standard',
      description: 'General admission — access to keynotes and open sessions.',
      valueLink: 'https://example.com/memberships/standard',
      price: 499,
    });
    const vip = await membershipService.create({
      eventId,
      name: 'VIP',
      description: 'VIP access — includes exclusive labs and premium seating.',
      valueLink: 'https://example.com/memberships/vip',
      price: 999,
    });
    standardMembershipId = standard.id;
    vipMembershipId = vip.id;
    logger.info('Seeded demo memberships');
  } else if (eventId) {
    const memberships = await membershipService.list({ page: 1, perPage: 20, eventId });
    standardMembershipId = memberships.items.find((m) => m.name === 'Standard')?.id ?? null;
    vipMembershipId = memberships.items.find((m) => m.name === 'VIP')?.id ?? null;
  }

  await ensureUser(userService, {
    email: 'member@unleashyourbrave.com',
    name: 'magellan.explore1',
    password: 'Member123!',
    role: 'member',
    eventId: eventId!,
    title: 'CTO',
    points: 125,
    profileCompleted: true,
    networkingPrefs: 'open_to_all',
    goals: ['Raise Series A', 'Build community'],
    interests: ['Leadership', 'AI'],
    membershipId: standardMembershipId,
  });

  const existingSpeakers = await speakerService.list({ page: 1, perPage: 1, eventId });
  if (existingSpeakers.total === 0 && eventId) {
    await speakerService.create({
      eventId,
      name: 'Maya Chen',
      title: 'Founder & Keynote Speaker',
      description:
        'Maya helps ambitious leaders build brands that scale with courage. She has advised Fortune 500 teams and founded two lifestyle ventures.',
      photo: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&q=80',
    });
    await speakerService.create({
      eventId,
      name: 'Jordan Blake',
      title: 'Leadership Strategist',
      description:
        'Jordan coaches high-performing women through career pivots and executive presence, with a focus on authentic storytelling.',
      photo: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&q=80',
    });
    logger.info('Seeded demo speakers');
  }

  const existingSessions = await sessionService.list({ page: 1, perPage: 1, eventId: eventId! });
  if (existingSessions.total === 0 && eventId) {
    const speakers = await speakerService.list({ page: 1, perPage: 10, eventId });
    const maya = speakers.items.find((s) => s.name === 'Maya Chen') ?? speakers.items[0];
    const jordan =
      speakers.items.find((s) => s.name === 'Jordan Blake') ?? speakers.items[1] ?? maya;

    if (maya) {
      await sessionService.create({
        eventId,
        name: 'Opening Keynote: Unleash Your Brave',
        description: 'Kick off the gathering with a powerful call to lead with courage.',
        speakerId: maya.id,
        eventDayNumber: 1,
        startTime: '09:00',
        endTime: '10:00',
        location: 'Main Ballroom',
        materials: [
          {
            type: 'link',
            title: 'Keynote worksheet',
            url: 'https://example.com/worksheets/opening-keynote',
          },
          {
            type: 'pdf',
            title: 'Session agenda PDF',
            url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
          },
        ],
      });
    }

    if (jordan) {
      await sessionService.create({
        eventId,
        name: 'Leadership Presence Lab',
        description: 'Practical tools for executive presence and authentic storytelling.',
        speakerId: jordan.id,
        eventDayNumber: 2,
        startTime: '14:00',
        endTime: '15:30',
        location: 'Studio B',
        membershipIds: vipMembershipId ? [vipMembershipId] : [],
        materials: [
          {
            type: 'video',
            title: 'Warm-up video',
            url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          },
          {
            type: 'doc',
            title: 'Lab notes',
            url: 'https://example.com/docs/presence-lab',
          },
        ],
      });
    }

    logger.info('Seeded demo sessions');
  }

  const existingSponsors = await sponsorService.list({ page: 1, perPage: 1, eventId: eventId! });
  if (existingSponsors.total === 0 && eventId) {
    await sponsorService.create({
      eventId,
      name: 'Brave Collective',
      description: 'Lifestyle and leadership partner supporting ambitious women worldwide.',
      image: 'https://images.unsplash.com/photo-1560179707-f14eea528764?w=400&q=80',
      offers: [
        {
          description: '20% off annual membership for Unleash Your Brave attendees.',
          image: '',
          links: [
            { label: 'Claim offer', url: 'https://example.com/offers/membership' },
            { label: 'Learn more', url: 'https://example.com/membership' },
          ],
        },
        {
          description: 'Complimentary brand strategy consult (30 minutes).',
          image: 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=400&q=80',
          links: [{ label: 'Book consult', url: 'https://example.com/consult' }],
        },
      ],
    });
    await sponsorService.create({
      eventId,
      name: 'Lumina Beauty',
      description: 'Clean beauty brand curated for the modern founder.',
      image: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=400&q=80',
      offers: [
        {
          description: 'Free gift with any purchase during the conference weekend.',
          links: [{ label: 'Shop now', url: 'https://example.com/lumina' }],
        },
      ],
    });
    logger.info('Seeded demo sponsors');
  }

  if (eventId) {
    const sessions = await sessionService.list({ page: 1, perPage: 10, eventId });
    const firstSession = sessions.items[0];
    if (firstSession) {
      const summary = await sessionFeedbackService.getSummary(firstSession.id);
      if (summary.ratingsCount === 0) {
        const users = await userService.list({ page: 1, perPage: 50 });
        const member = users.items.find((user) => user.email === 'member@unleashyourbrave.com');
        if (member) {
          await sessionFeedbackService.upsert(firstSession.id, member.id, {
            rating: 5,
            comment: 'Inspiring keynote — left feeling ready to lead with courage.',
          });
          logger.info('Seeded demo session feedback');
        }
      }
    }
  }

  if (eventId) {
    const speakers = await speakerService.list({ page: 1, perPage: 10, eventId });
    const maya = speakers.items.find((s) => s.name === 'Maya Chen') ?? speakers.items[0];
    if (maya) {
      await ensureUser(userService, {
        email: 'speaker@unleashyourbrave.com',
        name: maya.name,
        password: 'Speaker123!',
        role: 'speaker',
        speakerId: maya.id,
      });
    }

    const sponsors = await sponsorService.list({ page: 1, perPage: 10, eventId });
    const brave =
      sponsors.items.find((s) => s.name === 'Brave Collective') ?? sponsors.items[0];
    if (brave) {
      await ensureUser(userService, {
        email: 'sponsor@unleashyourbrave.com',
        name: brave.name,
        password: 'Sponsor123!',
        role: 'sponsor',
        sponsorId: brave.id,
      });
    }
  }

  const existingAnnouncements = await announcementService.list({ page: 1, perPage: 1 });
  if (existingAnnouncements.total === 0) {
    await announcementService.create({
      title: 'Welcome to Unleash Your Brave',
      description:
        'Doors open at 8:30 AM. Grab your badge at registration and join us in the main ballroom for the opening keynote.',
      delivery: 'immediate',
      sendPush: false,
    });
    await announcementService.create({
      title: 'Networking lounge is open',
      description:
        'Meet fellow attendees in the Brave Lounge on Level 2. VIP seating is reserved near the terrace.',
      delivery: 'immediate',
      sendPush: false,
    });
    logger.info('Seeded demo announcements');
  }

  const existingPosts = await postService.list({ page: 1, perPage: 1 });
  if (existingPosts.total === 0) {
    const admins = await userService.list({
      page: 1,
      perPage: 1,
      role: 'admin',
      search: 'admin@unleashyourbrave.com',
    });
    const members = await userService.list({
      page: 1,
      perPage: 1,
      role: 'member',
      search: 'member@unleashyourbrave.com',
    });
    const admin = admins.items[0];
    const member = members.items[0];

    if (admin) {
      const post = await postService.create(admin.id, {
        text: 'The stage is set. Who’s ready to unleash their brave? Drop a comment and tell us what you’re most excited for.',
        image: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200',
        commentsEnabled: true,
      });

      if (member) {
        await postService.like(post.id, member.id);
        await postService.addComment(post.id, member.id, {
          text: 'Can’t wait for the keynote — see you there!',
        });
      }
      logger.info('Seeded demo post with like and comment');
    }
  }
}

async function ensureUser(
  userService: UserService,
  input: {
    email: string;
    name: string;
    password: string;
    role: 'admin' | 'member' | 'speaker' | 'sponsor';
    eventId?: string;
    speakerId?: string;
    sponsorId?: string;
    membershipId?: string | null;
    title?: string;
    points?: number;
    profileCompleted?: boolean;
    networkingPrefs?: 'open_to_all' | 'industry_peers' | 'investors' | 'mentors' | 'closed';
    goals?: string[];
    interests?: string[];
  },
): Promise<void> {
  try {
    await userService.create(input);
    logger.info({ email: input.email, role: input.role }, 'Seeded demo account');
  } catch (error) {
    if (error instanceof ConflictError) {
      logger.debug({ email: input.email }, 'Seed skipped (account already exists)');
      return;
    }
    throw error;
  }
}
