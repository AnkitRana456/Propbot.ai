import type { WorkflowDefinition } from '@propbot/shared';

export interface WorkflowTemplateItem {
  id: string;
  name: string;
  description: string;
  category: string;
  definition: {
    nodes: WorkflowDefinition['nodes'];
    edges: WorkflowDefinition['edges'];
  };
}

export const WORKFLOW_TEMPLATES: WorkflowTemplateItem[] = [
  {
    id: 'tpl_welcome_qualify',
    name: 'Welcome + qualify new lead',
    description: 'Triggered when a new lead is captured via web chat or WhatsApp. Sends immediate acknowledgment and tags for qualification.',
    category: 'Lead Capture',
    definition: {
      nodes: [
        {
          id: 'node_trigger',
          type: 'trigger',
          label: 'New Lead Created',
          config: {
            event_type: 'lead_created',
          },
        },
        {
          id: 'node_action_welcome',
          type: 'action',
          label: 'Send Welcome WhatsApp',
          config: {
            action_kind: 'send_whatsapp',
            parameters: {
              templateName: 'welcome_lead_intro',
              message: 'Namaste! Thank you for your interest in our premium residences. How may our property advisors assist you today?',
            },
          },
        },
        {
          id: 'node_action_tag',
          type: 'action',
          label: 'Tag as New Inbound',
          config: {
            action_kind: 'add_tag',
            parameters: {
              tag: 'New-Inbound',
            },
          },
        },
        {
          id: 'node_end',
          type: 'end',
          label: 'Workflow Complete',
          config: {
            outcome: 'welcome_sent',
          },
        },
      ],
      edges: [
        { id: 'edge_1', source: 'node_trigger', target: 'node_action_welcome' },
        { id: 'edge_2', source: 'node_action_welcome', target: 'node_action_tag' },
        { id: 'edge_3', source: 'node_action_tag', target: 'node_end' },
      ],
    },
  },
  {
    id: 'tpl_hot_lead_alert',
    name: 'Hot lead alert',
    description: 'Instantly alerts senior closing managers and creates an urgent 5-minute callback task when a lead crosses 70+ intent score.',
    category: 'Urgent Sales',
    definition: {
      nodes: [
        {
          id: 'node_trigger',
          type: 'trigger',
          label: 'Lead Intent Hot',
          config: {
            event_type: 'lead_hot',
          },
        },
        {
          id: 'node_action_task',
          type: 'action',
          label: 'Create 5-Min Urgent Callback Task',
          config: {
            action_kind: 'create_task',
            parameters: {
              title: 'URGENT: Call hot lead within 5 minutes',
              priority: 'urgent',
            },
          },
        },
        {
          id: 'node_action_assign',
          type: 'action',
          label: 'Assign to Senior Closing Team',
          config: {
            action_kind: 'assign_agent',
            parameters: {
              role: 'senior_closer',
            },
          },
        },
        {
          id: 'node_end',
          type: 'end',
          label: 'Alert Logged',
          config: {
            outcome: 'hot_lead_routed',
          },
        },
      ],
      edges: [
        { id: 'edge_1', source: 'node_trigger', target: 'node_action_task' },
        { id: 'edge_2', source: 'node_action_task', target: 'node_action_assign' },
        { id: 'edge_3', source: 'node_action_assign', target: 'node_end' },
      ],
    },
  },
  {
    id: 'tpl_no_reply_24h',
    name: 'No reply in 24h',
    description: 'Waits 24 hours after an unreplied interaction and sends a gentle value-add WhatsApp nudge featuring project amenities.',
    category: 'Nurturing',
    definition: {
      nodes: [
        {
          id: 'node_trigger',
          type: 'trigger',
          label: 'Message Sent To Buyer',
          config: {
            event_type: 'lead_updated',
          },
        },
        {
          id: 'node_wait',
          type: 'action',
          label: 'Wait 24 Hours',
          config: {
            action_kind: 'wait',
            parameters: {
              hours: 24,
            },
          },
        },
        {
          id: 'node_cond_unreplied',
          type: 'condition',
          label: 'Lead Still Awaiting Response?',
          config: {
            field: 'status',
            operator: 'not_equals',
            value: 'lost',
          },
        },
        {
          id: 'node_action_nudge',
          type: 'action',
          label: 'Send Project Video & Floor Plans Nudge',
          config: {
            action_kind: 'send_whatsapp',
            parameters: {
              message: 'Hi there! We wanted to share the latest clubhouse virtual walkthrough and floor plans with you. Would you like to schedule a quick 10-minute preview?',
            },
          },
        },
        {
          id: 'node_end',
          type: 'end',
          label: 'Nudge Delivered',
          config: {
            outcome: 'followup_sent',
          },
        },
      ],
      edges: [
        { id: 'edge_1', source: 'node_trigger', target: 'node_wait' },
        { id: 'edge_2', source: 'node_wait', target: 'node_cond_unreplied' },
        { id: 'edge_3', source: 'node_cond_unreplied', target: 'node_action_nudge' },
        { id: 'edge_4', source: 'node_action_nudge', target: 'node_end' },
      ],
    },
  },
  {
    id: 'tpl_post_visit_survey',
    name: 'Post-visit survey',
    description: 'Triggered upon site visit completion. Sends a 1-to-5 star rating survey and requests unit reservation feedback.',
    category: 'Site Visits',
    definition: {
      nodes: [
        {
          id: 'node_trigger',
          type: 'trigger',
          label: 'Site Visit Completed',
          config: {
            event_type: 'visit_changed',
          },
        },
        {
          id: 'node_action_survey',
          type: 'action',
          label: 'Send WhatsApp Feedback Survey',
          config: {
            action_kind: 'send_whatsapp',
            parameters: {
              templateName: 'site_visit_survey',
              message: 'Thank you for visiting our project today! How was your walkthrough experience with our property manager? Rate 1-5 stars.',
            },
          },
        },
        {
          id: 'node_action_status',
          type: 'action',
          label: 'Update Status to Negotiation',
          config: {
            action_kind: 'change_status',
            parameters: {
              status: 'negotiation',
            },
          },
        },
        {
          id: 'node_end',
          type: 'end',
          label: 'Survey Dispatched',
          config: {
            outcome: 'survey_dispatched',
          },
        },
      ],
      edges: [
        { id: 'edge_1', source: 'node_trigger', target: 'node_action_survey' },
        { id: 'edge_2', source: 'node_action_survey', target: 'node_action_status' },
        { id: 'edge_3', source: 'node_action_status', target: 'node_end' },
      ],
    },
  },
  {
    id: 'tpl_dormant_reengage',
    name: 'Dormant lead re-engagement',
    description: 'Triggered when lead intent score decays or lead has been quiet for 14+ days. Sends an exclusive developer festival price incentive.',
    category: 'Re-engagement',
    definition: {
      nodes: [
        {
          id: 'node_trigger',
          type: 'trigger',
          label: 'Intent Decayed',
          config: {
            event_type: 'intent_changed',
          },
        },
        {
          id: 'node_condition_quiet',
          type: 'condition',
          label: 'Intent Score Below 40?',
          config: {
            field: 'intent_score',
            operator: 'less_than',
            value: 40,
          },
        },
        {
          id: 'node_action_incentive',
          type: 'action',
          label: 'Send Exclusive Festival Price Offer',
          config: {
            action_kind: 'send_whatsapp',
            parameters: {
              message: 'Exclusive update: The developer has released a limited festive payment plan with 0% pre-EMI until possession. Would you like to review available units?',
            },
          },
        },
        {
          id: 'node_action_tag',
          type: 'action',
          label: 'Tag as Re-engaged Candidate',
          config: {
            action_kind: 'add_tag',
            parameters: {
              tag: 'Festival-Promo-Candidate',
            },
          },
        },
        {
          id: 'node_end',
          type: 'end',
          label: 'Re-engagement Completed',
          config: {
            outcome: 'incentive_dispatched',
          },
        },
      ],
      edges: [
        { id: 'edge_1', source: 'node_trigger', target: 'node_condition_quiet' },
        { id: 'edge_2', source: 'node_condition_quiet', target: 'node_action_incentive' },
        { id: 'edge_3', source: 'node_action_incentive', target: 'node_action_tag' },
        { id: 'edge_4', source: 'node_action_tag', target: 'node_end' },
      ],
    },
  },
];
