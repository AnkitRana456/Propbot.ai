# PropBot Pro — Engineering Operations & Incident Runbook

This document defines standard operating procedures, incident triage workflows, database recovery drills, and disaster mitigation strategies for PropBot Pro production environments.

---

## 1. Service Health & Probes

| Endpoint | Type | Expected Status | Component Checked |
|---|---|---|---|
| `/healthz` | Liveness | `200 OK` | Process running, event loop healthy |
| `/healthz/ready` | Readiness | `200 OK` | PostgreSQL database connection verified via `SELECT 1` |

### Alert Triage: Readiness Probe Failing (`503 Service Unavailable`)
1. Inspect API logs: `docker logs propbot-api --tail 100` or Render service logs.
2. Verify PostgreSQL pool exhaustion:
   ```sql
   SELECT count(*), state FROM pg_stat_activity GROUP BY state;
   ```
3. If connections maxed out (`max_connections` reached), restart API service gracefully to drain orphaned pooled connections or scale PgBouncer.

---

## 2. Incident Scenarios & Remediation

### Scenario A: AI Provider Outage / High Latency
**Symptoms**: User chat responses timing out; error logs reporting `502 Bad Gateway` or `429 Too Many Requests` from LLM provider.

**Procedure**:
1. Check the Model Router metrics in the logs. The router will automatically attempt secondary fallback models (e.g. falling back from Primary LLM to secondary fallback provider).
2. If total external AI outage persists:
   - Execute tenant or global **AI Kill Switch**:
     ```bash
     # Toggle kill switch via API or DB
     UPDATE chatbots SET ai_kill_switch_active = true WHERE company_id = '<COMPANY_ID>';
     ```
   - Chatbots will immediately revert to static lead capture mode and offer human callbacks.

---

### Scenario B: BullMQ / Redis Queue Congestion
**Symptoms**: Webhook delivery delays; delayed domain event processing; queue backlog count rising.

**Procedure**:
1. Inspect BullMQ active/waiting jobs:
   ```bash
   redis-cli -u $REDIS_URL LLEN bull:outbox-events:wait
   ```
2. Verify Worker service is running (`render-worker` or Docker worker container).
3. If jobs are failing, inspect the Dead Letter Queue (failed jobs list):
   ```bash
   redis-cli -u $REDIS_URL ZRANGE bull:outbox-events:failed 0 10 WITHSCORES
   ```
4. Restart background worker to resume consumer loops.

---

### Scenario C: Outbound Webhook Delivery Failures
**Symptoms**: Customer reports downstream CRM (e.g. LeadSquared, Salesforce) not receiving new leads.

**Procedure**:
1. Query the `webhook_delivery_attempts` table:
   ```sql
   SELECT endpoint_id, status_code, error_message, created_at 
   FROM webhook_delivery_attempts 
   WHERE status = 'FAILED' 
   ORDER BY created_at DESC LIMIT 20;
   ```
2. If endpoint returns `5xx` or connection timeouts, BullMQ will automatically retry with exponential backoff (up to 5 attempts).
3. Once client fixes their endpoint, trigger manual redelivery from the Admin Dashboard under **Webhook Logs -> Retry All Failed**.

---

## 3. Database Backup & Disaster Recovery Drills

### Automated Daily Snapshots
- Render/AWS RDS automated daily snapshots retained for 30 days with point-in-time recovery (PITR).

### Manual Backup (Pre-Migration Drill)
```bash
pg_dump "$DATABASE_URL" \
  --format=custom \
  --no-owner \
  --no-acl \
  --file="backup_propbot_$(date +%Y%m%d_%H%M%S).dump"
```

### Restore Procedure
```bash
# 1. Terminate active connections
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'propbot_prod' AND pid <> pg_backend_pid();

# 2. Restore dump into database
pg_restore \
  --dbname="$DATABASE_URL" \
  --clean \
  --if-exists \
  --no-owner \
  "backup_propbot_20261013_120000.dump"
```

---

## 4. Graceful Shutdown & Zero-Downtime Deploys

The API server intercepts `SIGTERM` and `SIGINT` signals:
1. Stops accepting new inbound HTTP requests.
2. Allows in-flight requests up to **10 seconds** to complete.
3. Closes PostgreSQL client pool and Redis connections cleanly.
4. Exits with status code `0`.
