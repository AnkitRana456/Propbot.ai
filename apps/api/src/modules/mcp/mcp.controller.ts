import type { Response, NextFunction } from 'express';
import { mcpService } from './mcp.service.js';
import type { AuthenticatedMcpRequest } from './mcp-auth.middleware.js';

export class McpController {
  /**
   * GET /api/mcp/tools
   * Lists available tools filtered by API key permissions.
   */
  async listTools(req: AuthenticatedMcpRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const actor = req.apiKey!;
      const tools = mcpService.listToolsForActor(actor);

      res.status(200).json({
        success: true,
        data: {
          server: 'propbot-crm-mcp',
          version: '1.0.0',
          tools,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/mcp/tools/:toolName
   * Executes a tool with strictly derived tenant context from authenticated API key.
   * Client provided companyId is discarded.
   */
  async callTool(req: AuthenticatedMcpRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const toolName = req.params.toolName!;
      const companyId = req.apiKey!.companyId;
      const actor = req.apiKey!;

      // Clone arguments and strip any client-supplied companyId / company_id
      const rawArgs = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
      const { companyId: _discarded1, company_id: _discarded2, ...safeArgs } = rawArgs;

      const result = await mcpService.executeDirectTool(toolName, companyId, safeArgs, actor);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      const message = (err as Error).message;
      if (message.includes('Forbidden') || message.includes('lacks required')) {
        res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message,
          },
        });
        return;
      }
      if (message.includes('not found')) {
        res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message,
          },
        });
        return;
      }
      next(err);
    }
  }

  /**
   * POST /api/mcp/rpc
   * JSON-RPC 2.0 compatible handler for MCP clients.
   */
  async handleRpc(req: AuthenticatedMcpRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { jsonrpc, id, method, params = {} } = req.body || {};
      if (jsonrpc !== '2.0') {
        res.status(400).json({
          jsonrpc: '2.0',
          id: id ?? null,
          error: { code: -32600, message: 'Invalid Request: jsonrpc must be "2.0"' },
        });
        return;
      }

      const companyId = req.apiKey!.companyId;
      const actor = req.apiKey!;

      if (method === 'tools/list') {
        const tools = mcpService.listToolsForActor(actor);
        res.status(200).json({
          jsonrpc: '2.0',
          id,
          result: {
            tools: tools.map((t) => ({
              name: t.name,
              description: t.description,
              inputSchema: t.inputSchema,
            })),
          },
        });
        return;
      }

      if (method === 'tools/call') {
        const { name, arguments: rawArgs = {} } = params;
        const { companyId: _d1, company_id: _d2, ...safeArgs } = rawArgs;

        const result = await mcpService.executeDirectTool(name, companyId, safeArgs, actor);
        res.status(200).json({
          jsonrpc: '2.0',
          id,
          result: {
            content: [{ type: 'text', text: JSON.stringify(result) }],
          },
        });
        return;
      }

      res.status(400).json({
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: `Method not found: ${method}` },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/mcp/sse
   * Establishes SSE stream connection for official MCP clients.
   */
  async handleSse(req: AuthenticatedMcpRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.apiKey!.companyId;
      const actor = req.apiKey!;
      await mcpService.handleSseConnection(req, res, companyId, actor);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/mcp/messages
   * Endpoint for posting messages back into established SSE session.
   */
  async handleSseMessages(req: AuthenticatedMcpRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await mcpService.handleSseMessage(req, res);
    } catch (err) {
      next(err);
    }
  }
}

export const mcpController = new McpController();
