import { heuristicSentiment } from '../ai/llm.js';

export interface CallSignals {
  optOut: boolean;
  notInterested: boolean;
  visitIntent: boolean;
  priceNegotiation: boolean;
  wantsHuman: boolean;
  goodbye: boolean;
  wrongNumber: boolean;
  budget?: string;
  bhk?: string;
  sentiment: 'positive' | 'neutral' | 'negative';
}

const OPT_OUT = /\b(stop calling|do not call|don'?t call|dnd|remove (my )?number|take me off|unsubscribe|mat karo call|call mat)\b/i;
const NOT_INTERESTED = /\b(not interested|no interest|nahi chahiye|not looking|already bought|bought (a )?(flat|home|house))\b/i;
const WRONG_NUMBER = /\bwrong number\b/i;
const VISIT = /\b(site visit|visit (the )?(site|project)|come (and )?see|see the (flat|unit|project)|can i visit|book (a )?visit|saturday|sunday|this weekend|tomorrow)\b/i;
const PRICE_NEGOTIATION = /\b(discount|negotiat\w*|cheaper|lower (the )?price|best price|special offer|waive|reduce (the )?price)\b/i;
const GOODBYE = /\b(bye|goodbye|that'?s all|thank you,? bye|talk later|call (me )?later)\b/i;
const NEGATIVE = /\b(angry|annoying|irritat\w*|waste of time|useless|worst|scam|fraud|harass\w*|stop it)\b/i;
const POSITIVE = /\b(great|sounds good|interested|yes please|perfect|love it|tell me more|go ahead)\b/i;

/** Cheap, deterministic read of one caller utterance. The LLM only writes the reply; safety decisions never depend on it. */
export function analyzeUtterance(text: string, escalationKeywords: string[] = []): CallSignals & { escalationKeyword?: string } {
  const lower = text.toLowerCase();
  const bhk = /\b(\d)\s*-?\s*bhk\b/i.exec(text);
  const budget = /(\d+(?:\.\d+)?)\s*(cr|crore|crores|lakh|lakhs|lac)\b/i.exec(text);
  const keyword = escalationKeywords.find(k => k.trim() && lower.includes(k.toLowerCase()));
  const frustrated = heuristicSentiment(text) === 'frustrated' || NEGATIVE.test(text);
  return {
    optOut: OPT_OUT.test(text),
    notInterested: NOT_INTERESTED.test(text),
    visitIntent: VISIT.test(text),
    priceNegotiation: PRICE_NEGOTIATION.test(text),
    wantsHuman: Boolean(keyword),
    escalationKeyword: keyword,
    goodbye: GOODBYE.test(text),
    wrongNumber: WRONG_NUMBER.test(text),
    budget: budget ? `${budget[1]} ${/^c/i.test(budget[2]!) ? 'Cr' : 'Lakh'}` : undefined,
    bhk: bhk ? `${bhk[1]}BHK` : undefined,
    sentiment: frustrated ? 'negative' : POSITIVE.test(text) || VISIT.test(text) ? 'positive' : 'neutral',
  };
}

export interface CallWindow {
  days: number[];
  startHour: number;
  endHour: number;
  timezone: string;
}

/** Is `now` inside the campaign's calling window in its own timezone? Invalid timezones fail closed. */
export function inCallingWindow(w: CallWindow, now = new Date()): boolean {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: w.timezone, weekday: 'short', hour: 'numeric', hourCycle: 'h23' }).formatToParts(now);
    const weekday = parts.find(p => p.type === 'weekday')?.value ?? '';
    const hour = Number(parts.find(p => p.type === 'hour')?.value ?? -1);
    const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekday);
    return day >= 0 && w.days.includes(day) && hour >= w.startHour && hour < w.endHour;
  } catch {
    return false;
  }
}
