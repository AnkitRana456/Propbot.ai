import { Router } from 'express';
import { mcpController } from '../modules/mcp/mcp.controller.js';
import { mcpAuthMiddleware } from '../modules/mcp/mcp-auth.middleware.js';

export const mcpRouter: Router = Router();

// 1. SSE Protocol Endpoints
mcpRouter.get('/sse', mcpAuthMiddleware, (req, res, next) => {
  mcpController.handleSse(req, res, next);
});

mcpRouter.post('/messages', (req, res, next) => {
  mcpController.handleSseMessages(req, res, next);
});

// 2. Direct HTTP / REST Endpoints
mcpRouter.get('/tools', mcpAuthMiddleware, (req, res, next) => {
  mcpController.listTools(req, res, next);
});

mcpRouter.post('/tools/:toolName', mcpAuthMiddleware, (req, res, next) => {
  mcpController.callTool(req, res, next);
});

// 3. JSON-RPC 2.0 Endpoint
mcpRouter.post('/rpc', mcpAuthMiddleware, (req, res, next) => {
  mcpController.handleRpc(req, res, next);
});
