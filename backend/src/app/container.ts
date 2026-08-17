import { AccessController } from '../modules/access/access.controller.js';
import { createAccessRouter } from '../modules/access/access.routes.js';
import { EffectiveAccessService } from '../modules/access/access.service.js';
import { AuthController } from '../modules/auth/auth.controller.js';
import { createAuthRouter } from '../modules/auth/auth.routes.js';
import { AuthService } from '../modules/auth/auth.service.js';
import { AnnouncementController } from '../modules/announcements/announcement.controller.js';
import { createAnnouncementRouter } from '../modules/announcements/announcement.routes.js';
import { AnnouncementService } from '../modules/announcements/announcement.service.js';
import { ChatController } from '../modules/chat/chat.controller.js';
import { ChatHub } from '../modules/chat/chat.hub.js';
import { createChatRouter } from '../modules/chat/chat.routes.js';
import { ChatService } from '../modules/chat/chat.service.js';
import { PushNotificationService } from '../modules/chat/push.service.js';
import { CheckInController } from '../modules/checkins/checkin.controller.js';
import { createCheckInRouter } from '../modules/checkins/checkin.routes.js';
import { CheckInService } from '../modules/checkins/checkin.service.js';
import { CouponController } from '../modules/coupons/coupon.controller.js';
import { createCouponRouter } from '../modules/coupons/coupon.routes.js';
import { CouponService } from '../modules/coupons/coupon.service.js';
import { CheckoutController } from '../modules/checkout/checkout.controller.js';
import { createCheckoutRouter } from '../modules/checkout/checkout.routes.js';
import { CheckoutService } from '../modules/checkout/checkout.service.js';
import { EventController } from '../modules/events/event.controller.js';
import { createEventRouter } from '../modules/events/event.routes.js';
import { EventService } from '../modules/events/event.service.js';
import { MailService } from '../modules/mail/mail.service.js';
import { PostController } from '../modules/posts/post.controller.js';
import { createPostRouter } from '../modules/posts/post.routes.js';
import { PostService } from '../modules/posts/post.service.js';
import { SessionFeedbackController } from '../modules/sessions/feedback/session-feedback.controller.js';
import { SessionFeedbackService } from '../modules/sessions/feedback/session-feedback.service.js';
import { SessionController } from '../modules/sessions/session.controller.js';
import { createSessionRouter } from '../modules/sessions/session.routes.js';
import { SessionService } from '../modules/sessions/session.service.js';
import { SpeakerController } from '../modules/speakers/speaker.controller.js';
import { createSpeakerRouter } from '../modules/speakers/speaker.routes.js';
import { SpeakerService } from '../modules/speakers/speaker.service.js';
import { SponsorController } from '../modules/sponsors/sponsor.controller.js';
import { createSponsorRouter } from '../modules/sponsors/sponsor.routes.js';
import { SponsorService } from '../modules/sponsors/sponsor.service.js';
import { MembershipController } from '../modules/memberships/membership.controller.js';
import { createMembershipRouter } from '../modules/memberships/membership.routes.js';
import { MembershipService } from '../modules/memberships/membership.service.js';
import { MembershipLifecycleService } from '../modules/memberships/membership-lifecycle.service.js';
import { UploadController } from '../modules/uploads/upload.controller.js';
import { MediaStorageService } from '../modules/uploads/media-storage.service.js';
import { createUploadRouter } from '../modules/uploads/upload.routes.js';
import { UserController } from '../modules/users/user.controller.js';
import { createUserRouter } from '../modules/users/user.routes.js';
import { UserService } from '../modules/users/user.service.js';
import { GhlWebhookController } from '../modules/webhooks/ghl-webhook.controller.js';
import { createGhlWebhookRouter } from '../modules/webhooks/ghl-webhook.routes.js';
import { GhlWebhookService } from '../modules/webhooks/ghl-webhook.service.js';
import { RealtimeController } from '../modules/realtime/realtime.controller.js';
import { RealtimeHub } from '../modules/realtime/realtime.hub.js';
import { createRealtimeRouter } from '../modules/realtime/realtime.routes.js';
import { connectMongo } from '../db/mongo.js';
import { MongoAnnouncementRepository } from '../db/repositories/mongo-announcement.repository.js';
import { MongoAnnouncementReadRepository } from '../db/repositories/mongo-announcement-read.repository.js';
import { MongoCountdownSettingsRepository } from '../db/repositories/mongo-countdown-settings.repository.js';
import { MongoChatGroupRepository } from '../db/repositories/mongo-chat-group.repository.js';
import { MongoChatMemberStateRepository } from '../db/repositories/mongo-chat-member-state.repository.js';
import { MongoChatMessageRepository } from '../db/repositories/mongo-chat-message.repository.js';
import { MongoChatReactionRepository } from '../db/repositories/mongo-chat-reaction.repository.js';
import { MongoDeviceTokenRepository } from '../db/repositories/mongo-device-token.repository.js';
import { MongoCouponRepository } from '../db/repositories/mongo-coupon.repository.js';
import { MongoCheckInRepository } from '../db/repositories/mongo-checkin.repository.js';
import { MongoEventRepository } from '../db/repositories/mongo-event.repository.js';
import { MongoPostRepository } from '../db/repositories/mongo-post.repository.js';
import { MongoSessionFeedbackRepository } from '../db/repositories/mongo-session-feedback.repository.js';
import { MongoSessionRepository } from '../db/repositories/mongo-session.repository.js';
import { MongoSpeakerRepository } from '../db/repositories/mongo-speaker.repository.js';
import { MongoSponsorRepository } from '../db/repositories/mongo-sponsor.repository.js';
import { MongoMembershipRepository } from '../db/repositories/mongo-membership.repository.js';
import { MongoMembershipPurchaseRepository } from '../db/repositories/mongo-membership-purchase.repository.js';
import { MongoUserRepository } from '../db/repositories/mongo-user.repository.js';
import { seedDemoData } from './seed.js';

/**
 * Manual composition root. Persistence is MongoDB via repository adapters.
 */
export async function createContainer() {
  await connectMongo();

  const userRepository = new MongoUserRepository();
  const eventRepository = new MongoEventRepository();
  const speakerRepository = new MongoSpeakerRepository();
  const sessionRepository = new MongoSessionRepository();
  const sessionFeedbackRepository = new MongoSessionFeedbackRepository();
  const sponsorRepository = new MongoSponsorRepository();
  const membershipRepository = new MongoMembershipRepository();
  const membershipPurchaseRepository = new MongoMembershipPurchaseRepository();
  await membershipPurchaseRepository.ensureIndexes();
  const announcementRepository = new MongoAnnouncementRepository();
  const announcementReadRepository = new MongoAnnouncementReadRepository();
  const countdownSettingsRepository = new MongoCountdownSettingsRepository();
  const checkInRepository = new MongoCheckInRepository();
  await checkInRepository.ensureIndexes();
  const postRepository = new MongoPostRepository();
  const chatGroupRepository = new MongoChatGroupRepository();
  const chatMessageRepository = new MongoChatMessageRepository();
  const chatMemberStateRepository = new MongoChatMemberStateRepository();
  const chatReactionRepository = new MongoChatReactionRepository();
  const deviceTokenRepository = new MongoDeviceTokenRepository();
  const mailService = new MailService();

  const userService = new UserService(
    userRepository,
    speakerRepository,
    sponsorRepository,
    membershipRepository,
  );
  const authService = new AuthService(userRepository, userService, mailService);
  const eventService = new EventService(eventRepository);
  const membershipService = new MembershipService(membershipRepository, eventService);
  const effectiveAccessService = new EffectiveAccessService(
    userRepository,
    membershipRepository,
    eventService,
  );
  const speakerService = new SpeakerService(speakerRepository, eventService, userService, mailService);
  const sessionService = new SessionService(
    sessionRepository,
    speakerRepository,
    eventService,
    sessionFeedbackRepository,
    userRepository,
    membershipRepository,
    effectiveAccessService,
  );
  const sessionFeedbackService = new SessionFeedbackService(
    sessionFeedbackRepository,
    sessionRepository,
    userRepository,
  );
  const sponsorService = new SponsorService(sponsorRepository, eventService, userService, mailService);
  const pushNotificationService = new PushNotificationService(deviceTokenRepository);
  const membershipLifecycleService = new MembershipLifecycleService(
    userRepository,
    membershipRepository,
    mailService,
    pushNotificationService,
  );
  const announcementService = new AnnouncementService(
    announcementRepository,
    announcementReadRepository,
    countdownSettingsRepository,
    userRepository,
    eventService,
    pushNotificationService,
  );
  const couponRepository = new MongoCouponRepository();
  await couponRepository.ensureIndexes();
  const couponService = new CouponService(
    couponRepository,
    membershipRepository,
    announcementService,
  );
  const realtimeHub = new RealtimeHub();
  const checkoutService = new CheckoutService(
    membershipPurchaseRepository,
    membershipRepository,
    userRepository,
    userService,
    eventService,
    mailService,
    realtimeHub,
    couponService,
  );
  const checkInService = new CheckInService(
    checkInRepository,
    userRepository,
    eventService,
    membershipRepository,
    checkoutService,
    effectiveAccessService,
  );
  const postService = new PostService(postRepository, userRepository);
  const chatHub = new ChatHub();
  const chatService = new ChatService(
    chatGroupRepository,
    chatMessageRepository,
    chatMemberStateRepository,
    chatReactionRepository,
    userRepository,
    chatHub,
    pushNotificationService,
  );
  const ghlWebhookService = new GhlWebhookService(userService, realtimeHub, mailService);

  const userController = new UserController(userService, checkoutService);
  const authController = new AuthController(authService);
  const eventController = new EventController(eventService);
  const speakerController = new SpeakerController(speakerService);
  const sessionController = new SessionController(sessionService);
  const sessionFeedbackController = new SessionFeedbackController(sessionFeedbackService);
  const sponsorController = new SponsorController(sponsorService);
  const membershipController = new MembershipController(membershipService);
  const couponController = new CouponController(couponService);
  const accessController = new AccessController(effectiveAccessService);
  const checkoutController = new CheckoutController(checkoutService);
  const announcementController = new AnnouncementController(announcementService);
  const checkInController = new CheckInController(checkInService);
  const postController = new PostController(postService);
  const chatController = new ChatController(chatService, chatHub, pushNotificationService);
  const ghlWebhookController = new GhlWebhookController(ghlWebhookService);
  const realtimeController = new RealtimeController(realtimeHub);
  const mediaStorage = new MediaStorageService();
  const uploadController = new UploadController(mediaStorage);

  await seedDemoData(
    userService,
    eventService,
    speakerService,
    sessionService,
    sponsorService,
    membershipService,
    sessionFeedbackService,
    announcementService,
    postService,
  );

  await chatService.ensureGroup();

  return {
    controllers: {
      checkout: checkoutController,
    },
    routers: {
      auth: createAuthRouter(authController),
      users: createUserRouter(userController),
      events: createEventRouter(eventController),
      speakers: createSpeakerRouter(speakerController),
      sessions: createSessionRouter(sessionController, sessionFeedbackController),
      sponsors: createSponsorRouter(sponsorController),
      memberships: createMembershipRouter(membershipController),
      coupons: createCouponRouter(couponController),
      access: createAccessRouter(accessController),
      checkout: createCheckoutRouter(checkoutController),
      announcements: createAnnouncementRouter(announcementController),
      checkins: createCheckInRouter(checkInController),
      posts: createPostRouter(postController),
      uploads: createUploadRouter(uploadController),
      webhooks: createGhlWebhookRouter(ghlWebhookController),
      realtime: createRealtimeRouter(realtimeController),
      chat: createChatRouter(chatController),
    },
    services: {
      userService,
      authService,
      eventService,
      speakerService,
      sessionService,
      sessionFeedbackService,
      sponsorService,
      membershipService,
      membershipLifecycleService,
      checkoutService,
      announcementService,
      checkInService,
      postService,
      chatService,
      pushNotificationService,
      ghlWebhookService,
      realtimeHub,
      chatHub,
      mailService,
    },
  };
}

export type Container = Awaited<ReturnType<typeof createContainer>>;
