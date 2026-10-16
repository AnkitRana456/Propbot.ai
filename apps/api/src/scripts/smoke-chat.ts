import 'dotenv/config';
import crypto from 'node:crypto';
import { eq, and, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  companies,
  chatbots,
  conversations,
  domainEvents,
} from '../db/schema/index.js';
import { publicChatService } from '../modules/chat/public-chat.service.js';

interface SmokeStep {
  name: string;
  status: 'PASS' | 'FAIL';
  details: string;
}

const steps: SmokeStep[] = [];

async function runSmokeChat(): Promise<void> {
  console.log('\n===============================================================');
  console.log('             PROPBOT PRO — SMOKE:CHAT DIAGNOSTIC TEST          ');
  console.log('===============================================================\n');

  let testCompanyId = '';
  let testChatbotId = '';
  let testPublicKey = '';

  try {
    // 1. Verify or create test tenant & chatbot
    console.log('[1/5] Setting up test company and public chatbot...');
    let [company] = await db
      .select({ id: companies.id })
      .from(companies)
      .limit(1);

    if (!company) {
      const [newCo] = await db
        .insert(companies)
        .values({
          name: 'Smoke Test Real Estate Ltd',
          slug: `smoke-test-${Date.now()}`,
          status: 'active',
        })
        .returning({ id: companies.id });
      company = newCo!;
    }
    testCompanyId = company.id;

    testPublicKey = `pb_smoke_${crypto.randomBytes(16).toString('hex')}`;
    const [bot] = await db
      .insert(chatbots)
      .values({
        companyId: testCompanyId,
        name: 'Smoke Test Aurora Bot',
        type: 'web',
        status: 'active',
        publicKey: testPublicKey,
        config: {
          appearance: {
            botName: 'Aurora Assistant',
            primaryColor: '#3b82f6',
            themeMode: 'dark',
          },
          behavior: {
            greetingMessage: 'Welcome to Smoke Test Residences. How can I assist you?',
            quickQuestions: ['What are the prices?', 'Can I visit this Saturday?'],
          },
        },
      })
      .returning();
    testChatbotId = bot!.id;

    steps.push({
      name: 'Bot Provisioning',
      status: 'PASS',
      details: `Created test bot '${bot!.name}' with publicKey '${testPublicKey}'`,
    });

    // 2. Test Session Creation (Public API)
    console.log('[2/5] Initializing public visitor session...');
    const sessionResult = await publicChatService.createSession({
      publicKey: testPublicKey,
      visitorId: `smoke_visitor_${Date.now()}`,
      pageUrl: 'https://example.com/properties/smoke-residence',
    });

    if (!sessionResult.sessionToken || !sessionResult.conversationId) {
      throw new Error('Session creation failed to return sessionToken or conversationId');
    }

    steps.push({
      name: 'Session Initiation',
      status: 'PASS',
      details: `Conversation ID: ${sessionResult.conversationId}`,
    });

    // 3. Test Message Exchange (Visitor to Assistant)
    console.log('[3/5] Testing visitor message transmission and response...');
    const questions = [
      'Hello, what 3BHK villas do you have available?',
      'What is the starting price range?',
      'Can I schedule a site visit this Sunday at 11 AM?',
    ];

    for (const q of questions) {
      const msgResult = await publicChatService.sendMessage({
        token: sessionResult.sessionToken,
        conversationId: sessionResult.conversationId,
        message: q,
      });

      if (!msgResult.reply || msgResult.reply.length === 0) {
        throw new Error(`Empty reply received for question: "${q}"`);
      }
    }

    steps.push({
      name: 'Chat Exchange',
      status: 'PASS',
      details: `Successfully sent ${questions.length} queries and received assistant responses`,
    });

    // 4. Test Lead Capture
    console.log('[4/5] Testing lead capture and contact persistence...');
    const leadCapture = await publicChatService.captureLead({
      token: sessionResult.sessionToken,
      conversationId: sessionResult.conversationId,
      fullName: 'Ananya Sharma',
      phone: '+919876543210',
      email: 'ananya.sharma@example.com',
      preferences: {
        budget: '₹2.5 Cr - ₹3.5 Cr',
        configuration: '3BHK Villa',
        timeline: 'Within 6 months',
      },
    });

    if (!leadCapture.leadId || !leadCapture.contactId) {
      throw new Error('Lead capture failed to return leadId or contactId');
    }

    steps.push({
      name: 'Lead Capture',
      status: 'PASS',
      details: `Lead ID: ${leadCapture.leadId}, Contact ID: ${leadCapture.contactId}`,
    });

    // 5. Verify Database Records and Domain Event Outbox
    console.log('[5/5] Verifying database integrity and domain_events outbox...');
    const [convCheck] = await db
      .select({
        status: conversations.status,
        leadId: conversations.leadId,
        contactId: conversations.contactId,
      })
      .from(conversations)
      .where(eq(conversations.id, sessionResult.conversationId));

    if (!convCheck || convCheck.leadId !== leadCapture.leadId) {
      throw new Error('Conversation was not properly linked to the captured lead');
    }

    const [eventCheck] = await db
      .select({ id: domainEvents.id, type: domainEvents.type })
      .from(domainEvents)
      .where(
        and(
          eq(domainEvents.companyId, testCompanyId),
          eq(domainEvents.type, 'lead.created'),
        ),
      )
      .orderBy(sql`${domainEvents.createdAt} DESC`)
      .limit(1);

    if (!eventCheck) {
      throw new Error('Domain event lead.created was not written to domain_events outbox table');
    }

    steps.push({
      name: 'Event Outbox Integrity',
      status: 'PASS',
      details: `Linked conversation to lead; outbox event '${eventCheck.type}' written`,
    });

    // Cleanup test chatbot and records
    await db.delete(chatbots).where(eq(chatbots.id, testChatbotId)).catch(() => {});
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    steps.push({
      name: 'Smoke Test Execution',
      status: 'FAIL',
      details: errorMsg,
    });
  }

  // Report Summary
  console.log('\n┌─────────────────────────────┬─────────┬────────────────────────────────────────────────────────┐');
  console.log('│ Step                        │ Status  │ Details                                                │');
  console.log('├─────────────────────────────┼─────────┼────────────────────────────────────────────────────────┤');

  let failed = false;
  for (const s of steps) {
    const namePadded = s.name.padEnd(27);
    const statusFormatted = s.status === 'PASS' ? '\x1b[32mPASS   \x1b[0m' : '\x1b[31mFAIL   \x1b[0m';
    if (s.status === 'FAIL') failed = true;
    const det = s.details.length > 54 ? s.details.slice(0, 51) + '...' : s.details;
    console.log(`│ ${namePadded} │ ${statusFormatted} │ ${det.padEnd(54)} │`);
  }
  console.log('└─────────────────────────────┴─────────┴────────────────────────────────────────────────────────┘\n');

  if (failed) {
    console.log('\x1b[31m[!] Smoke test FAILED. Review errors above.\x1b[0m\n');
    process.exit(1);
  } else {
    console.log('\x1b[32m[✓] Chatbot-to-CRM journey verified end-to-end! Smoke test PASSED.\x1b[0m\n');
    process.exit(0);
  }
}

runSmokeChat().catch(err => {
  console.error('Fatal smoke:chat error:', err);
  process.exit(1);
});
