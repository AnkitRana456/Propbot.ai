import geoip from 'geoip-lite';
import { UAParser } from 'ua-parser-js';

export interface TrackingEnrichment {
  deviceType: string | null;
  osName: string | null;
  browserName: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
}

/**
 * Derives device/browser info from User-Agent and geo-location from IP.
 * Pure function — never throws; returns nulls on any failure.
 */
export function enrichTracking(userAgent?: string | null, ipAddress?: string | null): TrackingEnrichment {
  let deviceType: string | null = null;
  let osName: string | null = null;
  let browserName: string | null = null;
  let city: string | null = null;
  let state: string | null = null;
  let country: string | null = null;

  if (userAgent) {
    try {
      const parser = new UAParser(userAgent);
      const device = parser.getDevice();
      const os = parser.getOS();
      const browser = parser.getBrowser();

      // Map UAParser device type to simplified category
      const rawType = device.type;
      if (rawType === 'mobile' || rawType === 'wearable') {
        deviceType = 'mobile';
      } else if (rawType === 'tablet') {
        deviceType = 'tablet';
      } else {
        deviceType = 'desktop';
      }

      osName = os.name ?? null;

      // Detect in-app browsers from UA string
      const ua = userAgent.toLowerCase();
      if (ua.includes('instagram')) {
        browserName = 'Instagram';
      } else if (ua.includes('whatsapp')) {
        browserName = 'WhatsApp';
      } else if (ua.includes('fban') || ua.includes('fb_iab') || ua.includes('fbios')) {
        browserName = 'Facebook';
      } else if (ua.includes('twitter') || ua.includes('twitterandroid')) {
        browserName = 'Twitter';
      } else {
        browserName = browser.name ?? null;
      }
    } catch {
      // ignore UA parse errors
    }
  }

  if (ipAddress) {
    try {
      // Strip port if present (e.g. "::ffff:203.0.113.1")
      const cleanIp = ipAddress.replace(/^::ffff:/, '').split(':')[0] ?? ipAddress;
      const geo = geoip.lookup(cleanIp);
      if (geo) {
        city = geo.city || null;
        state = geo.region || null;
        country = geo.country || null;
      }
    } catch {
      // ignore geo lookup errors
    }
  }

  return { deviceType, osName, browserName, city, state, country };
}
