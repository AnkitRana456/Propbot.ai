import 'dotenv/config';
import { db } from './index.js';
import {
  companies,
  companyAiSettings,
  users,
  projects,
  units,
  chatbots,
  contacts,
  leads,
  appointments,
  dailyAnalyticsRollups,
} from './schema/index.js';
import { hashPassword } from '../modules/auth/auth.utils.js';

const DEMO_COMPANY_ID = '11111111-1111-1111-1111-111111111101';
const DEMO_BOT_ID = '22222222-2222-2222-2222-222222222201';

const FIRST_NAMES = [
  'Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh', 'Ayaan', 'Krishna', 'Ishaan',
  'Ananya', 'Diya', 'Aadhya', 'Saanvi', 'Kiara', 'Myra', 'Aria', 'Pari', 'Anika', 'Navya',
  'Rohan', 'Vikram', 'Pooja', 'Neha', 'Sanjay', 'Rahul', 'Deepak', 'Meera', 'Sunita', 'Amit',
  'Karan', 'Simran', 'Tanvi', 'Varun', 'Rhea', 'Manish', 'Alok', 'Sneha', 'Nikhil', 'Priyanka',
];

const LAST_NAMES = [
  'Sharma', 'Verma', 'Patel', 'Reddy', 'Mehta', 'Nambiar', 'Gupta', 'Iyer', 'Menon', 'Joshi',
  'Deshmukh', 'Bhat', 'Rao', 'Malhotra', 'Kapoor', 'Chopra', 'Singhania', 'Nair', 'Aggarwal', 'Kulkarni',
];

const LOCALITIES = ['Whitefield', 'Indiranagar', 'Koramangala', 'Sarjapur Road', 'Hebbal', 'Bellandur'];
const BUDGETS = [
  { min: 12000000, max: 18000000, bhk: ['2BHK', '3BHK'] },
  { min: 18000000, max: 25000000, bhk: ['3BHK'] },
  { min: 25000000, max: 40000000, bhk: ['3BHK', '4BHK'] },
  { min: 40000000, max: 75000000, bhk: ['4BHK Villa', 'Penthouse'] },
];

export async function runDemoSeed() {
  console.info('🌱 [Phase 14.7] Seeding polished demo company with realistic real estate inventory and 200 leads...');

  const passwordHash = await hashPassword('Password123!');

  // 1. Demo Company
  await db
    .insert(companies)
    .values({
      id: DEMO_COMPANY_ID,
      name: 'Prestige Living Real Estate',
      slug: 'prestige-living',
      plan: 'enterprise',
      status: 'active',
      branding: {
        primaryColor: '#2563eb',
        logoUrl: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=128&auto=format&fit=crop',
      },
    })
    .onConflictDoNothing();

  // AI settings
  await db
    .insert(companyAiSettings)
    .values({
      companyId: DEMO_COMPANY_ID,
      killSwitch: false,
      allowedTiers: ['T0', 'T1', 'T2'],
      dailyActionCap: 500,
    })
    .onConflictDoNothing();

  // 2. Users (Admin, Manager, 2 Agents)
  const agent1Id = '33333333-3333-3333-3333-333333333301';
  const agent2Id = '33333333-3333-3333-3333-333333333302';

  await db
    .insert(users)
    .values([
      {
        companyId: DEMO_COMPANY_ID,
        name: 'Rajiv Kapoor (Admin)',
        email: 'rajiv.admin@prestigeliving.in',
        passwordHash,
        role: 'company_admin',
        status: 'active',
      },
      {
        companyId: DEMO_COMPANY_ID,
        name: 'Shreya Roy (Manager)',
        email: 'shreya.roy@prestigeliving.in',
        passwordHash,
        role: 'sales_manager',
        status: 'active',
      },
      {
        id: agent1Id,
        companyId: DEMO_COMPANY_ID,
        name: 'Arun Pillai (Senior Advisor)',
        email: 'arun.pillai@prestigeliving.in',
        passwordHash,
        role: 'agent',
        status: 'active',
      },
      {
        id: agent2Id,
        companyId: DEMO_COMPANY_ID,
        name: 'Pooja Hegde (Luxury Specialist)',
        email: 'pooja.hegde@prestigeliving.in',
        passwordHash,
        role: 'agent',
        status: 'active',
      },
    ])
    .onConflictDoNothing();

  // 3. Realistic Projects
  const proj1Id = '44444444-4444-4444-4444-444444444401';
  const proj2Id = '44444444-4444-4444-4444-444444444402';

  await db
    .insert(projects)
    .values([
      {
        id: proj1Id,
        companyId: DEMO_COMPANY_ID,
        name: 'Prestige Glenwood Luxury Residences',
        builderName: 'Prestige Group',
        reraNo: 'PRM/KA/RERA/1251/446/PR/171015/000452',
        status: 'under_construction',
        location: 'ITPL Main Road, Whitefield, Bangalore',
        overview: 'Sprawling 15-acre residential community with 80% open landscaped greens, clubhouse, and private patio decks.',
      },
      {
        id: proj2Id,
        companyId: DEMO_COMPANY_ID,
        name: 'Prestige Sanctuary Private Villas',
        builderName: 'Prestige Group',
        reraNo: 'PRM/KA/RERA/1250/303/PR/220601/004958',
        status: 'pre_launch',
        location: 'Bellary Road Corridor, Hebbal, Bangalore',
        overview: 'Uber-luxury 4BHK hillside presidential villas with private swimming pools and concierge services.',
      },
    ])
    .onConflictDoNothing();

  // 4. Units
  await db
    .insert(units)
    .values([
      {
        companyId: DEMO_COMPANY_ID,
        projectId: proj1Id,
        unitNumber: 'Tower A - 302',
        bhk: 3,
        carpetAreaSqft: '1850',
        price: '24500000',
        status: 'available',
      },
      {
        companyId: DEMO_COMPANY_ID,
        projectId: proj1Id,
        unitNumber: 'Tower B - 1204',
        bhk: 3,
        carpetAreaSqft: '2150',
        price: '28500000',
        status: 'available',
      },
      {
        companyId: DEMO_COMPANY_ID,
        projectId: proj2Id,
        unitNumber: 'Villa Palm - 14',
        bhk: 4,
        carpetAreaSqft: '4200',
        price: '55000000',
        status: 'available',
      },
    ])
    .onConflictDoNothing();

  // 5. Chatbot
  await db
    .insert(chatbots)
    .values({
      id: DEMO_BOT_ID,
      companyId: DEMO_COMPANY_ID,
      name: 'Prestige Concierge AI',
      type: 'web',
      status: 'active',
      publicKey: 'pb_live_demo_prestige_2026',
      config: {
        greetingMessage: 'Namaste! Welcome to Prestige Living. Are you exploring residences for personal relocation or high-yield investment?',
        primaryColor: '#2563eb',
        collectEmail: true,
        collectPhone: true,
      },
    })
    .onConflictDoNothing();

  // 6. Generate 200 Realistic Leads & Contacts
  console.info('   Creating 200 realistic contacts and scored leads...');
  const leadStatuses = ['new', 'contacted', 'qualified', 'site_visit_scheduled', 'site_visit_done', 'negotiation', 'converted', 'lost'];
  const sources = ['web_chat', 'whatsapp', 'google_ads', 'portal_99acres'];

  for (let i = 1; i <= 200; i++) {
    const fName = FIRST_NAMES[i % FIRST_NAMES.length]!;
    const lName = LAST_NAMES[Math.floor(i / 2) % LAST_NAMES.length]!;
    const phone = `+9198${String(10000000 + i * 37).slice(0, 8)}`;
    const email = `${fName.toLowerCase()}.${lName.toLowerCase()}${i}@example.com`;
    const loc = LOCALITIES[i % LOCALITIES.length]!;
    const bTier = BUDGETS[i % BUDGETS.length]!;
    const status = leadStatuses[i % leadStatuses.length]!;
    const intentScore = Math.min(98, Math.max(25, 30 + ((i * 13) % 68)));
    const assignedAgent = i % 2 === 0 ? agent1Id : agent2Id;

    const [contact] = await db
      .insert(contacts)
      .values({
        companyId: DEMO_COMPANY_ID,
        firstName: fName,
        lastName: lName,
        email,
        phone,
      })
      .onConflictDoNothing()
      .returning();

    if (contact) {
      const [lead] = await db
        .insert(leads)
        .values({
          companyId: DEMO_COMPANY_ID,
          contactId: contact.id,
          chatbotId: DEMO_BOT_ID,
          status,
          intentScore,
          source: sources[i % sources.length]!,
          assignedAgentId: assignedAgent,
          buyerDna: {
            budgetMin: bTier.min,
            budgetMax: bTier.max,
            bhk: bTier.bhk,
            localities: [loc],
            timeline: i % 3 === 0 ? 'immediate_30_days' : 'within_6_months',
            purpose: i % 4 === 0 ? 'investment' : 'self_use',
          },
        })
        .onConflictDoNothing()
        .returning();

      // For site visits scheduled/done, insert an appointment
      if (lead && (status === 'site_visit_scheduled' || status === 'site_visit_done')) {
        const visitDate = new Date(Date.now() + (status === 'site_visit_scheduled' ? 1 : -3) * 86400000 * (1 + (i % 5)));
        await db
          .insert(appointments)
          .values({
            companyId: DEMO_COMPANY_ID,
            leadId: lead.id,
            projectId: i % 2 === 0 ? proj1Id : proj2Id,
            assignedAgentId: assignedAgent,
            scheduledAt: visitDate,
            status: status === 'site_visit_done' ? 'completed' : 'scheduled',
          })
          .onConflictDoNothing();
      }
    }
  }

  // 7. Seed 30-Day Historical Analytics Rollups
  console.info('   Seeding 30-day historical analytics metrics...');
  const now = new Date();
  for (let d = 30; d >= 0; d--) {
    const dayDate = new Date(now.getTime() - d * 86400000);
    const dateStr = dayDate.toISOString().split('T')[0]!;

    await db
      .insert(dailyAnalyticsRollups)
      .values({
        companyId: DEMO_COMPANY_ID,
        chatbotId: DEMO_BOT_ID,
        date: dateStr,
        totalConversations: 12 + (d % 8) * 3,
        totalLeads: 6 + (d % 5) * 2,
        qualifiedLeads: 4 + (d % 4),
        visitsBooked: 2 + (d % 3),
        metricsJson: {
          avgResponseTimeSeconds: 1.4,
          satisfactionRatePercent: 94,
        },
      })
      .onConflictDoNothing();
  }

  console.info('✅ [Phase 14.7] Demo Seed completed successfully!');
  console.info('   Company Slug  : prestige-living');
  console.info('   Admin Login   : rajiv.admin@prestigeliving.in / Password123!');
  console.info('   Manager Login : shreya.roy@prestigeliving.in / Password123!');
  console.info('   Agent Login   : arun.pillai@prestigeliving.in / Password123!');
  console.info('   Total Leads   : 200 records seeded with Buyer DNA & Intent scores.');
}

if (import.meta.url.endsWith('seed-demo.ts')) {
  runDemoSeed()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Demo seed failed:', err);
      process.exit(1);
    });
}
