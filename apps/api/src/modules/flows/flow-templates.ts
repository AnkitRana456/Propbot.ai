import type { FlowEdge, FlowGraph, FlowNode, FlowTemplateItem } from '@propbot/shared';

export interface FlowTemplate extends FlowTemplateItem {
  graph: FlowGraph;
}

type Spec = { id: string; type: FlowNode['type']; data?: Record<string, unknown> };

/** Lays steps out left-to-right and links them in order unless explicit edges are given. */
function build(specs: Spec[], edges?: Array<[string, string, string?]>): FlowGraph {
  const nodes: FlowNode[] = specs.map((s, i) => ({ id: s.id, type: s.type, position: { x: 60 + i * 260, y: 120 + (i % 2) * 40 }, data: s.data ?? {} }));
  const links: Array<[string, string, string?]> = edges ?? specs.slice(1).map((s, i) => [specs[i]!.id, s.id] as [string, string]);
  const out: FlowEdge[] = links.map(([source, target, handle], i) => ({ id: `e${i}`, source, target, sourceHandle: handle ?? null }));
  return { nodes, edges: out };
}

export const FLOW_TEMPLATES: FlowTemplate[] = [
  {
    id: 'instant_lead_response',
    name: 'Instant lead response',
    description: 'Greets every new lead within a minute and asks what they are looking for.',
    tags: ['speed-to-lead'],
    graph: build([
      { id: 't', type: 'trigger', data: { triggerType: 'new_lead' } },
      { id: 'm1', type: 'send_message', data: { text: 'Hi {{lead.firstName}}, thanks for your interest! I am the virtual assistant for {{event.projectName}}. Are you looking for a 2, 3 or 4 BHK?' } },
      { id: 'e', type: 'end' },
    ]),
  },
  {
    id: 'visit_reminders',
    name: 'Site-visit reminders (24h and 2h)',
    description: 'Confirms a booked visit, then reminds the buyer a day and two hours before.',
    tags: ['site-visit'],
    graph: build([
      { id: 't', type: 'trigger', data: { triggerType: 'visit_booked' } },
      { id: 'm1', type: 'send_message', data: { text: 'Your site visit is confirmed for {{event.scheduledAt}}. Reply here if you need to reschedule.' } },
      { id: 'w1', type: 'wait', data: { minutes: 60 * 24 } },
      { id: 'm2', type: 'send_message', data: { text: 'Reminder: your site visit is tomorrow. We look forward to seeing you!' } },
      { id: 'w2', type: 'wait', data: { minutes: 60 * 22 } },
      { id: 'm3', type: 'send_message', data: { text: 'Your visit is in about 2 hours. Our executive will meet you at the gate.' } },
      { id: 'e', type: 'end' },
    ]),
  },
  {
    id: 'no_show_recovery',
    name: 'No-show recovery',
    description: 'When a lead moves to "lost" or "contacted" after a missed visit, offers a new slot.',
    tags: ['site-visit', 're-engagement'],
    graph: build(
      [
        { id: 't', type: 'trigger', data: { triggerType: 'lead_stage_changed', toStatus: 'contacted' } },
        { id: 'w', type: 'wait', data: { minutes: 60 } },
        { id: 'c', type: 'condition', data: { field: 'lead.status', operator: 'equals', value: 'contacted' } },
        { id: 'm', type: 'send_message', data: { text: 'Sorry we missed you, {{lead.firstName}}! Would you like to pick a new time for your site visit?' } },
        { id: 'e', type: 'end' },
      ],
      [['t', 'w'], ['w', 'c'], ['c', 'm', 'true'], ['m', 'e']],
    ),
  },
  {
    id: 'cold_lead_drip',
    name: 'Cold-lead re-engagement drip',
    description: 'Three gentle touches over a week, stopping early once the lead replies or moves stage.',
    tags: ['re-engagement'],
    graph: build(
      [
        { id: 't', type: 'trigger', data: { triggerType: 'lead_stage_changed', toStatus: 'new' } },
        { id: 'l', type: 'loop', data: { times: 3 } },
        { id: 'w', type: 'wait', data: { minutes: 60 * 48 } },
        { id: 'c', type: 'condition', data: { field: 'lead.status', operator: 'equals', value: 'new' } },
        { id: 'm', type: 'send_message', data: { text: 'Hi {{lead.firstName}}, still looking for a home? New units were just released. Want the latest prices?' } },
        { id: 'e', type: 'end' },
      ],
      [['t', 'l'], ['l', 'w', 'body'], ['w', 'c'], ['c', 'm', 'true'], ['m', 'l'], ['l', 'e', 'done']],
    ),
  },
  {
    id: 'lead_qualification_router',
    name: 'AI lead routing',
    description: 'The AI reads the first message and routes buyers, investors and renters differently.',
    tags: ['qualification'],
    graph: build(
      [
        { id: 't', type: 'trigger', data: { triggerType: 'new_lead' } },
        {
          id: 'r',
          type: 'llm_router',
          data: {
            question: '{{event.message}}',
            choices: [
              { id: 'buyer', label: 'Buyer', description: 'Wants to buy a home to live in' },
              { id: 'investor', label: 'Investor', description: 'Asks about returns, rental yield or appreciation' },
              { id: 'other', label: 'Other', description: 'Renting, broker, or unclear' },
            ],
          },
        },
        { id: 'mb', type: 'send_message', data: { text: 'Great, {{lead.firstName}}! What budget and BHK are you considering?' } },
        { id: 'mi', type: 'send_message', data: { text: 'Happy to share yield and appreciation data for the area. Which project interests you?' } },
        { id: 'mo', type: 'send_message', data: { text: 'Thanks for reaching out. A team member will contact you shortly.' } },
        { id: 'e', type: 'end' },
      ],
      [['t', 'r'], ['r', 'mb', 'buyer'], ['r', 'mi', 'investor'], ['r', 'mo', 'other'], ['r', 'mo', 'default'], ['mb', 'e'], ['mi', 'e'], ['mo', 'e']],
    ),
  },
];
