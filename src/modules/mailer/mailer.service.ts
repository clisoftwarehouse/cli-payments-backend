import { Resend } from 'resend';
import fs from 'node:fs/promises';
import Handlebars from 'handlebars';
import { ConfigService } from '@nestjs/config';
import { Logger, Injectable } from '@nestjs/common';

import { AllConfigType } from '@/config/config.type';

type SendMailInput = {
  to: string | string[];
  subject?: string;
  text?: string;
  html?: string;
  from?: string;
  replyTo?: string;
  templatePath?: string;
  context?: Record<string, unknown>;
};

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private readonly resend: Resend;

  constructor(private readonly configService: ConfigService<AllConfigType>) {
    const apiKey = configService.getOrThrow('mail.resendApiKey', { infer: true });
    this.resend = new Resend(apiKey);
  }

  async sendMail({ templatePath, context, ...mailOptions }: SendMailInput): Promise<void> {
    let html = mailOptions.html;

    if (templatePath && !html) {
      const template = await fs.readFile(templatePath, 'utf-8');
      html = Handlebars.compile(template, { strict: true })(context ?? {});
    }

    const from =
      mailOptions.from ??
      `${this.configService.getOrThrow('mail.defaultName', { infer: true })} <${this.configService.getOrThrow(
        'mail.defaultEmail',
        { infer: true },
      )}>`;

    const to = Array.isArray(mailOptions.to) ? mailOptions.to : [mailOptions.to];

    const result = await this.resend.emails.send({
      from,
      to,
      subject: mailOptions.subject ?? '',
      text: mailOptions.text ?? '',
      html: html ?? '',
      replyTo: mailOptions.replyTo,
    });

    if (result.error) {
      this.logger.error(`Resend error: ${result.error.name} — ${result.error.message}`);
      throw new Error(`Resend mail failed: ${result.error.message}`);
    }
  }
}
