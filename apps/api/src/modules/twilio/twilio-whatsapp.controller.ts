import type { Request, Response, NextFunction } from 'express';
import { db } from '../../db/index.js';
import { retrievalService } from '../ai/retrieval.service.js';
import { leadsService } from '../leads/leads.service.js';

/**
 * Handles inbound WhatsApp messages from Twilio Sandbox.
 * Twilio sends a form-encoded POST; we respond with TwiML <Message> to reply.
 *
 * Webhook URL: POST /api/twilio/whatsapp/webhook
 * Set this in Twilio Sandbox Settings → "When a message comes in"
 */
export class TwilioWhatsAppController {
  async inbound(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Twilio sends form-encoded fields
      const from: string = (req.body?.From as string) || '';
      const to: string = (req.body?.To as string) || '';
      const body: string = (req.body?.Body as string)?.trim() || '';
      const profileName: string = (req.body?.ProfileName as string) || '';

      if (!from || !body) {
        res.type('text/xml').status(200).send('<Response></Response>');
        return;
      }

      // Strip Twilio's "whatsapp:+NNNN" prefix
      const fromPhone = from.replace(/^whatsapp:\+?/, '').replace(/\D/g, '');
      const toDigits = to.replace(/^whatsapp:\+?/, '').replace(/\D/g, '');

      console.info('[Twilio] inbound', { from: fromPhone, to: toDigits, body });

      // Find which company owns this sandbox number
      const allConfigs = await db.query.whatsappConfigs.findMany({
        columns: { companyId: true, chatbotId: true, businessPhoneNumber: true, status: true },
      });

      // Match by business phone number, else use first record
      const matched = allConfigs.find(
        c => c.businessPhoneNumber?.replace(/\D/g, '') === toDigits,
      );
      const fallback = allConfigs[0];

      const targetCompanyId: string | undefined = matched?.companyId ?? fallback?.companyId;
      const targetChatbotId: string | undefined = matched?.chatbotId ?? fallback?.chatbotId ?? undefined;

      if (!targetCompanyId) {
        console.warn('[Twilio] no WhatsApp config found for', toDigits);
        res.type('text/xml').status(200).send('<Response></Response>');
        return;
      }

      // Query RAG chatbot for a reply
      let replyText =
        'Namaste! Thank you for reaching out. Our property advisor will connect with you shortly.';

      if (targetChatbotId) {
        try {
          // Race RAG against a 10s deadline so Twilio's 15s timeout is never hit
          const ragPromise = retrievalService.query(
            targetCompanyId,
            targetChatbotId,
            { query: body, topK: 4, similarityThreshold: 0.65, streaming: false },
            {
              agentInstructions: profileName
                ? `The visitor's name is ${profileName}. Address them naturally.`
                : undefined,
            },
          );
          const timeoutPromise = new Promise<null>(resolve =>
            setTimeout(() => resolve(null), 12_000),
          );
          const ragResult = await Promise.race([ragPromise, timeoutPromise]);
          if (ragResult?.answer) replyText = ragResult.answer;
        } catch (ragErr) {
          console.warn('[Twilio] RAG query failed, using fallback reply', ragErr);
        }
      }

      // Capture lead in CRM (fire-and-forget — don't block the reply)
      leadsService.captureOrUpdateLead(targetCompanyId, {
        phone: `+${fromPhone}`,
        name: profileName?.trim() || 'WhatsApp Visitor',
        source: 'whatsapp',
        preserveName: true,
      }).catch(e => console.warn('[Twilio] lead capture failed', e?.message));

      // TwiML response — Twilio automatically sends this as a WhatsApp reply
      const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(replyText)}</Message></Response>`;
      res.type('text/xml').status(200).send(twiml);
    } catch (err) {
      next(err);
    }
  }
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export const twilioWhatsAppController = new TwilioWhatsAppController();
