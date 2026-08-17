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
  }): Promise<{ sent: boolean; skipped?: boolean }> {
    const expiresLabel = input.expiresAt.toUTCString();
    const subject = `Your ${env.appName} login code`;
    const text = [
      `Hi ${input.name},`,
      '',
      `Welcome to ${env.appName}.`,
      '',
      `Your one-time login code is: ${input.inviteCode}`,
      '',
      'Open the app, sign in with your email and this code, then set your own password.',
      `This code expires on ${expiresLabel}.`,
      '',
      'If you did not expect this email, you can ignore it.',
    ].join('\n');

    const html = `
      <p>Hi ${escapeHtml(input.name)},</p>
      <p>Welcome to <strong>${escapeHtml(env.appName)}</strong>.</p>
      <p>Your one-time login code is:</p>
      <p style="font-size:24px;font-weight:700;letter-spacing:2px">${escapeHtml(input.inviteCode)}</p>
      <p>Open the app, sign in with your email and this code, then set your own password.</p>
      <p>This code expires on ${escapeHtml(expiresLabel)}.</p>
      <p>If you did not expect this email, you can ignore it.</p>
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
