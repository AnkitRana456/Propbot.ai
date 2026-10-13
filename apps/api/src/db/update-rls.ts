import postgres from 'postgres';

const DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://propbot:propbot_password@localhost:5432/propbot_pro?sslmode=disable';

const sql = postgres(DATABASE_URL);

const TENANT_TABLES = [
  'company_ai_settings',
  'users',
  'organizations',
  'contacts',
  'chatbots',
  'knowledge_sources',
  'knowledge_chunks',
  'conversations',
  'messages',
  'leads',
  'lead_activities',
  'notes',
  'tasks',
  'projects',
  'units',
  'brochures',
  'appointments',
  'calendar_integrations',
  'availability_settings',
  'webhook_endpoints',
  'webhook_logs',
  'subscriptions',
  'audit_logs',
  'notifications',
  'domain_events',
  'agent_actions',
  'refresh_tokens',
  'knowledge_qa_overrides',
  'unanswered_questions',
  'whatsapp_configs',
  'whatsapp_inbound_events',
  'whatsapp_campaigns',
  'integrations',
  'daily_analytics_rollups',
  'campaign_spends',
  'report_schedules',
  'api_keys',
  'user_invitations',
  'subscription_invoices',
  'lead_credit_transactions',
  'objection_playbooks',
  're_engagement_logs',
  'workflows',
  'workflow_runs',
  'workflow_run_steps',
  'segments',
  'campaigns',
  'campaign_recipients',
  'booking_transactions',
  'voice_calls',
  'company_sso_configs',
];

async function updateRlsPolicies() {
  console.info('Updating RLS policies for 25 tenant tables...');

  // Ensure companies table has RLS disabled (it is tenant root)
  await sql.unsafe(`
    ALTER TABLE "companies" NO FORCE ROW LEVEL SECURITY;
    ALTER TABLE "companies" DISABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "tenant_isolation_policy" ON "companies";
  `);

  for (const table of TENANT_TABLES) {
    console.info(`Configuring RLS on ${table}...`);
    await sql.unsafe(`
      ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;
      ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS "tenant_isolation_policy" ON "${table}";
      CREATE POLICY "tenant_isolation_policy" ON "${table}"
      AS PERMISSIVE FOR ALL
      USING (
        "company_id" = NULLIF(current_setting('app.company_id', true), '')::uuid
        OR current_setting('app.company_id', true) IS NULL
      )
      WITH CHECK (
        "company_id" = NULLIF(current_setting('app.company_id', true), '')::uuid
        OR current_setting('app.company_id', true) IS NULL
      );
    `);
  }

  console.info('All 25 tenant tables successfully configured with permissive RLS policies!');
  await sql.end();
}

updateRlsPolicies().catch(err => {
  console.error('Failed to update RLS policies:', err);
  process.exit(1);
});
