import { ApiError } from './api-error.js';

/**
 * Simulated providers (fake sends, fake approvals, fake calendar events) exist so the product can be tried
 * locally and tested without real accounts. They must never pretend to work in production: a customer would
 * believe a WhatsApp message went out when nothing was sent. Staging servers can opt back in with
 * ALLOW_SIMULATED_PROVIDERS=true.
 */
export function simulationAllowed(): boolean {
  return process.env.NODE_ENV !== 'production' || process.env.ALLOW_SIMULATED_PROVIDERS === 'true';
}

/** Throws a 503 with a plain-language message when a simulated provider would be used in production. */
export function requireSimulation(what: string, howToFix: string): void {
  if (!simulationAllowed()) {
    throw new ApiError(503, 'PROVIDER_NOT_CONFIGURED', `${what} is not set up on this server. ${howToFix}`);
  }
}
