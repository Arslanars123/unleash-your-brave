import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { env } from '../../config/env.js';
import { logger } from '../../core/logger.js';

export interface SendMailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export class MailService {
  private transporter: Transporter | null = null;

  get enabled(): boolean {
    return Boolean(env.smtp.host && env.smtp.user && env.smtp.pass && env.smtp.from);
  }

  private getTransporter(): Transporter {
    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host: env.smtp.host,
        port: env.smtp.port,
        secure: env.smtp.secure,
        auth: {
          user: env.smtp.user,
          pass: env.smtp.pass,
        },
      });
    }
    return this.transporter;
  }

  async send(input: SendMailInput): Promise<{ sent: boolean; skipped?: boolean }> {
    if (!this.enabled) {
      logger.warn(
        { to: input.to, subject: input.subject },
        'SMTP not configured — email skipped',
      );
      return { sent: false, skipped: true };
    }

    await this.getTransporter().sendMail({
      from: env.smtp.from,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });

    logger.info({ to: input.to, subject: input.subject }, 'Email sent');
    return { sent: true };
  }

  async sendInviteCode(input: {
    to: string;
    name: string;
    inviteCode: string;
    expiresAt: Date;
    /** Speaker/sponsor (or dual) accounts — same code unlocks app + dashboard. */
    dualAccess?: boolean;
    eventName?: string;
    membershipName?: string;
    /** Existing portal / attendee roles on this account (for clearer copy). */
    isSpeaker?: boolean;
    isSponsor?: boolean;
    isAttendee?: boolean;
  }): Promise<{ sent: boolean; skipped?: boolean }> {
    const expiresLabel = input.expiresAt.toUTCString();
    const hasEvent = Boolean(input.eventName?.trim());
    const membershipLabel = input.membershipName?.trim() || '';
    const isSpeaker = Boolean(input.isSpeaker);
    const isSponsor = Boolean(input.isSponsor);
    const isAttendee = Boolean(input.isAttendee) || hasEvent;

    const accessParts: string[] = [];
    if (isAttendee) accessParts.push('attendee (mobile app)');
    if (isSpeaker) accessParts.push('speaker dashboard');
    if (isSponsor) accessParts.push('sponsor dashboard');
    const accessLabel = accessParts.length > 0 ? joinNatural(accessParts) : '';

    const subject = hasEvent
      ? membershipLabel
        ? `${membershipLabel} for ${input.eventName} — your login code`
        : `You're registered for ${input.eventName} — your login code`
      : `Your ${env.appName} login code`;

    const membershipForEventLine =
      hasEvent && membershipLabel
        ? `You have the ${membershipLabel} membership for ${input.eventName}.`
        : hasEvent
          ? `You've been registered as an attendee for ${input.eventName}.`
          : '';

    const introLines = hasEvent
      ? [
          membershipForEventLine,
          ...(accessLabel
            ? [
                `This email has ${accessLabel} access on one account.`,
                'Use the code below to set your password. The same email and password will work for the mobile app and any speaker/sponsor dashboard access on this account.',
              ]
            : [
                'Use the one-time login code below to open the app, set your password, and access your booking.',
              ]),
        ]
      : accessLabel
        ? [
            `Welcome to ${env.appName}.`,
            `This email has ${accessLabel} access on one account.`,
            'Use this code to finish setting up your password.',
            'After you set it, the same email and password will work for the mobile app (attendee) and the speaker/sponsor dashboard.',
          ]
        : input.dualAccess
          ? [
              `Welcome to ${env.appName}.`,
              'Use this code to finish setting up your password.',
              'The same email and password will work for both the mobile app and the speaker/sponsor dashboard.',
            ]
          : [
              `Welcome to ${env.appName}.`,
              'Open the app, sign in with your email and this code, then set your own password.',
              'If you also have dashboard access, the same password will work there too.',
            ];

    const text = [
      `Hi ${input.name},`,
      '',
      ...introLines,
      '',
      `Your one-time login code is: ${input.inviteCode}`,
      '',
      `This code expires on ${expiresLabel}.`,
      '',
      'Any previous unused login code for this email is no longer valid.',
      '',
      'If you did not expect this email, you can ignore it.',
    ].join('\n');

    const html = `
      <p>Hi ${escapeHtml(input.name)},</p>
      ${introLines.map((line) => `<p>${escapeHtml(line)}</p>`).join('\n')}
      <p>Your one-time login code is:</p>
      <p style="font-size:24px;font-weight:700;letter-spacing:2px">${escapeHtml(input.inviteCode)}</p>
      <p>This code expires on ${escapeHtml(expiresLabel)}.</p>
      <p>Any previous unused login code for this email is no longer valid.</p>
      <p>If you did not expect this email, you can ignore it.</p>
    `;

    return this.send({ to: input.to, subject, text, html });
  }

  /**
   * Existing account already has a password — tell them about new attendee/event access.
   */
  async sendExistingAccountMembershipAccess(input: {
    to: string;
    name: string;
    membershipName: string;
    role: string;
    speakerId?: string | null;
    sponsorId?: string | null;
    eventName?: string;
    /** @deprecated Prefer invite-code emails when password is not set yet. */
    mustChangePassword?: boolean;
  }): Promise<{ sent: boolean; skipped?: boolean }> {
    const isSpeaker = Boolean(input.speakerId) || input.role === 'speaker';
    const isSponsor = Boolean(input.sponsorId) || input.role === 'sponsor';
    const portalParts: string[] = [];
    if (isSpeaker) portalParts.push('speaker');
    if (isSponsor) portalParts.push('sponsor');
    const portalLabel = portalParts.join(' and ');
    const membershipLabel = input.membershipName.trim() || 'your membership';
    const eventLabel = input.eventName?.trim();

    const subject = eventLabel
      ? `${membershipLabel} for ${eventLabel} — use your existing password`
      : `Your ${env.appName} membership is ready — use your existing password`;

    const accessLines: string[] = [];
    if (eventLabel) {
      accessLines.push(`You have the ${membershipLabel} membership for ${eventLabel}.`);
    } else {
      accessLines.push(`Your ${membershipLabel} membership is now active on your existing account.`);
    }

    if (portalLabel) {
      accessLines.push(
        `You already have ${portalLabel} access on this email. You can use the same email and password for the mobile app (attendee) and the ${portalLabel} dashboard.`,
      );
    } else {
      accessLines.push(
        'Sign in to the mobile app with the same email address and password you already use.',
      );
    }

    accessLines.push('You do not need a new invitation code.');
    accessLines.push(
      'If you forgot your password, use Forgot password in the app or dashboard.',
    );

    const text = [
      `Hi ${input.name},`,
      '',
      ...accessLines,
      '',
      'If you did not expect this email, you can ignore it.',
    ].join('\n');

    const html = `
      <p>Hi ${escapeHtml(input.name)},</p>
      ${accessLines.map((line) => `<p>${escapeHtml(line)}</p>`).join('\n')}
      <p>If you did not expect this email, you can ignore it.</p>
    `;

    return this.send({ to: input.to, subject, text, html });
  }

  async sendExistingAccountPortalAccess(input: {
    to: string;
    name: string;
    portalRole: 'speaker' | 'sponsor';
    mustChangePassword?: boolean;
    isAttendee?: boolean;
    isSpeaker?: boolean;
    isSponsor?: boolean;
  }): Promise<{ sent: boolean; skipped?: boolean }> {
    const roleLabel = input.portalRole;
    const subject = `Your ${env.appName} ${roleLabel} dashboard access is ready`;

    const accessParts: string[] = [];
    if (input.isAttendee) accessParts.push('attendee (mobile app)');
    if (input.isSpeaker || roleLabel === 'speaker') accessParts.push('speaker dashboard');
    if (input.isSponsor || roleLabel === 'sponsor') accessParts.push('sponsor dashboard');
    // Deduplicate while preserving order
    const uniqueAccess = [...new Set(accessParts)];
    const accessLabel = uniqueAccess.length > 0 ? joinNatural(uniqueAccess) : roleLabel;

    const loginLines = input.mustChangePassword
      ? [
          `This email has ${accessLabel} access on one account.`,
          'A password has not been set yet. Use Forgot password with this email to create one, then sign in.',
          'After that, the same login works for the mobile app and dashboard.',
        ]
      : [
          `This email has ${accessLabel} access on one account.`,
          'You do not need a new invitation code.',
          'Sign in with the same email and password you already use — it works for the mobile app (attendee) and the dashboard.',
        ];

    const text = [
      `Hi ${input.name},`,
      '',
      `You now have ${roleLabel} access on your existing account.`,
      '',
      ...loginLines,
      '',
      'If you forgot your password, use Forgot password in the app or dashboard.',
    ].join('\n');

    const html = `
      <p>Hi ${escapeHtml(input.name)},</p>
      <p>You now have <strong>${escapeHtml(roleLabel)}</strong> access on your existing account.</p>
      ${loginLines.map((line) => `<p>${escapeHtml(line)}</p>`).join('\n')}
      <p>If you forgot your password, use Forgot password in the app or dashboard.</p>
    `;

    return this.send({ to: input.to, subject, text, html });
  }

  async sendMembershipPurchaseConfirmation(input: {
    to: string;
    name: string;
    eventName: string;
    membershipName: string;
    previousMembershipName: string | null;
    kind: 'purchase' | 'upgrade' | 'renew';
    priceLabel: string;
    purchasedAt: Date;
    stripePaymentIntentId: string | null;
    periodEnd?: Date | null;
  }): Promise<{ sent: boolean; skipped?: boolean }> {
    const when = input.purchasedAt.toUTCString();
    const isUpgrade = input.kind === 'upgrade' && input.previousMembershipName;
    const isRenew = input.kind === 'renew';
    const upgradeLine = isUpgrade
      ? `${input.previousMembershipName} → ${input.membershipName}`
      : input.membershipName;

    const subject = isUpgrade
      ? `Membership upgraded: ${upgradeLine}`
      : isRenew
        ? `Membership renewed: ${input.membershipName}`
        : `Membership confirmed: ${input.membershipName}`;

    const intro = isUpgrade
      ? `Your ${env.appName} membership has been upgraded.`
      : isRenew
        ? `Your ${env.appName} membership has been renewed.`
        : `Thank you for your ${env.appName} membership purchase.`;

    const expiresLine = input.periodEnd
      ? `Valid until: ${input.periodEnd.toUTCString()}`
      : null;

    const text = [
      `Hi ${input.name},`,
      '',
      intro,
      '',
      isUpgrade ? `Upgrade: ${upgradeLine}` : `Membership: ${input.membershipName}`,
      `Event: ${input.eventName}`,
      `Amount: ${input.priceLabel}`,
      `Date: ${when}`,
      expiresLine,
      input.stripePaymentIntentId ? `Transaction: ${input.stripePaymentIntentId}` : null,
      '',
      'If you have any questions, reply to this email.',
    ]
      .filter((line) => line !== null)
      .join('\n');

    const html = `
      <p>Hi ${escapeHtml(input.name)},</p>
      <p>${escapeHtml(intro)}</p>
      <p style="font-size:18px;font-weight:700">${escapeHtml(upgradeLine)}</p>
      <ul>
        <li><strong>Event:</strong> ${escapeHtml(input.eventName)}</li>
        <li><strong>Amount:</strong> ${escapeHtml(input.priceLabel)}</li>
        <li><strong>Date:</strong> ${escapeHtml(when)}</li>
        ${
          input.periodEnd
            ? `<li><strong>Valid until:</strong> ${escapeHtml(input.periodEnd.toUTCString())}</li>`
            : ''
        }
        ${
          input.stripePaymentIntentId
            ? `<li><strong>Transaction:</strong> ${escapeHtml(input.stripePaymentIntentId)}</li>`
            : ''
        }
      </ul>
      <p>If you have any questions, reply to this email.</p>
    `;

    return this.send({ to: input.to, subject, text, html });
  }

  async sendSpeakerSessionAssigned(input: {
    to: string;
    name: string;
    eventName: string;
    sessionName: string;
    sessionDescription?: string;
    dayLabel?: string;
    startTime?: string;
    endTime?: string;
    location?: string;
  }): Promise<{ sent: boolean; skipped?: boolean }> {
    const eventLabel = input.eventName.trim();
    const sessionLabel = input.sessionName.trim();
    const subject = `You've been assigned to "${sessionLabel}" — ${eventLabel}`;

    const detailLines: string[] = [
      `You've been assigned as a speaker to a session for ${eventLabel}.`,
      '',
      `Session: ${sessionLabel}`,
    ];
    if (input.sessionDescription?.trim()) {
      detailLines.push(`Description: ${input.sessionDescription.trim()}`);
    }
    if (input.dayLabel?.trim()) {
      detailLines.push(`Day: ${input.dayLabel.trim()}`);
    }
    if (input.startTime?.trim() || input.endTime?.trim()) {
      const time =
        input.startTime?.trim() && input.endTime?.trim()
          ? `${input.startTime.trim()} – ${input.endTime.trim()}`
          : input.startTime?.trim() || input.endTime?.trim() || '';
      if (time) detailLines.push(`Time: ${time}`);
    }
    if (input.location?.trim()) {
      detailLines.push(`Location: ${input.location.trim()}`);
    }
    detailLines.push(
      '',
      'Sign in to the speaker dashboard with your email to review this session.',
      'If you have not set a password yet, use the invite code from your earlier email, or Forgot password.',
    );

    const text = [`Hi ${input.name},`, '', ...detailLines].join('\n');
    const html = `
      <p>Hi ${escapeHtml(input.name)},</p>
      <p>You've been assigned as a speaker to a session for <strong>${escapeHtml(eventLabel)}</strong>.</p>
      <p><strong>Session:</strong> ${escapeHtml(sessionLabel)}</p>
      ${input.sessionDescription?.trim() ? `<p><strong>Description:</strong> ${escapeHtml(input.sessionDescription.trim())}</p>` : ''}
      ${input.dayLabel?.trim() ? `<p><strong>Day:</strong> ${escapeHtml(input.dayLabel.trim())}</p>` : ''}
      ${
        input.startTime?.trim() || input.endTime?.trim()
          ? `<p><strong>Time:</strong> ${escapeHtml(
              [input.startTime?.trim(), input.endTime?.trim()].filter(Boolean).join(' – '),
            )}</p>`
          : ''
      }
      ${input.location?.trim() ? `<p><strong>Location:</strong> ${escapeHtml(input.location.trim())}</p>` : ''}
      <p>Sign in to the speaker dashboard with your email to review this session.</p>
      <p>If you have not set a password yet, use the invite code from your earlier email, or Forgot password.</p>
    `;

    return this.send({ to: input.to, subject, text, html });
  }

  async sendSponsorEventAssigned(input: {
    to: string;
    name: string;
    eventName: string;
  }): Promise<{ sent: boolean; skipped?: boolean }> {
    const eventLabel = input.eventName.trim();
    const subject = `You're a sponsor for ${eventLabel}`;
    const text = [
      `Hi ${input.name},`,
      '',
      `You've been added as a sponsor for ${eventLabel}.`,
      '',
      'Sign in to the sponsor dashboard with your email to manage your sponsorship for this event.',
      'If you have not set a password yet, use the invite code from your earlier email, or Forgot password.',
      '',
      'If you did not expect this email, you can ignore it.',
    ].join('\n');
    const html = `
      <p>Hi ${escapeHtml(input.name)},</p>
      <p>You've been added as a sponsor for <strong>${escapeHtml(eventLabel)}</strong>.</p>
      <p>Sign in to the sponsor dashboard with your email to manage your sponsorship for this event.</p>
      <p>If you have not set a password yet, use the invite code from your earlier email, or Forgot password.</p>
      <p>If you did not expect this email, you can ignore it.</p>
    `;
    return this.send({ to: input.to, subject, text, html });
  }

  async sendMembershipRenewalReminder(input: {
    to: string;
    name: string;
    membershipName: string;
    expiresAt: Date;
    urgency?: 'upcoming' | 'final';
  }): Promise<{ sent: boolean; skipped?: boolean }> {
    const expiresLabel = input.expiresAt.toUTCString();
    const isFinal = input.urgency === 'final';
    const subject = isFinal
      ? `Final reminder: renew your ${env.appName} membership`
      : `Renew your ${env.appName} membership`;
    const lead = isFinal
      ? `Your ${input.membershipName} membership expires very soon (${expiresLabel}).`
      : `Your ${input.membershipName} membership expires on ${expiresLabel}.`;
    const text = [
      `Hi ${input.name},`,
      '',
      lead,
      '',
      'Renew now to keep your membership active and your event check-in QR enabled.',
      'If payment is still pending, complete checkout in the app to finish renewal.',
      '',
      'Open the app → Profile → renew your membership.',
      '',
      'If you already renewed, you can ignore this email.',
    ].join('\n');

    const html = `
      <p>Hi ${escapeHtml(input.name)},</p>
      <p>${escapeHtml(lead)}</p>
      <p>Renew now to keep your membership active and your event check-in QR enabled.</p>
      <p>If payment is still pending, complete checkout in the app to finish renewal.</p>
      <p>Open the app → Profile → renew your membership.</p>
      <p>If you already renewed, you can ignore this email.</p>
    `;

    return this.send({ to: input.to, subject, text, html });
  }

  async sendMembershipExpiredNotice(input: {
    to: string;
    name: string;
    membershipName: string;
  }): Promise<{ sent: boolean; skipped?: boolean }> {
    const subject = `Your ${env.appName} membership has expired`;
    const text = [
      `Hi ${input.name},`,
      '',
      `Your ${input.membershipName} membership has expired, and renewal payment is still pending.`,
      '',
      'Your check-in QR will only become valid again after you complete renewal payment in the app.',
      '',
      'Open the app → Profile → renew your membership.',
    ].join('\n');

    const html = `
      <p>Hi ${escapeHtml(input.name)},</p>
      <p>Your <strong>${escapeHtml(input.membershipName)}</strong> membership has expired, and renewal payment is still pending.</p>
      <p>Your check-in QR will only become valid again after you complete renewal payment in the app.</p>
      <p>Open the app → Profile → renew your membership.</p>
    `;

    return this.send({ to: input.to, subject, text, html });
  }

  async sendPasswordResetOtp(input: {
    to: string;
    name: string;
    otp: string;
    expiresInMinutes: number;
  }): Promise<{ sent: boolean; skipped?: boolean }> {
    const subject = `Your ${env.appName} password reset code`;
    const text = [
      `Hi ${input.name},`,
      '',
      `We received a request to reset your ${env.appName} password.`,
      '',
      `Your verification code is: ${input.otp}`,
      '',
      `This code expires in ${input.expiresInMinutes} minutes.`,
      '',
      'If you did not request this, you can ignore this email.',
    ].join('\n');

    const html = `
      <p>Hi ${escapeHtml(input.name)},</p>
      <p>We received a request to reset your <strong>${escapeHtml(env.appName)}</strong> password.</p>
      <p>Your verification code is:</p>
      <p style="font-size:24px;font-weight:700;letter-spacing:4px">${escapeHtml(input.otp)}</p>
      <p>This code expires in ${input.expiresInMinutes} minutes.</p>
      <p>If you did not request this, you can ignore this email.</p>
    `;

    return this.send({ to: input.to, subject, text, html });
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function joinNatural(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? '';
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;
}
