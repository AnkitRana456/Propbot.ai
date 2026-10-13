import { logger } from '../../server.js';

export interface EmailStub {
  sendPasswordResetEmail(email: string, resetToken: string): Promise<void>;
  getLastDispatchedToken?(email: string): string | undefined;
}

class ConsoleEmailStub implements EmailStub {
  private lastTokens: Map<string, string> = new Map();

  async sendPasswordResetEmail(email: string, resetToken: string): Promise<void> {
    this.lastTokens.set(email, resetToken);
    const resetUrl = `${process.env.WEB_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;

    logger.info(
      { email, resetUrl },
      `[EMAIL STUB] Password reset link generated for ${email}: ${resetUrl}`,
    );
  }

  getLastDispatchedToken(email: string): string | undefined {
    return this.lastTokens.get(email);
  }
}

export const emailStub = new ConsoleEmailStub();
