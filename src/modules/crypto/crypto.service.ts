import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes, createCipheriv, createDecipheriv } from 'crypto';
import { Injectable, OnModuleInit, InternalServerErrorException } from '@nestjs/common';

import { AllConfigType } from '@/config/config.type';

const ALGO = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;
const VERSION = 'v1';

@Injectable()
export class CryptoService implements OnModuleInit {
  private key!: Buffer;

  constructor(private readonly configService: ConfigService<AllConfigType>) {}

  onModuleInit(): void {
    const hex = this.configService.getOrThrow('payments.encryptionKey', { infer: true });
    const buf = Buffer.from(hex, 'hex');
    if (buf.length !== 32) {
      throw new InternalServerErrorException(
        `APP_ENCRYPTION_KEY debe ser 32 bytes (64 chars hex), recibido ${buf.length}.`,
      );
    }
    this.key = buf;
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGO, this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${VERSION}:${iv.toString('base64')}:${tag.toString('base64')}:${ciphertext.toString('base64')}`;
  }

  decrypt(payload: string): string {
    const [version, ivB64, tagB64, ctB64] = payload.split(':');
    if (version !== VERSION || !ivB64 || !tagB64 || !ctB64) {
      throw new InternalServerErrorException('Payload encriptado inválido.');
    }
    const iv = Buffer.from(ivB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');
    const ciphertext = Buffer.from(ctB64, 'base64');
    if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
      throw new InternalServerErrorException('Payload encriptado con longitudes inválidas.');
    }
    const decipher = createDecipheriv(ALGO, this.key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  }

  md5(value: string): string {
    return createHash('md5').update(value).digest('hex');
  }

  sha256(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }
}
