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
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
