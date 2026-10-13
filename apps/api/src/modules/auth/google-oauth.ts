import type { Request, Response } from 'express';

export function handleGoogleAuth(_req: Request, res: Response): void {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    res.status(501).json({
      error: {
        code: 'OAUTH_NOT_CONFIGURED',
        message:
          'Google OAuth is optional and currently disabled: missing credentials in environment.',
      },
    });
    return;
  }

  // When credentials are provided, redirect to Google consent screen
  const redirectUri = `${process.env.API_URL || 'http://localhost:3000'}/api/auth/google/callback`;
  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(
    redirectUri,
  )}&response_type=code&scope=openid%20profile%20email`;

  res.redirect(googleAuthUrl);
}

export function handleGoogleCallback(_req: Request, res: Response): void {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    res.status(501).json({
      error: {
        code: 'OAUTH_NOT_CONFIGURED',
        message:
          'Google OAuth is optional and currently disabled: missing credentials in environment.',
      },
    });
    return;
  }

  res.status(200).json({
    message: 'Google OAuth callback handler ready for production credentials.',
  });
}
