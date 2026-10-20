import { flowEngine } from './flow-engine.js';

type DomainEvent = { id: string; companyId: string; type: string; payload: Record<string, unknown> };

const str = (v: unknown) => (typeof v === 'string' && v ? v : null);

/** Maps domain events to flow triggers. Called by the outbox dispatcher (once per event). */
export async function handleFlowEvent(event: DomainEvent): Promise<void> {
  const p = event.payload;
  const leadId = str(p.lead_id) ?? str(p.leadId);
  const base = { leadId, event: { ...p, id: event.id, type: event.type } };

  switch (event.type) {
    case 'lead_created':
      await flowEngine.fireTrigger(event.companyId, 'new_lead', base);
      break;
    case 'lead_status_changed': {
      const to = str(p.new_status);
      await flowEngine.fireTrigger(event.companyId, 'lead_stage_changed', {
        ...base,
        event: { ...base.event, fromStatus: p.previous_status, toStatus: to },
        match: cfg => !cfg.toStatus || cfg.toStatus === to,
      });
      break;
    }
    case 'visit_booked':
    case 'site_visit_scheduled':
      await flowEngine.fireTrigger(event.companyId, 'visit_booked', base);
      break;
    case 'form_submitted':
      await flowEngine.fireTrigger(event.companyId, 'form_submitted', base);
      break;
    default:
      break;
  }
}
