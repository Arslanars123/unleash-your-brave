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
  }): Promise<{ sent: boolean; skipped?: boolean }> {
    const expiresLabel = input.expiresAt.toUTCString();
    const subject = `Your ${env.appName} login code`;
    const setupLines = input.dualAccess
      ? [
          'Use this code to finish setting up your password.',
          'The same email and password will work for both the mobile app and the speaker/sponsor dashboard, with the access roles assigned to your account.',
        ]
      : [
          'Open the app, sign in with your email and this code, then set your own password.',
          'If you also have dashboard access, the same password will work there too.',
        ];

    const text = [
      `Hi ${input.name},`,
      '',
      `Welcome to ${env.appName}.`,
      '',
      `Your one-time login code is: ${input.inviteCode}`,
      '',
      ...setupLines,
      `This code expires on ${expiresLabel}.`,
      '',
      'Any previous unused login code for this email is no longer valid.',
      '',
      'If you did not expect this email, you can ignore it.',
    ].join('\n');

    const html = `
      <p>Hi ${escapeHtml(input.name)},</p>
      <p>Welcome to <strong>${escapeHtml(env.appName)}</strong>.</p>
      <p>Your one-time login code is:</p>
      <p style="font-size:24px;font-weight:700;letter-spacing:2px">${escapeHtml(input.inviteCode)}</p>
      ${setupLines.map((line) => `<p>${escapeHtml(line)}</p>`).join('\n')}
      <p>This code expires on ${escapeHtml(expiresLabel)}.</p>
      <p>Any previous unused login code for this email is no longer valid.</p>
      <p>If you did not expect this email, you can ignore it.</p>
    `;

    return this.send({ to: input.to, subject, text, html });
  }

  async sendExistingAccountMembershipAccess(input: {
    to: string;
    name: string;
    membershipName: string;
    role: string;
    speakerId?: string | null;
    sponsorId?: string | null;
    eventName?: string;
    mustChangePassword?: boolean;
  }): Promise<{ sent: boolean; skipped?: boolean }> {
    const parts: string[] = [];
    if (input.speakerId || input.role === 'speaker') parts.push('speaker');
    if (input.sponsorId || input.role === 'sponsor') parts.push('sponsor');
    const roleLabel =
      parts.length > 0 ? parts.join(' and ') : input.role === 'member' ? 'attendee' : 'account';

    const registrationLine = input.eventName
      ? `You've been registered for ${input.eventName} on your existing ${roleLabel} account.`
      : `Your ${input.membershipName} membership is now active on your existing ${roleLabel} account.`;

    const subject = input.eventName
      ? `You're registered for ${input.eventName} — use your existing login`
      : `Your ${env.appName} membership is ready — use your existing login`;

    const loginLines = input.mustChangePassword
      ? [
          'You do not need a new invitation code.',
          'If you have not set a password yet, open the app or dashboard and choose Forgot password with this email to create one.',
          'If you already have a password, sign in with the same email and password you use today.',
        ]
      : [
          'You do not need a new invitation code.',
          'Sign in to the mobile app with the same email address and password you already use.',
          parts.length > 0
            ? `That login also continues to work for your ${roleLabel} dashboard access.`
            : 'The same login works for the app and dashboard when you have dashboard access.',
        ];

    const text = [
      `Hi ${input.name},`,
      '',
      registrationLine,
      '',
      ...loginLines,
      '',
      'If you forgot your password, use Forgot password in the app or dashboard.',
      '',
      'If you did not expect this email, you can ignore it.',
    ].join('\n');

    const html = `
      <p>Hi ${escapeHtml(input.name)},</p>
      <p>${escapeHtml(registrationLine)}</p>
      <p><strong>You do not need a new invitation code.</strong></p>
      ${loginLines.slice(1).map((line) => `<p>${escapeHtml(line)}</p>`).join('\n')}
      <p>If you forgot your password, use Forgot password in the app or dashboard.</p>
      <p>If you did not expect this email, you can ignore it.</p>
    `;

    return this.send({ to: input.to, subject, text, html });
  }

  async sendExistingAccountPortalAccess(input: {
    to: string;
    name: string;
    portalRole: 'speaker' | 'sponsor';
    mustChangePassword?: boolean;
  }): Promise<{ sent: boolean; skipped?: boolean }> {
    const roleLabel = input.portalRole;
    const subject = `Your ${env.appName} ${roleLabel} dashboard access is ready`;

    const loginLines = input.mustChangePassword
      ? [
          'You do not need a new invitation code.',
          'If you have not set a password yet, open the app or dashboard and choose Forgot password with this email to create one.',
          'If you already have a password, sign in with the same email and password you use today.',
        ]
      : [
          'You do not need a new invitation code.',
          'Sign in to the dashboard with the same email and password you already use for the mobile app.',
          'Your attendee/membership access (if any) remains on the same login.',
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
      <p><strong>You do not need a new invitation code.</strong></p>
      ${loginLines.slice(1).map((line) => `<p>${escapeHtml(line)}</p>`).join('\n')}
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
