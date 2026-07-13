import bcrypt from 'bcryptjs';
import { config } from '../config.js';

/**
 * SMS provider abstraction. In dev we just log the code to the server console
 * (and return it in the API response) so no real SMS is sent. Swap this
 * implementation for Twilio/MSG91 in production without touching callers.
 */
export interface SmsProvider {
  send(phone: string, code: string): Promise<void>;
}

const devSmsProvider: SmsProvider = {
  async send(phone, code) {
    console.log(`\n📱 [DEV OTP] phone=${phone} code=${code}\n`);
  },
};

export const smsProvider: SmsProvider = devSmsProvider;

export function generateOtp(): string {
  if (config.devFixedOtp && !config.isProd) return config.devFixedOtp;
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function hashOtp(code: string): Promise<string> {
  return bcrypt.hash(code, 10);
}

export function compareOtp(code: string, hash: string): Promise<boolean> {
  return bcrypt.compare(code, hash);
}

export function otpExpiry(): Date {
  return new Date(Date.now() + config.otpTtlMinutes * 60 * 1000);
}
