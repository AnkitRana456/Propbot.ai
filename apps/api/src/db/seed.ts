import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { db } from './index.js';
import {
  companies,
  companyAiSettings,
  users,
  contacts,
  leads,
  leadActivities,
  notes,
  tasks,
  chatbots,
  notifications,
  projects,
  units,
  brochures,
  shortlistRooms,
  shortlistItems,
  appointments,
  conversations,
  messages,
  workflows,
  workflowRuns,
  segments,
  campaigns,
  voiceCalls,
  knowledgeSources,
  knowledgeChunks,
  dailyAnalyticsRollups,
  agentActions,
  whatsappConfigs,
} from './schema/index.js';
import { hashPassword } from '../modules/auth/auth.utils.js';

const FIRST_NAMES = [
  'Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh', 'Ayaan', 'Krishna', 'Ishaan',
  'Ananya', 'Diya', 'Aadhya', 'Saanvi', 'Kiara', 'Myra', 'Aria', 'Pari', 'Anika', 'Navya',
  'Rohan', 'Vikram', 'Pooja', 'Neha', 'Sanjay', 'Rahul', 'Deepak', 'Meera', 'Sunita', 'Amit',
  'Karan', 'Simran', 'Tanvi', 'Varun', 'Rhea', 'Manish', 'Alok', 'Sneha', 'Nikhil', 'Priyanka',
  'Rajesh', 'Deepa', 'Siddharth', 'Kavita', 'Gaurav', 'Shweta', 'Abhishek', 'Ritu', 'Kunal', 'Divya'
];

const LAST_NAMES = [
  'Sharma', 'Verma', 'Patel', 'Reddy', 'Mehta', 'Nambiar', 'Gupta', 'Iyer', 'Menon', 'Joshi',
  'Deshmukh', 'Bhat', 'Rao', 'Malhotra', 'Kapoor', 'Chopra', 'Singhania', 'Nair', 'Aggarwal', 'Kulkarni',
  'Sundaram', 'Bose', 'Chatterjee', 'Pandey', 'Mishra', 'Chowdhury', 'Mukherjee', 'Trivedi', 'Saxena', 'Dutta'
];

const LOCALITIES = [
  'Whitefield, Bangalore',
  'Indiranagar, Bangalore',
  'Koramangala, Bangalore',
  'Sarjapur Road, Bangalore',
  'Hebbal, Bangalore',
  'Bellandur, Bangalore',
  'Electronic City, Bangalore',
  'HSR Layout, Bangalore'
];

const BUDGET_TIERS = [
  { min: 8500000, max: 13500000, bhk: ['2BHK'], label: 'Mid-Income 2BHK' },
  { min: 14000000, max: 23000000, bhk: ['3BHK'], label: 'Upper-Mid 3BHK' },
  { min: 24000000, max: 38000000, bhk: ['3BHK Luxury', '4BHK'], label: 'Luxury Residence' },
  { min: 45000000, max: 95000000, bhk: ['4BHK Villa', 'Penthouse'], label: 'Uber Luxury / Villa' },
];

export async function runComprehensiveSeed() {
  console.info('🌱 Starting Full PropBot Pro Comprehensive Database Seed...');

  // Demo accounts: password comes from SEED_DEMO_PASSWORD. The built-in default is for local dev only.
  if (process.env.NODE_ENV === 'production' && !process.env.SEED_DEMO_PASSWORD) {
    throw new Error('SEED_DEMO_PASSWORD is required to run the demo seed in production.');
  }
  const passwordHash = await hashPassword(process.env.SEED_DEMO_PASSWORD ?? 'Password123!');

  // =========================================================================
  // 1. Companies
  // =========================================================================
  console.info('   [1/12] Seeding Multi-Tenant Companies & AI Settings...');

  // Company A: Prestige Realty Group
  const [comp1] = await db
    .insert(companies)
    .values({
      name: 'Prestige Realty Group',
      slug: 'prestige-realty',
      plan: 'enterprise',
      status: 'active',
      branding: {
        primaryColor: '#2563eb',
        logoUrl: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=128&auto=format&fit=crop',
      },
    })
    .onConflictDoNothing()
    .returning();

  const company1 = comp1 ?? (await db.query.companies.findFirst({
    where: (c, { eq }) => eq(c.slug, 'prestige-realty'),
  }))!;
  const comp1Id = company1.id;

  await db
    .insert(companyAiSettings)
    .values({
      companyId: comp1Id,
      killSwitch: false,
      allowedTiers: ['T0', 'T1', 'T2'],
      dailyActionCap: 1000,
    })
    .onConflictDoNothing();

  // Company B: Sobha Developers
  const [comp2] = await db
    .insert(companies)
    .values({
      name: 'Sobha Developers',
      slug: 'sobha-developers',
      plan: 'growth',
      status: 'active',
      branding: {
        primaryColor: '#7c3aed',
        logoUrl: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=128&auto=format&fit=crop',
      },
    })
    .onConflictDoNothing()
    .returning();

  const company2 = comp2 ?? (await db.query.companies.findFirst({
    where: (c, { eq }) => eq(c.slug, 'sobha-developers'),
  }))!;
  const comp2Id = company2.id;

  await db
    .insert(companyAiSettings)
    .values({
      companyId: comp2Id,
      killSwitch: false,
      allowedTiers: ['T0', 'T1'],
      dailyActionCap: 250,
    })
    .onConflictDoNothing();

  // =========================================================================
  // 2. Users (Admin, Manager, Agents, Pending)
  // =========================================================================
  console.info('   [2/12] Seeding Users with Role-Based Access Controls...');

  await db
    .insert(users)
    .values([
      {
        companyId: comp1Id,
        name: 'Vikram Mehta (Admin)',
        email: 'admin@prestige.com',
        passwordHash,
        role: 'company_admin',
        status: 'active',
      },
      {
        companyId: comp1Id,
        name: 'Sarah Jenkins (Manager)',
        email: 'manager@prestige.com',
        passwordHash,
        role: 'sales_manager',
        status: 'active',
      },
      {
        companyId: comp1Id,
        name: 'Rahul Sharma (Senior Agent)',
        email: 'agent@prestige.com',
        passwordHash,
        role: 'agent',
        status: 'active',
      },
      {
        companyId: comp1Id,
        name: 'Pooja Hegde (Luxury Specialist)',
        email: 'agent2@prestige.com',
        passwordHash,
        role: 'agent',
        status: 'active',
      },
      {
        companyId: comp1Id,
        name: 'Neha Gupta (Pending Approval)',
        email: 'pending@prestige.com',
        passwordHash,
        role: 'agent',
        status: 'pending_approval',
      },
      {
        companyId: comp2Id,
        name: 'Ananya Verma (Admin)',
        email: 'admin@sobha.com',
        passwordHash,
        role: 'company_admin',
        status: 'active',
      },
    ])
    .onConflictDoNothing();

  const prestigeUsers = await db.query.users.findMany({
    where: (u, { eq }) => eq(u.companyId, comp1Id),
  });
  const adminUser = prestigeUsers.find(u => u.email === 'admin@prestige.com')!;
  const managerUser = prestigeUsers.find(u => u.email === 'manager@prestige.com')!;
  const agent1 = prestigeUsers.find(u => u.email === 'agent@prestige.com')!;
  const agent2 = prestigeUsers.find(u => u.email === 'agent2@prestige.com') || agent1;

  // =========================================================================
  // 3. Chatbots & WhatsApp Configuration
  // =========================================================================
  console.info('   [3/12] Seeding Web & WhatsApp Chatbots...');

  const [botWeb] = await db
    .insert(chatbots)
    .values({
      companyId: comp1Id,
      name: 'Prestige Lakeside Concierge',
      type: 'web',
      status: 'active',
      publicKey: 'pb_pub_prestige_lakeside_001',
      config: {
        primaryColor: '#2563eb',
        welcomeMessage: 'Namaste! Welcome to Prestige Lakeside Habitat. Are you exploring luxury homes for personal residence or high-yield investment?',
        collectPhone: true,
        collectEmail: true,
      },
    })
    .onConflictDoNothing()
    .returning();

  const webBotId = botWeb?.id ?? (await db.query.chatbots.findFirst({
    where: (cb, { eq }) => eq(cb.publicKey, 'pb_pub_prestige_lakeside_001'),
  }))!.id;

  const [botWa] = await db
    .insert(chatbots)
    .values({
      companyId: comp1Id,
      name: 'Prestige WhatsApp Advisor',
      type: 'whatsapp',
      status: 'active',
      publicKey: 'pb_pub_prestige_whatsapp_002',
      config: {
        welcomeMessage: 'Hello! I am your 24/7 Prestige Living AI Advisor on WhatsApp.',
      },
    })
    .onConflictDoNothing()
    .returning();

  const waBotId = botWa?.id ?? (await db.query.chatbots.findFirst({
    where: (cb, { eq }) => eq(cb.publicKey, 'pb_pub_prestige_whatsapp_002'),
  }))!.id;

  // WhatsApp Config for Tenant A
  const existingWa1 = await db.query.whatsappConfigs.findFirst({
    where: (wc, { eq }) => eq(wc.companyId, comp1Id),
  });
  if (existingWa1) {
    await db
      .update(whatsappConfigs)
      .set({
        chatbotId: waBotId,
        businessPhoneNumber: '+919820099880',
        phoneNumberId: 'meta_pn_prestige_98200',
        verifyToken: 'propbot_verify_token_prestige_2026',
        status: 'connected',
        enableAutomation: true,
        aiAutoReplies: true,
        pauseAfterAgentReply: true,
        frustrationHandoff: true,
        autoAssignOwner: true,
      })
      .where(eq(whatsappConfigs.id, existingWa1.id));
  } else {
    await db
      .insert(whatsappConfigs)
      .values({
        companyId: comp1Id,
        chatbotId: waBotId,
        businessPhoneNumber: '+919820099880',
        phoneNumberId: 'meta_pn_prestige_98200',
        verifyToken: 'propbot_verify_token_prestige_2026',
        status: 'connected',
        enableAutomation: true,
        aiAutoReplies: true,
        pauseAfterAgentReply: true,
        frustrationHandoff: true,
        autoAssignOwner: true,
        templateName: 'property_inquiry_details',
      })
      .onConflictDoNothing();
  }

  // Chatbot for Tenant B
  const [botSobha] = await db
    .insert(chatbots)
    .values({
      companyId: comp2Id,
      name: 'Sobha Dream AI',
      type: 'web',
      status: 'active',
      publicKey: 'pb_pub_sobha_dream_001',
      config: {},
    })
    .onConflictDoNothing()
    .returning();

  const sobhaBotId = botSobha?.id ?? (await db.query.chatbots.findFirst({
    where: (cb, { eq }) => eq(cb.publicKey, 'pb_pub_sobha_dream_001'),
  }))!.id;

  // WhatsApp Config for Tenant B
  const existingWa2 = await db.query.whatsappConfigs.findFirst({
    where: (wc, { eq }) => eq(wc.companyId, comp2Id),
  });
  if (existingWa2) {
    await db
      .update(whatsappConfigs)
      .set({
        chatbotId: sobhaBotId,
        status: 'connected',
        businessPhoneNumber: '+919845011220',
        phoneNumberId: 'meta_pn_sobha_98450',
        verifyToken: 'propbot_verify_token_sobha_2026',
        enableAutomation: true,
        aiAutoReplies: true,
      })
      .where(eq(whatsappConfigs.id, existingWa2.id));
  } else {
    await db
      .insert(whatsappConfigs)
      .values({
        companyId: comp2Id,
        chatbotId: sobhaBotId,
        businessPhoneNumber: '+919845011220',
        phoneNumberId: 'meta_pn_sobha_98450',
        verifyToken: 'propbot_verify_token_sobha_2026',
        status: 'connected',
        enableAutomation: true,
        aiAutoReplies: true,
        templateName: 'property_inquiry_details',
      })
      .onConflictDoNothing();
  }

  // =========================================================================
  // 4. Projects, Units, and Brochures
  // =========================================================================
  console.info('   [4/12] Seeding Real Estate Projects, Inventory Units & Brochures...');

  const [proj1] = await db
    .insert(projects)
    .values({
      companyId: comp1Id,
      name: 'Prestige Lakeside Habitat',
      builderName: 'Prestige Group',
      reraNo: 'PRM/KA/RERA/1251/446/PR/171015/000452',
      location: 'ITPL Main Road, Whitefield, Bangalore',
      status: 'ready_to_move',
      possessionDate: 'Ready for Immediate Possession',
      overview: 'Sprawling 102-acre township overlooking Varthur Lake featuring Disney-themed landscape architecture, 4 grand clubhouses, and 80% open landscaped greens.',
      amenities: ['4 Grand Clubhouses', 'Olympic Swimming Pool', 'Tennis Courts', 'Private Mini Theatre', 'Lake Promenade Deck', 'Jogging Track'],
      usps: ['Lake Facing Balconies', 'Ready to Move In (No GST)', 'Direct Metro Connectivity to ITPL'],
      gallery: [
        'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&auto=format&fit=crop',
      ],
    })
    .onConflictDoNothing()
    .returning();

  const project1Id = proj1?.id ?? (await db.query.projects.findFirst({
    where: (p, { eq }) => eq(p.name, 'Prestige Lakeside Habitat'),
  }))!.id;

  const [proj2] = await db
    .insert(projects)
    .values({
      companyId: comp1Id,
      name: 'Prestige Sanctuary Private Villas',
      builderName: 'Prestige Group',
      reraNo: 'PRM/KA/RERA/1250/303/PR/220601/004958',
      location: 'Nandi Hills Foothills, Hebbal Corridor, Bangalore',
      status: 'under_construction',
      possessionDate: 'December 2026',
      overview: 'Uber-luxury hillside presidential villas with private swimming pools, landscaped terrace decks, and personal concierge services.',
      amenities: ['Private Plunge Pools', 'Helipad Access', 'Golf Putting Green', 'Ayurvedic Wellness Spa', 'Private Butler Service'],
      usps: ['360-Degree Hill Views', 'RERA Compliant Masterplan', 'Gated High-Security Community'],
      gallery: [
        'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800&auto=format&fit=crop',
      ],
    })
    .onConflictDoNothing()
    .returning();

  const project2Id = proj2?.id ?? (await db.query.projects.findFirst({
    where: (p, { eq }) => eq(p.name, 'Prestige Sanctuary Private Villas'),
  }))!.id;

  // Tenant B project
  const [proj3] = await db
    .insert(projects)
    .values({
      companyId: comp2Id,
      name: 'Sobha Dream Acres',
      builderName: 'Sobha Developers',
      reraNo: 'PRM/KA/RERA/1251/446/PR/170915/000155',
      location: 'Panathur Main Road, Off Outer Ring Road, Bangalore',
      status: 'ready_to_move',
      overview: 'Premium 81-acre residential community built with precast German technology.',
    })
    .onConflictDoNothing()
    .returning();

  const project3Id = proj3?.id ?? (await db.query.projects.findFirst({
    where: (p, { eq }) => eq(p.name, 'Sobha Dream Acres'),
  }))!.id;

  // Units
  await db
    .insert(units)
    .values([
      {
        companyId: comp1Id,
        projectId: project1Id,
        tower: 'Tower A',
        floor: 1,
        unitNumber: 'A-104',
        bhk: 2,
        carpetAreaSqft: '1250.00',
        superAreaSqft: '1540.00',
        price: '12500000.00',
        status: 'available',
        facing: 'East',
        furnishing: 'semi_furnished',
      },
      {
        companyId: comp1Id,
        projectId: project1Id,
        tower: 'Tower B',
        floor: 8,
        unitNumber: 'B-802',
        bhk: 3,
        carpetAreaSqft: '1850.00',
        superAreaSqft: '2280.00',
        price: '21000000.00',
        status: 'available',
        facing: 'North-East (Lake Facing)',
        furnishing: 'unfurnished',
      },
      {
        companyId: comp1Id,
        projectId: project1Id,
        tower: 'Tower B',
        floor: 14,
        unitNumber: 'B-1401',
        bhk: 3,
        carpetAreaSqft: '2150.00',
        superAreaSqft: '2650.00',
        price: '26500000.00',
        status: 'available',
        facing: 'Lake Facing Corner',
        furnishing: 'semi_furnished',
      },
      {
        companyId: comp1Id,
        projectId: project1Id,
        tower: 'Villa Enclave',
        floor: 1,
        unitNumber: 'Villa Palm-12',
        bhk: 4,
        carpetAreaSqft: '4200.00',
        superAreaSqft: '5150.00',
        price: '58000000.00',
        status: 'available',
        facing: 'East Facing Vastu',
        furnishing: 'unfurnished',
      },
      {
        companyId: comp1Id,
        projectId: project2Id,
        tower: 'Sanctuary Enclave',
        floor: 1,
        unitNumber: 'Estate-04',
        bhk: 4,
        carpetAreaSqft: '4850.00',
        superAreaSqft: '5920.00',
        price: '65000000.00',
        status: 'available',
        facing: 'North',
        furnishing: 'unfurnished',
      },
      {
        companyId: comp2Id,
        projectId: project3Id,
        tower: 'Wing 2',
        floor: 4,
        unitNumber: 'W2-402',
        bhk: 2,
        carpetAreaSqft: '1205.00',
        superAreaSqft: '1480.00',
        price: '11500000.00',
        status: 'available',
        facing: 'East',
      },
    ])
    .onConflictDoNothing();

  // Brochures
  await db
    .insert(brochures)
    .values([
      {
        companyId: comp1Id,
        projectId: project1Id,
        title: 'Prestige Lakeside Habitat - Official Masterplan & Floor Plans',
        fileUrl: 'https://prestigeconstructions.com/brochures/prestige-lakeside.pdf',
        isGated: true,
        downloadCount: 142,
      },
      {
        companyId: comp1Id,
        projectId: project2Id,
        title: 'Prestige Sanctuary - Presidential Villas Brochure',
        fileUrl: 'https://prestigeconstructions.com/brochures/prestige-sanctuary.pdf',
        isGated: true,
        downloadCount: 68,
      },
    ])
    .onConflictDoNothing();

  // =========================================================================
  // 5. Contacts & CRM Leads (65 Full Fidelity Records)
  // =========================================================================
  console.info('   [5/12] Generating 65 Scored Leads Across Full CRM Kanban Pipeline...');

  const kanbanStages = [
    'new', 'contacted', 'qualified', 'site_visit_scheduled',
    'site_visit_done', 'negotiation', 'converted', 'lost'
  ];
  const leadSources = ['web_chat', 'whatsapp', 'google_ads', '99acres', 'housing_com', 'referral'];

  const createdLeads: Array<{ id: string; contactId: string; status: string; intentScore: number }> = [];

  for (let i = 0; i < 65; i++) {
    const fName = FIRST_NAMES[i % FIRST_NAMES.length]!;
    const lName = LAST_NAMES[(i * 3) % LAST_NAMES.length]!;
    const phone = `+9198${String(20000000 + i * 1113).slice(0, 8)}`;
    const email = `${fName.toLowerCase()}.${lName.toLowerCase()}${i + 1}@gmail.com`;
    const locality = LOCALITIES[i % LOCALITIES.length]!;
    const tier = BUDGET_TIERS[i % BUDGET_TIERS.length]!;
    const status = kanbanStages[i % kanbanStages.length]!;
    const assignedAgent = i % 2 === 0 ? agent1.id : agent2.id;
    const source = leadSources[i % leadSources.length]!;

    // Intent score calibrated by status
    let baseScore = 40;
    if (status === 'qualified') baseScore = 75;
    if (status === 'site_visit_scheduled') baseScore = 88;
    if (status === 'site_visit_done') baseScore = 92;
    if (status === 'negotiation') baseScore = 96;
    if (status === 'converted') baseScore = 100;
    if (status === 'lost') baseScore = 25;
    const intentScore = Math.min(100, Math.max(15, baseScore + ((i % 5) * 2 - 4)));
    const intentLabel = intentScore >= 80 ? 'hot' : intentScore >= 50 ? 'warm' : 'cold';

    const [contact] = await db
      .insert(contacts)
      .values({
        companyId: comp1Id,
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
          companyId: comp1Id,
          contactId: contact.id,
          chatbotId: i % 2 === 0 ? webBotId : waBotId,
          assignedAgentId: assignedAgent,
          status,
          priority: intentScore >= 85 ? 'high' : intentScore >= 60 ? 'medium' : 'low',
          intentScore,
          intentLabel,
          source,
          buyerDna: {
            budgetMin: tier.min,
            budgetMax: tier.max,
            bhk: tier.bhk,
            localities: [locality],
            timeline: i % 3 === 0 ? 'immediate_30_days' : 'within_3_to_6_months',
            purpose: i % 4 === 0 ? 'investment' : 'self_use',
            possessionPreference: 'ready_to_move',
          },
          scoreExplanation: [
            `Budget matched: ₹${(tier.min / 10000000).toFixed(1)}Cr - ₹${(tier.max / 10000000).toFixed(1)}Cr (+25)`,
            `Verified phone: ${phone} (+15)`,
            status.includes('visit') ? 'Site visit active engagement (+30)' : 'Chat interaction completed (+10)',
          ],
          tags: [
            intentScore >= 85 ? 'high-intent' : 'warm-lead',
            tier.bhk[0]!,
            locality.split(',')[0]!.toLowerCase().replace(/\s+/g, '-'),
            i % 4 === 0 ? 'nri-buyer' : 'salaried-tech',
          ],
          nextFollowUpAt: new Date(Date.now() + (i % 7) * 86400000),
        })
        .onConflictDoNothing()
        .returning();

      if (lead) {
        createdLeads.push({
          id: lead.id,
          contactId: contact.id,
          status,
          intentScore,
        });

        // 5a. Lead Activity
        await db
          .insert(leadActivities)
          .values({
            companyId: comp1Id,
            leadId: lead.id,
            contactId: contact.id,
            activityType: 'lead_captured',
            title: `Captured lead via ${source}`,
            description: `${fName} ${lName} inquired about ${tier.bhk.join('/')} in ${locality}.`,
          })
          .onConflictDoNothing();

        // 5b. Tasks & Notes on high-intent leads
        if (intentScore >= 80) {
          await db
            .insert(tasks)
            .values({
              companyId: comp1Id,
              leadId: lead.id,
              assignedUserId: assignedAgent,
              title: `VIP Follow-up: Call ${fName} regarding Lake View pricing`,
              type: 'phone_call',
              dueDate: new Date(Date.now() + 86400000 * 2),
              priority: 'high',
              status: 'pending',
            })
            .onConflictDoNothing();

          await db
            .insert(notes)
            .values({
              companyId: comp1Id,
              leadId: lead.id,
              userId: agent1.id,
              content: `Spoke on WhatsApp. Extremely keen on Tower B 3BHK high floor. Requested builder payment breakdown schedule.`,
            })
            .onConflictDoNothing();
        }
      }
    }
  }

  // =========================================================================
  // 6. Appointments & Site Visits
  // =========================================================================
  console.info('   [6/12] Scheduling Site Visits and Tours...');

  const visitLeads = createdLeads.filter(
    l => l.status === 'site_visit_scheduled' || l.status === 'site_visit_done'
  );

  for (let idx = 0; idx < visitLeads.length; idx++) {
    const vLead = visitLeads[idx]!;
    const isDone = vLead.status === 'site_visit_done';
    const visitDate = new Date(Date.now() + (isDone ? -3 : 2) * 86400000 * (1 + (idx % 3)));

    await db
      .insert(appointments)
      .values({
        companyId: comp1Id,
        leadId: vLead.id,
        projectId: idx % 2 === 0 ? project1Id : project2Id,
        assignedAgentId: idx % 2 === 0 ? agent1.id : agent2.id,
        scheduledAt: visitDate,
        durationMinutes: 60,
        status: isDone ? 'completed' : 'scheduled',
        appointmentType: 'site_visit',
        location: idx % 2 === 0 ? 'Prestige Lakeside Experience Center, Whitefield' : 'Prestige Sanctuary Villa Club',
        notes: isDone ? 'Client visited with spouse. Loved the clubhouse and lake views.' : 'Golf cart requested for elderly parents.',
        reminderSent24h: isDone,
      })
      .onConflictDoNothing();
  }

  // =========================================================================
  // 7. Shortlist Rooms
  // =========================================================================
  console.info('   [7/12] Generating Interactive Shortlist Rooms...');

  const sampleLead = createdLeads.find(l => l.intentScore >= 90) || createdLeads[0];
  if (sampleLead) {
    const [room] = await db
      .insert(shortlistRooms)
      .values({
        companyId: comp1Id,
        leadId: sampleLead.id,
        token: 'shortlist_demo_vip_room_token_99',
        title: 'Curated 3BHK Luxury Shortlist for Amit Patel',
        matchedPreferences: {
          bhk: ['3BHK', '3BHK Luxury'],
          maxBudget: 28000000,
          preferredLocation: 'Whitefield',
        },
        expiresAt: new Date(Date.now() + 30 * 86400000),
        viewsCount: 7,
        totalTimeSpentSeconds: 480,
        status: 'active',
      })
      .onConflictDoNothing()
      .returning();

    if (room) {
      await db
        .insert(shortlistItems)
        .values([
          {
            shortlistId: room.id,
            projectId: project1Id,
            orderIndex: 1,
            matchScore: 98,
            matchHighlights: ['100% Lake View', 'Immediate Handover', '3BHK 2150 Sqft'],
            viewCount: 4,
          },
          {
            shortlistId: room.id,
            projectId: project2Id,
            orderIndex: 2,
            matchScore: 84,
            matchHighlights: ['Private Swimming Pool', 'RERA Compliant Masterplan'],
            viewCount: 3,
          },
        ])
        .onConflictDoNothing();
    }
  }

  // =========================================================================
  // 8. Conversations & Live Chat Messages (Multi-Turn WhatsApp & Web Inbox)
  // =========================================================================
  console.info('   [8/12] Seeding Production WhatsApp Shared Inbox & Multi-Turn AI Conversations...');

  const CONVERSATION_SCENARIOS = [
    // 1. Needs Human - Escalation over pricing discount
    {
      channel: 'whatsapp',
      status: 'needs_human',
      assignedAgentId: agent1.id,
      metadata: {
        sentiment: 'frustrated',
        aiPaused: true,
        handoffTrigger: 'keyword_escalation',
        handoffReason: 'Customer requested human manager over discount discrepancy',
        lastInboundAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      },
      messages: [
        { senderType: 'bot', content: 'Namaste! Welcome to Prestige Living WhatsApp Concierge. How can I assist your luxury property search today?' },
        { senderType: 'user', content: 'Hi, I received a launch brochure for Prestige Falcon City 3BHK. Your sales rep promised ₹2.05 Cr but the brochure shows ₹2.25 Cr. I want to speak to an agent right now, this is unacceptable.' },
        { senderType: 'bot', content: 'I understand your concern regarding the pricing discrepancy. Let me connect you directly with our Senior Sales Advisor to review the launch pricing offers for you.' },
      ],
    },
    // 2. Needs Human - Angry sentiment on delayed booking receipt
    {
      channel: 'whatsapp',
      status: 'needs_human',
      assignedAgentId: adminUser.id,
      metadata: {
        sentiment: 'frustrated',
        aiPaused: true,
        handoffTrigger: 'sentiment_frustration',
        handoffReason: 'Frustrated client demanding booking receipt confirmation',
        lastInboundAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
      },
      messages: [
        { senderType: 'user', content: 'I transferred ₹5,00,000 booking token yesterday for Tower B Unit 1204 and still have not received my formal builder receipt. This is ridiculous, connect me to someone immediately.' },
        { senderType: 'bot', content: 'I sincerely apologize for the delay. I have paused automated replies and notified our Accounts & Sales Manager Vikram Mehta to verify your transaction right away.' },
      ],
    },
    // 3. Needs Human - Bespoke NRI payment terms
    {
      channel: 'whatsapp',
      status: 'needs_human',
      assignedAgentId: agent2.id,
      metadata: {
        sentiment: 'neutral',
        aiPaused: true,
        handoffTrigger: 'high_intent_custom_deal',
        handoffReason: 'NRI buyer in Dubai requesting staggered NRE payment milestones',
        lastInboundAt: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
      },
      messages: [
        { senderType: 'bot', content: 'Welcome to Prestige Living. Are you exploring residences for self-use or high-yield investment?' },
        { senderType: 'user', content: 'Hello, I am based out of Dubai looking to book 2 luxury villas in Prestige Sanctuary. We need custom staggered milestones aligned with NRE remittances. Representative please.' },
        { senderType: 'bot', content: 'Thank you for reaching out! A dedicated NRI Luxury Portfolio Advisor will take over this chat to assist with international remittable contracts.' },
      ],
    },
    // 4. Needs Human - Bank loan approval query
    {
      channel: 'whatsapp',
      status: 'needs_human',
      assignedAgentId: null, // Unassigned & Needs Human!
      metadata: {
        sentiment: 'negative',
        aiPaused: true,
        handoffTrigger: 'keyword_human',
        handoffReason: 'Buyer requesting human assistance with SBI APF loan pre-approval',
        lastInboundAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      },
      messages: [
        { senderType: 'user', content: 'Can someone please guide me on SBI pre-approved home loan tenure for Prestige Elm Park? Human agent please.' },
        { senderType: 'bot', content: 'A property advisor will continue this conversation shortly.' },
      ],
    },
    // 5. AI Handled - Multi-turn 3BHK pricing and brochure delivery
    {
      channel: 'whatsapp',
      status: 'bot',
      assignedAgentId: agent1.id,
      metadata: {
        sentiment: 'positive',
        aiPaused: false,
        lastInboundAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      },
      messages: [
        { senderType: 'user', content: 'Hi, what are the starting prices for 3BHK units at Prestige Elm Park in Whitefield?' },
        { senderType: 'bot', content: 'Namaste! At Prestige Elm Park in Whitefield, luxury 3BHK units (1,850 sq.ft.) start at ₹2.10 Cr all-inclusive. All units overlook landscaped central courtyards with RERA registration PRM/KA/RERA/1251/446/PR/171015/000452. Would you like the official PDF brochure?' },
        { senderType: 'user', content: 'Yes please send the brochure.' },
        { senderType: 'bot', content: '📄 Prestige Elm Park Complete Brochure has been dispatched: https://propbot.pro/brochures/prestige-elm-park-rera.pdf. Would you also like to schedule a site visit this weekend?' },
      ],
    },
    // 6. AI Handled - Amenities & Sports Facilities inquiry
    {
      channel: 'whatsapp',
      status: 'bot',
      assignedAgentId: agent1.id,
      metadata: {
        sentiment: 'positive',
        aiPaused: false,
        lastInboundAt: new Date(Date.now() - 50 * 60 * 1000).toISOString(),
      },
      messages: [
        { senderType: 'user', content: 'What clubhouse amenities are provided at Prestige Lakeside Habitat?' },
        { senderType: 'bot', content: 'Prestige Lakeside Habitat features a 50,000 sq.ft. clubhouse with an Olympic-length swimming pool, 4 badminton courts, tennis courts, a mini-theatre, dedicated pet park, and 24/7 power backup.' },
        { senderType: 'user', content: 'Looks great! Can I visit this Saturday?' },
        { senderType: 'bot', content: 'Certainly! I have reserved your VIP physical walkthrough for Saturday at 11:00 AM. A calendar invitation has been generated for your visit.' },
      ],
    },
    // 7. AI Handled - RERA Carpet Area Verification
    {
      channel: 'whatsapp',
      status: 'bot',
      assignedAgentId: agent2.id,
      metadata: {
        sentiment: 'neutral',
        aiPaused: false,
        lastInboundAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      },
      messages: [
        { senderType: 'user', content: 'Is the RERA carpet area verified for Tower C 2BHK?' },
        { senderType: 'bot', content: 'Yes, 100% verified. Tower C 2BHK carpet area is 1,180 sq.ft. with a 75 sq.ft. utility deck. RERA registration number PRM/KA/RERA/1251/446/PR/171015/000452 is officially approved.' },
      ],
    },
    // 8. AI Handled - Penthouse immediate possession
    {
      channel: 'whatsapp',
      status: 'bot',
      assignedAgentId: null, // Unassigned & Bot
      metadata: {
        sentiment: 'positive',
        aiPaused: false,
        lastInboundAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      },
      messages: [
        { senderType: 'user', content: 'Do you have ready-to-move 4BHK penthouses with OC received?' },
        { senderType: 'bot', content: 'Yes, we have 2 exclusive 4BHK Sky Penthouses (3,650 sq.ft.) at Prestige White Meadows with full Occupancy Certificate (OC). Ready for immediate possession starting at ₹5.20 Cr.' },
      ],
    },
    // 9. Mine (Agent Assigned to adminUser.id) - Negotiations & Developer Credit
    {
      channel: 'whatsapp',
      status: 'agent',
      assignedAgentId: adminUser.id,
      metadata: {
        sentiment: 'positive',
        aiPaused: true,
        agentTakenOver: true,
        lastInboundAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
      },
      messages: [
        { senderType: 'user', content: 'Hi Vikram, can the developer offer any stamp duty waiver if we sign agreement this week?' },
        { senderType: 'agent', content: 'Hello! Yes, if you complete the agreement formalities by Friday, management has approved a 2% developer credit against registration costs. Let me share the revised cost sheet.' },
        { senderType: 'user', content: 'Thank you Vikram, please send it over.' },
        { senderType: 'agent', content: 'Sending over the approved cost sheet right now!' },
      ],
    },
    // 10. Mine (Agent Assigned to adminUser.id) - Rescheduling Private Tour
    {
      channel: 'whatsapp',
      status: 'agent',
      assignedAgentId: adminUser.id,
      metadata: {
        sentiment: 'positive',
        aiPaused: true,
        agentTakenOver: true,
        lastInboundAt: new Date(Date.now() - 75 * 60 * 1000).toISOString(),
      },
      messages: [
        { senderType: 'user', content: 'Hi Vikram, can we move our site visit from Saturday to Sunday 10 AM?' },
        { senderType: 'agent', content: 'Absolutely! I have rescheduled your VIP site visit to Sunday 10:00 AM. Our chauffeur will pick you up from Indiranagar.' },
        { senderType: 'user', content: 'Perfect, see you Sunday.' },
      ],
    },
    // 11. Mine (Agent Assigned to adminUser.id) - Loan Subvention Confirmation
    {
      channel: 'whatsapp',
      status: 'agent',
      assignedAgentId: adminUser.id,
      metadata: {
        sentiment: 'neutral',
        aiPaused: true,
        agentTakenOver: true,
        lastInboundAt: new Date(Date.now() - 110 * 60 * 1000).toISOString(),
      },
      messages: [
        { senderType: 'user', content: 'Vikram, which bank has the lowest interest rate for the 80:20 payment scheme?' },
        { senderType: 'agent', content: 'HDFC currently offers 8.45% under our corporate developer tie-up, with zero processing charges for Prestige buyers.' },
      ],
    },
    // 12. Agent Assigned to agent1.id - Unit Reservation
    {
      channel: 'whatsapp',
      status: 'agent',
      assignedAgentId: agent1.id,
      metadata: {
        sentiment: 'positive',
        aiPaused: true,
        agentTakenOver: true,
        lastInboundAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
      },
      messages: [
        { senderType: 'user', content: 'Can we hold Unit 1402 on the 14th floor for 48 hours?' },
        { senderType: 'agent', content: 'Unit 1402 has been soft-blocked for you until Thursday 6 PM. Looking forward to finalizing your application.' },
      ],
    },
    // 13. Closed - Successful Booking
    {
      channel: 'whatsapp',
      status: 'closed',
      assignedAgentId: agent1.id,
      metadata: {
        sentiment: 'positive',
        aiPaused: true,
        closedReason: 'Booking token received and allotment letter dispatched',
        lastInboundAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      },
      messages: [
        { senderType: 'user', content: 'Booking amount paid online. Thank you for making the process so smooth!' },
        { senderType: 'bot', content: 'Heartiest congratulations on your new home at Prestige Lakeside Habitat! Your Allotment Letter has been emailed to you.' },
      ],
    },
    // 14. Closed - Site Visit Completed
    {
      channel: 'whatsapp',
      status: 'closed',
      assignedAgentId: adminUser.id,
      metadata: {
        sentiment: 'positive',
        aiPaused: true,
        closedReason: 'Physical tour completed successfully',
        lastInboundAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
      },
      messages: [
        { senderType: 'user', content: 'The physical tour was fantastic yesterday. We loved the corner 3BHK unit.' },
        { senderType: 'agent', content: 'It was a pleasure hosting you! Feel free to reach out when you are ready for the documentation.' },
      ],
    },
    // 15. Unassigned & AI Active
    {
      channel: 'whatsapp',
      status: 'bot',
      assignedAgentId: null,
      metadata: {
        sentiment: 'neutral',
        aiPaused: false,
        lastInboundAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      },
      messages: [
        { senderType: 'user', content: 'Inquiring from MagicBricks. Are there any launch discounts for the first 50 bookings?' },
        { senderType: 'bot', content: 'Yes! Early-bird buyers receive an inaugural discount of ₹300 per sq.ft. plus zero club membership fees. Would you like to view eligible units?' },
      ],
    },
  ];

  const chatLeads = createdLeads.slice(0, 16);
  for (let idx = 0; idx < chatLeads.length; idx++) {
    const cLead = chatLeads[idx]!;
    const scenario = CONVERSATION_SCENARIOS[idx % CONVERSATION_SCENARIOS.length]!;

    let conv = await db.query.conversations.findFirst({
      where: (cv, { and: qAnd, eq: qEq }) =>
        qAnd(
          qEq(cv.companyId, comp1Id),
          qEq(cv.contactId, cLead.contactId),
          qEq(cv.channel, scenario.channel),
        ),
    });

    if (!conv) {
      const [inserted] = await db
        .insert(conversations)
        .values({
          companyId: comp1Id,
          chatbotId: scenario.channel === 'whatsapp' ? waBotId : webBotId,
          contactId: cLead.contactId,
          leadId: cLead.id,
          channel: scenario.channel,
          status: scenario.status,
          assignedAgentId: scenario.assignedAgentId,
          metadata: scenario.metadata,
        })
        .returning();
      conv = inserted;
    } else {
      await db
        .update(conversations)
        .set({
          status: scenario.status,
          assignedAgentId: scenario.assignedAgentId,
          metadata: scenario.metadata,
          updatedAt: new Date(),
        })
        .where(eq(conversations.id, conv.id));
    }

    if (conv) {
      await db.delete(messages).where(eq(messages.conversationId, conv.id));

      const now = Date.now();
      const messageRows = scenario.messages.map((m, mIdx) => ({
        companyId: comp1Id,
        conversationId: conv!.id,
        senderType: m.senderType,
        content: m.content,
        latencyMs: m.senderType === 'bot' ? 350 + mIdx * 120 : undefined,
        createdAt: new Date(now - (scenario.messages.length - mIdx) * 5 * 60 * 1000),
      }));

      await db.insert(messages).values(messageRows);
    }
  }

  // Also seed WhatsApp config & conversations for Sobha (comp2Id) and legacy tenant (if exists)
  const extraCompanies = [comp2Id];
  const legacyCompany = await db.query.companies.findFirst({
    where: (c, { eq }) => eq(c.id, '11111111-1111-1111-1111-111111111101'),
  });
  if (legacyCompany) {
    extraCompanies.push(legacyCompany.id);
    const existingLegacyWa = await db.query.whatsappConfigs.findFirst({
      where: (wc, { eq }) => eq(wc.companyId, legacyCompany.id),
    });
    if (!existingLegacyWa) {
      await db
        .insert(whatsappConfigs)
        .values({
          companyId: legacyCompany.id,
          chatbotId: waBotId,
          businessPhoneNumber: '+919820099880',
          phoneNumberId: 'meta_pn_prestige_98200',
          verifyToken: 'propbot_verify_token_prestige_2026',
          status: 'connected',
          enableAutomation: true,
          aiAutoReplies: true,
        })
        .onConflictDoNothing();
    }
  }

  for (const exCompId of extraCompanies) {
    const exContacts = await db.query.contacts.findMany({
      where: (ct, { eq }) => eq(ct.companyId, exCompId),
      limit: 5,
    });
    for (let cIdx = 0; cIdx < exContacts.length; cIdx++) {
      const contact = exContacts[cIdx]!;
      const sc = CONVERSATION_SCENARIOS[cIdx % CONVERSATION_SCENARIOS.length]!;
      let cConv = await db.query.conversations.findFirst({
        where: (cv, { and, eq }) =>
          and(eq(cv.companyId, exCompId), eq(cv.contactId, contact.id), eq(cv.channel, 'whatsapp')),
      });
      if (!cConv) {
        const [inserted] = await db
          .insert(conversations)
          .values({
            companyId: exCompId,
            chatbotId: waBotId,
            contactId: contact.id,
            channel: 'whatsapp',
            status: sc.status,
            metadata: sc.metadata,
          })
          .returning();
        cConv = inserted;
      }
      if (cConv) {
        await db.delete(messages).where(eq(messages.conversationId, cConv.id));
        const now = Date.now();
        const messageRows = sc.messages.map((m, mIdx) => ({
          companyId: exCompId,
          conversationId: cConv!.id,
          senderType: m.senderType,
          content: m.content,
          latencyMs: m.senderType === 'bot' ? 350 + mIdx * 120 : undefined,
          createdAt: new Date(now - (sc.messages.length - mIdx) * 5 * 60 * 1000),
        }));
        await db.insert(messages).values(messageRows);
      }
    }
  }

  // =========================================================================
  // 9. Workflows (Visual Automation Engine)
  // =========================================================================
  console.info('   [9/12] Seeding Production Visual Workflows & Runs...');

  const [wf1] = await db
    .insert(workflows)
    .values({
      companyId: comp1Id,
      name: 'Instant Lead WhatsApp Qualification & Brochure Delivery',
      description: 'Triggered upon new lead creation. Instantly sends RERA brochure via WhatsApp and alerts agent if intent score exceeds 75%.',
      status: 'active',
      version: 1,
      createdBy: adminUser.id,
      definition: {
        trigger: { event: 'lead_created' },
        nodes: [
          {
            id: 'node-trigger',
            type: 'trigger',
            label: 'New Lead Created',
            position: { x: 100, y: 150 },
            config: { event: 'lead_created' },
          },
          {
            id: 'node-action-wa',
            type: 'action',
            label: 'Send WhatsApp Welcome & Brochure',
            position: { x: 380, y: 150 },
            config: { action: 'send_whatsapp', template: 'prestige_welcome_brochure' },
          },
          {
            id: 'node-delay',
            type: 'delay',
            label: 'Wait 15 Minutes',
            position: { x: 680, y: 150 },
            config: { durationMinutes: 15 },
          },
          {
            id: 'node-cond',
            type: 'condition',
            label: 'Intent Score >= 75?',
            position: { x: 960, y: 150 },
            config: { field: 'intentScore', operator: 'gte', value: 75 },
          },
          {
            id: 'node-assign',
            type: 'action',
            label: 'Assign Senior Property Advisor',
            position: { x: 1240, y: 150 },
            config: { action: 'assign_agent' },
          },
        ],
        edges: [
          { id: 'e1', source: 'node-trigger', target: 'node-action-wa' },
          { id: 'e2', source: 'node-action-wa', target: 'node-delay' },
          { id: 'e3', source: 'node-delay', target: 'node-cond' },
          { id: 'e4', source: 'node-cond', target: 'node-assign' },
        ],
      },
    })
    .onConflictDoNothing()
    .returning();

  await db
    .insert(workflows)
    .values({
      companyId: comp1Id,
      name: 'VIP Site Visit Reminder & Guarded Token Booking Link',
      description: 'Dispatches 24h WhatsApp reminder with Google Maps pin before scheduled site visit, then triggers token booking flow.',
      status: 'active',
      version: 1,
      createdBy: adminUser.id,
      definition: {
        trigger: { event: 'site_visit_scheduled' },
        nodes: [
          {
            id: 'node-trigger',
            type: 'trigger',
            label: 'Site Visit Scheduled',
            position: { x: 100, y: 150 },
            config: { event: 'site_visit_scheduled' },
          },
          {
            id: 'node-delay',
            type: 'delay',
            label: 'Wait until 24h Before Tour',
            position: { x: 380, y: 150 },
            config: { durationMinutes: 1440 },
          },
          {
            id: 'node-send-pin',
            type: 'action',
            label: 'Send Location Pin & Gate Pass',
            position: { x: 680, y: 150 },
            config: { action: 'send_whatsapp', template: 'site_visit_gate_pass' },
          },
          {
            id: 'node-token-link',
            type: 'action',
            label: 'Generate Guarded Token Booking Link',
            position: { x: 980, y: 150 },
            config: { action: 'generate_booking_payment' },
          },
        ],
        edges: [
          { id: 'e1', source: 'node-trigger', target: 'node-delay' },
          { id: 'e2', source: 'node-delay', target: 'node-send-pin' },
          { id: 'e3', source: 'node-send-pin', target: 'node-token-link' },
        ],
      },
    })
    .onConflictDoNothing()
    .returning();

  const workflow1Id = wf1?.id ?? (await db.query.workflows.findFirst({
    where: (w, { eq }) => eq(w.companyId, comp1Id),
  }))?.id;

  if (workflow1Id) {
    await db
      .insert(workflowRuns)
      .values([
        {
          companyId: comp1Id,
          workflowId: workflow1Id,
          status: 'completed',
          currentNodeId: 'node-assign',
          context: { leadId: sampleLead?.id, score: 92 },
        },
        {
          companyId: comp1Id,
          workflowId: workflow1Id,
          status: 'running',
          currentNodeId: 'node-delay',
          context: { leadId: chatLeads[1]?.id, score: 78 },
        },
      ])
      .onConflictDoNothing();
  }

  // =========================================================================
  // 10. Growth Segments & RERA-Compliant Campaigns
  // =========================================================================
  console.info('   [10/12] Seeding Audience Segments & Omnichannel Campaigns...');

  const [seg1] = await db
    .insert(segments)
    .values({
      companyId: comp1Id,
      name: 'High-Net-Worth Whitefield Investors',
      description: 'Prospects with budget >= ₹2 Cr seeking 3BHK/4BHK in Whitefield corridor with intent score > 75.',
      filterCriteria: {
        locality: 'Whitefield',
        minBudget: 20000000,
        intentScoreGte: 75,
      },
      cachedCount: 42,
      createdBy: adminUser.id,
    })
    .onConflictDoNothing()
    .returning();

  await db
    .insert(segments)
    .values({
      companyId: comp1Id,
      name: 'Ready-to-Move 3BHK Seekers',
      description: 'Families looking for immediate possession 3BHK apartments.',
      filterCriteria: {
        bhk: '3BHK',
        timeline: 'immediate_30_days',
      },
      cachedCount: 28,
      createdBy: managerUser.id,
    })
    .onConflictDoNothing()
    .returning();

  const segment1Id = seg1?.id ?? (await db.query.segments.findFirst({
    where: (s, { eq }) => eq(s.name, 'High-Net-Worth Whitefield Investors'),
  }))?.id;

  if (segment1Id) {
    await db
      .insert(campaigns)
      .values([
        {
          companyId: comp1Id,
          segmentId: segment1Id,
          name: 'Prestige Glenwood Exclusive Pre-Launch (RERA Verified)',
          channel: 'whatsapp',
          status: 'completed',
          scheduleType: 'immediate',
          variantA: {
            headline: 'Exclusive Pre-Launch Access: Prestige Glenwood Residences',
            body: 'Dear Valued Buyer, explore premium 3BHK & 4BHK lakeside residences with private balcony greens. RERA Registration No: PRM/KA/RERA/1251/446/PR/171015/000452. Special pre-launch pricing valid this week only.',
            callToAction: 'View Price Sheet',
          },
          stats: {
            recipients: 150,
            sent: 150,
            delivered: 146,
            read: 128,
            clicked: 84,
            optedOut: 1,
          },
          completedAt: new Date(),
        },
        {
          companyId: comp1Id,
          segmentId: segment1Id,
          name: 'Lakeside Habitat Festive Token Booking Offer',
          channel: 'whatsapp',
          status: 'running',
          scheduleType: 'immediate',
          variantA: {
            headline: 'Festive Token Booking Discount: Save ₹5,00,000 on Tower B',
            body: 'Book your luxury lake-facing 3BHK apartment with a guarded token of ₹1,00,000. Full refund guaranteed within 15 days if not satisfied.',
            callToAction: 'Claim Festive Token',
          },
          stats: {
            recipients: 95,
            sent: 95,
            delivered: 92,
            read: 76,
            clicked: 45,
            optedOut: 0,
          },
        },
      ])
      .onConflictDoNothing();
  }

  // =========================================================================
  // 11. Voice AI Calls & RAG Knowledge Base
  // =========================================================================
  console.info('   [11/12] Seeding Voice AI Call Records & RAG Knowledge Sources...');

  if (sampleLead) {
    await db
      .insert(voiceCalls)
      .values([
        {
          companyId: comp1Id,
          leadId: sampleLead.id,
          contactId: sampleLead.contactId,
          callSid: 'CA_voice_demo_call_001',
          direction: 'outbound_callback',
          fromNumber: '+918045678900',
          toNumber: '+919820012345',
          status: 'completed',
          durationSeconds: 184,
          recordingUrl: 'https://propbot.storage/recordings/demo_call_001.mp3',
          transcript: 'Agent AI: Namaste Mr. Patel! Calling from Prestige Living regarding your inquiry for the 3BHK Lake View residence in Tower B... Buyer: Yes! I wanted to check the floor plan and whether the price includes covered basement car parking... Agent AI: Yes, Mr. Patel, Tower B-802 includes two dedicated covered basement car parking spaces and complete club access. RERA possession is immediate with no GST...',
          summary: 'Prospective buyer verified ₹2.10 Cr budget and requested confirmed site visit for Saturday 11 AM.',
          sentiment: 'positive',
          disclosedAsAi: true,
          buyerDnaExtracted: {
            parkingRequirement: 2,
            floorPreference: 'high_floor',
            budgetVerified: true,
          },
          intentScoreDelta: 15,
        },
        {
          companyId: comp1Id,
          leadId: sampleLead.id,
          contactId: sampleLead.contactId,
          callSid: 'CA_voice_demo_call_002',
          direction: 'inbound',
          fromNumber: '+919845067890',
          toNumber: '+918045678900',
          status: 'completed',
          durationSeconds: 120,
          summary: 'Inquired about HDFC and SBI home loan approval for Prestige Sanctuary Villas.',
          sentiment: 'positive',
          disclosedAsAi: true,
        },
      ])
      .onConflictDoNothing();
  }

  // Knowledge Sources & Chunks
  const [kSource] = await db
    .insert(knowledgeSources)
    .values({
      companyId: comp1Id,
      chatbotId: webBotId,
      title: 'Prestige Lakeside Habitat - Official RERA Masterplan & Specifications',
      type: 'file',
      status: 'ready',
      filePath: '/knowledge/prestige_lakeside_rera_spec.pdf',
      chunkCount: 16,
      byteSize: 384000,
      lastTrainedAt: new Date(),
    })
    .onConflictDoNothing()
    .returning();

  if (kSource) {
    await db
      .insert(knowledgeChunks)
      .values([
        {
          sourceId: kSource.id,
          companyId: comp1Id,
          chatbotId: webBotId,
          content: 'Prestige Lakeside Habitat is a luxury residential development spanning 102 acres located along ITPL Main Road, Whitefield, Bangalore. Approved under Karnataka RERA Registration PRM/KA/RERA/1251/446/PR/171015/000452. The development comprises 3,426 units across high-rise towers and 271 independent luxury villas.',
          metadata: { chunkIndex: 0, tokenCount: 85 },
        },
        {
          sourceId: kSource.id,
          companyId: comp1Id,
          chatbotId: webBotId,
          content: 'Tower B Specifications: 29 residential floors with 4 high-speed passenger elevators and 1 service elevator. Units facing North-East enjoy unobstructed views of Varthur Lake. Standard finishes include imported marble flooring in living/dining and engineered wooden flooring in the master bedroom.',
          metadata: { chunkIndex: 1, tokenCount: 78 },
        },
      ])
      .onConflictDoNothing();
  }

  // =========================================================================
  // 12. Guarded Agent Actions, 30-Day Analytics & Notifications
  // =========================================================================
  console.info('   [12/12] Seeding Guarded AI Actions, 30-Day Historical Metrics & Notifications...');

  if (sampleLead) {
    await db
      .insert(agentActions)
      .values([
        {
          companyId: comp1Id,
          leadId: sampleLead.id,
          agentName: 'DealCloserAI',
          actionType: 'approve_token_discount',
          tier: 'T2',
          status: 'proposed',
          args: {
            unitNumber: 'Tower B - 802',
            standardPrice: 21000000,
            discountOffered: 300000,
            justification: 'Buyer ready to swipe ₹2,00,000 token today if builder waives club membership fee.',
          },
          expiresAt: new Date(Date.now() + 86400000 * 2),
        },
        {
          companyId: comp1Id,
          leadId: sampleLead.id,
          agentName: 'CampaignDispatcherAI',
          actionType: 'send_whatsapp_broadcast',
          tier: 'T1',
          status: 'approved',
          args: {
            segmentName: 'High-Net-Worth Whitefield Investors',
            recipientsCount: 42,
          },
          approvedBy: managerUser.id,
        },
      ])
      .onConflictDoNothing();
  }

  // 30-Day Analytics
  const now = new Date();
  for (let d = 30; d >= 0; d--) {
    const dayDate = new Date(now.getTime() - d * 86400000);
    const dateStr = dayDate.toISOString().split('T')[0]!;

    await db
      .insert(dailyAnalyticsRollups)
      .values({
        companyId: comp1Id,
        chatbotId: webBotId,
        date: dateStr,
        totalConversations: 18 + (d % 7) * 4,
        totalLeads: 8 + (d % 5) * 2,
        qualifiedLeads: 5 + (d % 4),
        visitsBooked: 2 + (d % 3),
        metricsJson: {
          avgResponseTimeSeconds: 1.3,
          satisfactionRatePercent: 96,
        },
      })
      .onConflictDoNothing();
  }

  // Notifications
  await db
    .insert(notifications)
    .values([
      {
        companyId: comp1Id,
        userId: adminUser.id,
        title: 'VIP Lead Captured with 96% Intent',
        message: 'Amit Patel requested a Lake View 3BHK tour and verified budget of ₹2.2 Cr.',
        type: 'lead_alert',
        isRead: false,
      },
      {
        companyId: comp1Id,
        userId: adminUser.id,
        title: 'Site Visit Confirmed for Saturday',
        message: 'Rajesh Nambiar confirmed a physical site visit for Prestige Sanctuary Villa at 11:00 AM.',
        type: 'visit_alert',
        isRead: false,
      },
      {
        companyId: comp1Id,
        userId: adminUser.id,
        title: 'T2 Action Pending Manager Approval',
        message: 'DealCloserAI proposed a ₹3,00,000 builder token concession on Tower B-802.',
        type: 'action_approval',
        isRead: false,
      },
      {
        companyId: comp1Id,
        userId: adminUser.id,
        title: 'New Team Member Request',
        message: 'Neha Gupta requested onboarding approval as Sales Agent.',
        type: 'user_approval',
        isRead: false,
      },
    ])
    .onConflictDoNothing();

  console.info('\n✅ PropBot Pro Comprehensive Database Seed Completed Successfully!');
  console.info('=============================================================================');
  console.info('🏢 Tenant A: Prestige Realty Group (slug: prestige-realty)');
  console.info('   Admin Login   : admin@prestige.com / Password123!');
  console.info('   Manager Login : manager@prestige.com / Password123!');
  console.info('   Agent Login   : agent@prestige.com / Password123!');
  console.info('   Specialist    : agent2@prestige.com / Password123!');
  console.info('   Pending User  : pending@prestige.com / Password123!');
  console.info('   Data Populated: 65 CRM Leads, 2 Projects, 5 Units, 2 Brochures,');
  console.info('                   4 Workflows, 2 Campaigns, 2 Segments, Voice Calls,');
  console.info('                   RAG Knowledge Chunks, 30-Day Analytics & Guarded Actions.');
  console.info('\n🏢 Tenant B: Sobha Developers (slug: sobha-developers)');
  console.info('   Admin Login   : admin@sobha.com / Password123!');
  console.info('=============================================================================\n');
}

if (process.argv[1] && /seed\.(ts|js)$/.test(process.argv[1]) && !process.argv[1].includes('seed-demo')) {
  runComprehensiveSeed()
    .catch(err => {
      console.error('Seed execution error:', err);
      process.exit(1);
    })
    .then(() => process.exit(0));
}
