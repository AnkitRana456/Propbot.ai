-- Migration 0024: Lead follow-up reminder tracking
-- Uses existing delivery_jobs table; adds a unique index to prevent
-- duplicate reminders (one per lead per day-interval).

-- provider stores the reminder day key e.g. 'day_1', 'day_3', 'day_7'
-- so this index prevents sending the same reminder twice for a lead.
CREATE UNIQUE INDEX IF NOT EXISTS delivery_jobs_followup_uniq
  ON delivery_jobs (lead_id, kind, provider)
  WHERE kind = 'lead_followup_reminder' AND lead_id IS NOT NULL;
