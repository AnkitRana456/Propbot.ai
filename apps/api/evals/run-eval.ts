import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { retrievalService } from '../src/modules/ai/retrieval.service.js';
import { modelRouter, TaskTier } from '../src/modules/ai/router.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface TestCase {
  id: string;
  category: string;
  question: string;
  expectedTopics: string[];
  shouldBeGrounded: boolean;
}

async function runEval() {
  console.info('===============================================================');
  console.info(' PropBot Pro — Phase 3 RAG & Hallucination Benchmark Evaluator');
  console.info('===============================================================');

  const datasetPath = path.join(__dirname, 'dataset.json');
  const rawData = fs.readFileSync(datasetPath, 'utf-8');
  const testCases: TestCase[] = JSON.parse(rawData);

  console.info(`Loaded ${testCases.length} real estate evaluation test cases from dataset.json\n`);

  let passedCases = 0;
  let hallucinationCases = 0;
  const totalCases = testCases.length;
  const latencies: number[] = [];

  const verifiedSampleChunks = [
    {
      sourceTitle: 'Prestige Sanctuary Master Brochure 2026',
      sectionHeader: 'Pricing & Investment',
      content:
        'Residences start from ₹3.25 Cr onwards for 3BHK villas and ₹5.50 Cr for 4BHK presidential villas. We offer a flexible 20:80 milestone construction-linked payment plan. Booking token is ₹10 Lakhs. Maintenance charges are estimated at ₹4.50 per sq ft. Stamp duty and registration are as per actuals. Rental yield programs for investor units project estimated yields of 6-8% per annum.',
    },
    {
      sourceTitle: 'Prestige Sanctuary Master Brochure 2026',
      sectionHeader: 'Floor Plans & Layout Specifications',
      content:
        'Carpet area for 4BHK presidential villas is 3,450 sq ft. Penthouses feature private open-air plunge pools and sky decks. Floor-to-ceiling clearance is 11.5 feet. All 3BHK layouts include separate private servant quarters and dedicated utility spaces. Combinations of adjacent units into duplex configurations are subject to structural review and engineering approval.',
    },
    {
      sourceTitle: 'Prestige Sanctuary Master Brochure 2026',
      sectionHeader: 'Clubhouse & Amenities',
      content:
        'Central clubhouse spans 45,000 sq ft featuring a temperature-controlled heated indoor swimming pool, dedicated EV charging points in the parking basement, regulation squash and tennis courts, and 24/7 CCTV surveillance with biometric access controls.',
    },
    {
      sourceTitle: 'Prestige Sanctuary Location & Social Infrastructure',
      sectionHeader: 'Connectivity & Vicinity',
      content:
        'Located 25 minutes from Kempegowda International Airport (BLR). The upcoming Blue Line Metro station is just 800m away. Nearby premier international schools include Stonehill International and Canadian International School. Aster CMI Multi-Specialty Hospital and Columbia Asia are within a 10-minute drive. Major IT tech parks nearby include Manyata Tech Park and Aerospace SEZ corridor.',
    },
    {
      sourceTitle: 'Prestige Sanctuary RERA, Banking & Developer Details',
      sectionHeader: 'Approvals & Technical Specifications',
      content:
        'Project RERA registration number is PRM/KA/RERA/1251/309/PR/210319/004000. Scheduled possession for Phase 1 is December 2027 under RERA delayed compensation guarantees. Major approved banking partners offering preferential home loan rates include HDFC Bank, SBI, ICICI, and Axis Bank. Master architectural design by RSP Architects and landscaping by Site Concepts Singapore. The developer has an impeccable past delivery track record of 150+ completed luxury residential projects. Premium bathroom fittings include imported Kohler and Grohe sanitary ware, and complete smart home automation is pre-installed for lighting and climate controls.',
    },
    {
      sourceTitle: 'Prestige Sanctuary Sales & Customer Support',
      sectionHeader: 'Site Visits & Documentation',
      content:
        'Our experiential sales gallery and designer show villas are open 7 days a week from 9:30 AM to 7:00 PM. Complimentary luxury airport pickup and transport is arranged for NRI site visits. Master PDF brochure, pricing sheets, and structural specification sheets can be emailed or downloaded instantly through our client portal or sales advisors.',
    },
  ];

  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i]!;
    const start = Date.now();

    // Use retrievalService system prompt builder
    const systemPrompt = retrievalService.buildSystemPrompt(
      'Prestige Sanctuary Luxury Concierge',
      'luxury',
      verifiedSampleChunks,
    );

    const completion = await modelRouter.executeCompletion({
      tier: TaskTier.STRONG,
      companyId: 'eval-company-id',
      chatbotId: 'eval-chatbot-id',
      systemPrompt,
      userMessage: tc.question,
      promptName: 'eval_benchmark',
      promptVersion: 'v3.0',
    });

    const latency = Date.now() - start;
    latencies.push(latency);

    const answer = completion.text.toLowerCase();
    let isSuccess = false;

    if (tc.shouldBeGrounded) {
      // Grounded case: check if answer mentions any expected keywords
      const matched = tc.expectedTopics.some(topic => answer.includes(topic.toLowerCase()));
      if (matched) {
        isSuccess = true;
      }
    } else {
      // Negative / Off-topic / Unverified case: verify it REFUSES to hallucinate
      const refusedToHallucinate =
        answer.includes('unable') ||
        answer.includes("don't have") ||
        answer.includes('specialize') ||
        answer.includes('callback') ||
        answer.includes('consultant') ||
        answer.includes('off-topic') ||
        answer.includes('cannot') ||
        answer.includes('असमर्थ') ||
        answer.includes('सत्यापित');

      // Check that it didn't fabricate false affirmative claims
      const fabricatedFalseClaim =
        answer.includes('solid gold') ||
        answer.includes('helipad confirmed') ||
        answer.includes('compound return of 35%');

      if (refusedToHallucinate && !fabricatedFalseClaim) {
        isSuccess = true;
      } else {
        hallucinationCases++;
      }
    }

    if (isSuccess) {
      passedCases++;
    }

    const statusMark = isSuccess ? '✓ PASS' : '✗ FAIL';
    console.info(`[${tc.id}] [${tc.category.padEnd(19)}] ${statusMark} (${latency}ms) - "${tc.question.slice(0, 48)}..."`);
  }

  const accuracyRate = Number(((passedCases / totalCases) * 100).toFixed(1));
  const hallucinationRate = Number(((hallucinationCases / totalCases) * 100).toFixed(1));
  const avgLatency = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);

  console.info('\n===============================================================');
  console.info(' EVALUATION BENCHMARK SUMMARY REPORT');
  console.info('===============================================================');
  console.info(`Total Test Cases        : ${totalCases}`);
  console.info(`Passed Cases            : ${passedCases} / ${totalCases}`);
  console.info(`Grounded Accuracy Rate  : ${accuracyRate}% (Target: >90%)`);
  console.info(`Hallucination Rate      : ${hallucinationRate}% (Target: <2%)`);
  console.info(`Average Latency         : ${avgLatency} ms`);
  console.info('===============================================================\n');

  if (accuracyRate >= 90 && hallucinationRate <= 2.0) {
    console.info('>> EVALUATION RESULT: ALL QUALITY BENCHMARKS PASSED (GREEN) <<\n');
    process.exit(0);
  } else {
    console.error('>> EVALUATION RESULT: FAILED TO MEET QUALITY THRESHOLD <<\n');
    process.exit(1);
  }
}

runEval().catch(err => {
  console.error('Evaluation run error:', err);
  process.exit(1);
});
