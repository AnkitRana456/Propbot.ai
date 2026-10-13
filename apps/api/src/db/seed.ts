import 'dotenv/config';
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

  const passwordHash = await hashPassword('Password123!');

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

  // WhatsApp Config
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
      templateName: 'property_inquiry_details',
    })
    .onConflictDoNothing();

  // Chatbot for Tenant B
  await db
    .insert(chatbots)
    .values({
      companyId: comp2Id,
      name: 'Sobha Dream AI',
      type: 'web',
      status: 'active',
      publicKey: 'pb_pub_sobha_dream_001',
      config: {},
    })
    .onConflictDoNothing();

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
  // 8. Conversations & Live Chat Messages
  // =========================================================================
  console.info('   [8/12] Seeding Multi-Turn AI Chatbot Conversations...');

  const chatLeads = createdLeads.slice(0, 4);
  for (let idx = 0; idx < chatLeads.length; idx++) {
    const cLead = chatLeads[idx]!;
    const [conv] = await db
      .insert(conversations)
      .values({
        companyId: comp1Id,
        chatbotId: webBotId,
        contactId: cLead.contactId,
        leadId: cLead.id,
        channel: idx % 2 === 0 ? 'web' : 'whatsapp',
        status: 'bot',
        assignedAgentId: agent1.id,
      })
      .onConflictDoNothing()
      .returning();

    if (conv) {
      await db
        .insert(messages)
        .values([
          {
            companyId: comp1Id,
            conversationId: conv.id,
            senderType: 'bot',
            content: 'Namaste! Welcome to Prestige Living. Are you exploring luxury residences for personal stay or investment?',
            latencyMs: 320,
          },
          {
            companyId: comp1Id,
            conversationId: conv.id,
            senderType: 'user',
            content: 'Hi! Looking for a 3BHK flat in Whitefield. What are the starting prices and RERA carpet areas for Tower B?',
          },
          {
            companyId: comp1Id,
            conversationId: conv.id,
            senderType: 'bot',
            content: 'In Tower B at Prestige Lakeside Habitat, 3BHK units feature 1,850 sq.ft. carpet area starting at ₹2.10 Cr all-inclusive. All units overlook Varthur Lake with RERA registration PRM/KA/RERA/1251/446/PR/171015/000452. Would you like me to reserve a VIP site visit this Saturday at 11:00 AM?',
            latencyMs: 840,
          },
          {
            companyId: comp1Id,
            conversationId: conv.id,
            senderType: 'user',
            content: 'Yes, please schedule Saturday 11 AM. My phone number is verified.',
          },
          {
            companyId: comp1Id,
            conversationId: conv.id,
            senderType: 'bot',
            content: 'Splendid! Your physical site visit is confirmed for Saturday 11:00 AM. Senior Property Advisor Rahul Sharma has been assigned to your tour and will receive you at the Experience Center clubhouse.',
            latencyMs: 410,
          },
        ])
        .onConflictDoNothing();
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
