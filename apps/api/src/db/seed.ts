import 'dotenv/config';
import { db } from './index.js';
import {
  companies,
  companyAiSettings,
  users,
  contacts,
  leads,
  chatbots,
  notifications,
} from './schema/index.js';
import { hashPassword } from '../modules/auth/auth.utils.js';

async function seed() {
  console.info('🌱 Seeding local database for Phase 1 testing...');

  const passwordHash = await hashPassword('Password123!');

  // 1. Company 1: Prestige Realty
  const [comp1] = await db
    .insert(companies)
    .values({
      name: 'Prestige Realty Group',
      slug: 'prestige-realty',
      plan: 'growth',
      status: 'active',
      branding: {
        primaryColor: '#2563eb',
        logoUrl:
          'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=128&auto=format&fit=crop',
      },
    })
    .onConflictDoNothing()
    .returning();

  const company1Id =
    comp1?.id ??
    (await db.query.companies.findFirst({
      where: (c, { eq }) => eq(c.slug, 'prestige-realty'),
    }))!.id;

  // AI settings
  await db
    .insert(companyAiSettings)
    .values({
      companyId: company1Id,
      killSwitch: false,
      allowedTiers: ['T0', 'T1'],
      dailyActionCap: 250,
    })
    .onConflictDoNothing();

  // Users for Company 1
  await db
    .insert(users)
    .values([
      {
        companyId: company1Id,
        name: 'Vikram Mehta (Admin)',
        email: 'admin@prestige.com',
        passwordHash,
        role: 'company_admin',
        status: 'active',
      },
      {
        companyId: company1Id,
        name: 'Sarah Jenkins (Manager)',
        email: 'manager@prestige.com',
        passwordHash,
        role: 'sales_manager',
        status: 'active',
      },
      {
        companyId: company1Id,
        name: 'Rahul Sharma (Agent)',
        email: 'agent@prestige.com',
        passwordHash,
        role: 'agent',
        status: 'active',
      },
      {
        companyId: company1Id,
        name: 'Neha Gupta (Pending)',
        email: 'pending@prestige.com',
        passwordHash,
        role: 'agent',
        status: 'pending_approval',
      },
    ])
    .onConflictDoNothing();

  // 2. Company 2: Sobha Developers
  const [comp2] = await db
    .insert(companies)
    .values({
      name: 'Sobha Developers',
      slug: 'sobha-developers',
      plan: 'trial',
      status: 'active',
    })
    .onConflictDoNothing()
    .returning();

  const company2Id =
    comp2?.id ??
    (await db.query.companies.findFirst({
      where: (c, { eq }) => eq(c.slug, 'sobha-developers'),
    }))!.id;

  await db
    .insert(companyAiSettings)
    .values({
      companyId: company2Id,
      killSwitch: false,
      allowedTiers: ['T0', 'T1'],
      dailyActionCap: 100,
    })
    .onConflictDoNothing();

  await db
    .insert(users)
    .values([
      {
        companyId: company2Id,
        name: 'Ananya Verma (Admin)',
        email: 'admin@sobha.com',
        passwordHash,
        role: 'company_admin',
        status: 'active',
      },
    ])
    .onConflictDoNothing();

  // 3. Chatbots for Prestige
  await db
    .insert(chatbots)
    .values([
      {
        companyId: company1Id,
        name: 'Prestige Lakeside Concierge',
        type: 'web',
        status: 'active',
        publicKey: 'pb_pub_prestige_lakeside_001',
        config: {
          themeColor: '#2563eb',
          welcomeMessage:
            'Welcome to Prestige Lakeside Habitat! How may I assist your luxury home search today?',
        },
      },
      {
        companyId: company1Id,
        name: 'Prestige WhatsApp Assistant',
        type: 'whatsapp',
        status: 'active',
        publicKey: 'pb_pub_prestige_whatsapp_002',
        config: {},
      },
    ])
    .onConflictDoNothing();

  // 4. Sample Contacts & Leads for Prestige
  const sampleContacts = await db
    .insert(contacts)
    .values([
      {
        companyId: company1Id,
        firstName: 'Amit',
        lastName: 'Patel',
        email: 'amit.patel@gmail.com',
        phone: '+91 98200 12345',
      },
      {
        companyId: company1Id,
        firstName: 'Deepa',
        lastName: 'Sundaram',
        email: 'deepa.s@outlook.com',
        phone: '+91 98450 67890',
      },
      {
        companyId: company1Id,
        firstName: 'Rajesh',
        lastName: 'Nambiar',
        email: 'rajesh.n@corporate.in',
        phone: '+91 99800 54321',
      },
    ])
    .onConflictDoNothing()
    .returning();

  if (sampleContacts.length > 0) {
    await db
      .insert(leads)
      .values([
        {
          companyId: company1Id,
          contactId: sampleContacts[0]!.id,
          status: 'qualified',
          intentScore: 92,
          intentLabel: 'hot',
          source: 'Web AI Chatbot',
          buyerDna: {
            budgetMin: 15000000,
            budgetMax: 22000000,
            preferredLocation: 'Whitefield, Bangalore',
            unitType: '3BHK Luxury',
          },
        },
        {
          companyId: company1Id,
          contactId: sampleContacts[1]!.id,
          status: 'new',
          intentScore: 78,
          intentLabel: 'warm',
          source: 'WhatsApp Bot',
          buyerDna: {
            budgetMin: 8000000,
            budgetMax: 12000000,
            preferredLocation: 'Sarjapur Road',
            unitType: '2BHK',
          },
        },
        {
          companyId: company1Id,
          contactId: sampleContacts[2]!.id,
          status: 'site_visit_scheduled',
          intentScore: 96,
          intentLabel: 'hot',
          source: 'Web AI Chatbot',
          buyerDna: {
            budgetMin: 25000000,
            budgetMax: 35000000,
            preferredLocation: 'Indiranagar',
            unitType: '4BHK Penthouse',
          },
        },
      ])
      .onConflictDoNothing();
  }

  // 5. Notifications
  const adminUser = await db.query.users.findFirst({
    where: (u, { eq }) => eq(u.email, 'admin@prestige.com'),
  });

  if (adminUser) {
    await db
      .insert(notifications)
      .values([
        {
          companyId: company1Id,
          userId: adminUser.id,
          title: 'High-Intent Lead Captured',
          message: 'Amit Patel scored 92% intent on 3BHK Luxury search.',
          type: 'lead_alert',
          isRead: false,
        },
        {
          companyId: company1Id,
          userId: adminUser.id,
          title: 'Site Visit Confirmed',
          message: 'Rajesh Nambiar scheduled a physical site visit for Saturday 11:00 AM.',
          type: 'visit_alert',
          isRead: false,
        },
        {
          companyId: company1Id,
          userId: adminUser.id,
          title: 'Team Onboarding',
          message: 'Neha Gupta requested access to join Prestige Realty as an Agent.',
          type: 'user_approval',
          isRead: false,
        },
      ])
      .onConflictDoNothing();
  }

  console.info('✅ Local database seed completed successfully!');
  console.info('\n🔑 Default Demo Credentials:');
  console.info('   Company: Prestige Realty Group (slug: prestige-realty)');
  console.info('   Admin:   admin@prestige.com / Password123!');
  console.info('   Manager: manager@prestige.com / Password123!');
  console.info('   Agent:   agent@prestige.com / Password123!');
  console.info('   Pending: pending@prestige.com / Password123!');
  console.info('\n   Company 2: Sobha Developers (slug: sobha-developers)');
  console.info('   Admin:   admin@sobha.com / Password123!');
}

seed()
  .catch(err => {
    console.error('Seed error:', err);
    process.exit(1);
  })
  .then(() => process.exit(0));
