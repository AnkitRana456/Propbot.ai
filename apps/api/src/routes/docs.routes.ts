import { Router, type Request, type Response } from 'express';

export const docsRouter: Router = Router();

const OPENAPI_SPEC = {
  openapi: '3.0.3',
  info: {
    title: 'PropBot Pro API',
    version: '1.0.0',
    description:
      'Multi-tenant, AI-powered real-estate chatbot, CRM, and lead delivery platform API.',
    contact: {
      name: 'PropBot Pro Engineering',
      email: 'support@propbotpro.com',
    },
  },
  servers: [
    {
      url: '/api',
      description: 'Current environment API server',
    },
  ],
  paths: {
    '/auth/register': {
      post: {
        summary: 'Register new real estate agency company & initial admin',
        tags: ['Authentication'],
        responses: {
          '201': { description: 'Company & admin provisioned successfully' },
          '409': { description: 'Slug or email already taken' },
        },
      },
    },
    '/auth/login': {
      post: {
        summary: 'Authenticate user with email and password',
        tags: ['Authentication'],
        responses: {
          '200': { description: 'Returns JWT accessToken and refreshToken' },
          '401': { description: 'Invalid credentials' },
        },
      },
    },
    '/chatbots': {
      get: {
        summary: 'List company chatbots',
        tags: ['Chatbots'],
        security: [{ BearerAuth: [] }],
        responses: { '200': { description: 'List of active chatbots' } },
      },
      post: {
        summary: 'Create a new AI chatbot',
        tags: ['Chatbots'],
        security: [{ BearerAuth: [] }],
        responses: { '201': { description: 'Chatbot created with public key' } },
      },
    },
    '/chatbots/translate': {
      post: {
        summary: 'Translate visitor message or UI string across 10 languages',
        tags: ['Multilingual AI'],
        responses: { '200': { description: 'Translated text payload' } },
      },
    },
    '/chatbots/playbooks': {
      get: {
        summary: 'List agency objection handling playbooks',
        tags: ['AI Playbooks'],
        responses: { '200': { description: 'Playbook rules' } },
      },
      post: {
        summary: 'Create custom objection rebuttal rule',
        tags: ['AI Playbooks'],
        responses: { '201': { description: 'Playbook created' } },
      },
    },
    '/leads/capture': {
      post: {
        summary: 'Capture or update high-intent lead with Buyer DNA',
        tags: ['Leads & CRM'],
        responses: { '201': { description: 'Lead scored and stored' } },
      },
    },
    '/crm/leads/{id}/copilot/suggest-reply': {
      post: {
        summary: 'Generate 3 strategic reply suggestions for human sales reps',
        tags: ['Agent Copilot'],
        responses: { '200': { description: 'Strategic reply options' } },
      },
    },
    '/crm/leads/{id}/copilot/summary': {
      post: {
        summary: 'Synthesize Buyer DNA into executive brief',
        tags: ['Agent Copilot'],
        responses: { '200': { description: 'Executive brief summary' } },
      },
    },
    '/crm/leads/{id}/copilot/call-script': {
      post: {
        summary: 'Generate 60-second personalized discovery call script',
        tags: ['Agent Copilot'],
        responses: { '200': { description: 'Structured call script' } },
      },
    },
    '/appointments': {
      get: {
        summary: 'List site visit appointments',
        tags: ['Appointments'],
        responses: { '200': { description: 'Upcoming site visits' } },
      },
      post: {
        summary: 'Book a site visit appointment with availability conflict detection',
        tags: ['Appointments'],
        responses: { '201': { description: 'Appointment confirmed' } },
      },
    },
    '/analytics/kpis': {
      get: {
        summary: 'Get 30-day KPI summary with period-over-period trend deltas',
        tags: ['Analytics'],
        responses: { '200': { description: 'Aggregated real estate metrics' } },
      },
    },
  },
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
  },
};

docsRouter.get('/', (_req: Request, res: Response) => {
  // If json requested
  if (_req.headers.accept?.includes('application/json')) {
    res.json(OPENAPI_SPEC);
    return;
  }

  // HTML Viewer
  res.setHeader('Content-Type', 'text/html');
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>PropBot Pro — OpenAPI Documentation</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui.css" />
  <style>
    body { margin: 0; background: #fafafa; font-family: Inter, sans-serif; }
    .topbar { display: none; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-bundle.js"></script>
  <script>
    window.onload = () => {
      window.ui = SwaggerUIBundle({
        spec: ${JSON.stringify(OPENAPI_SPEC)},
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIBundle.SwaggerUIStandalonePreset
        ],
      });
    };
  </script>
</body>
</html>
  `);
});

docsRouter.get('/openapi.json', (_req: Request, res: Response) => {
  res.json(OPENAPI_SPEC);
});
