import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { mcpToolsRegistry } from './mcp-tools.registry.js';
import { mcpLogger } from './mcp-auth.middleware.js';
import type { Response, Request } from 'express';

export class McpService {
  // Store active SSE sessions by sessionId: { transport, server, companyId, apiKey }
  private sseSessions = new Map<
    string,
    {
      transport: SSEServerTransport;
      server: Server;
      companyId: string;
      actor: { id: string; name: string; permissions: string[] };
    }
  >();

  /**
   * Creates an MCP Server instance scoped to a specific tenant and API key.
   */
  createScopedServer(
    companyId: string,
    actor: { id: string; name: string; permissions: string[] },
  ): Server {
    const server = new Server(
      {
        name: 'propbot-crm-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      },
    );

    // 1. tools/list handler
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      const allTools = mcpToolsRegistry.listTools();
      const hasWrite =
        actor.permissions.includes('*') ||
        actor.permissions.includes('mcp:*') ||
        actor.permissions.includes('mcp:write');

      const filteredTools = allTools.filter((t) => {
        if (t.scope === 'mcp:write') return hasWrite;
        return true;
      });

      return {
        tools: filteredTools.map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
        })),
      };
    });

    // 2. tools/call handler
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args = {} } = request.params;
      const tool = mcpToolsRegistry.getTool(name);

      if (!tool) {
        throw new McpError(ErrorCode.MethodNotFound, `Tool not found: ${name}`);
      }

      // Check write permission for write tools
      if (tool.scope === 'mcp:write') {
        const hasWrite =
          actor.permissions.includes('*') ||
          actor.permissions.includes('mcp:*') ||
          actor.permissions.includes('mcp:write');

        if (!hasWrite) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            `API key lacks required write scope 'mcp:write' for tool '${name}'.`,
          );
        }
      }

      try {
        const result = await mcpToolsRegistry.executeTool(
          name,
          companyId,
          args as Record<string, unknown>,
          actor,
        );

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (err) {
        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution error: ${(err as Error).message}`,
        );
      }
    });

    return server;
  }

  /**
   * Initializes SSE transport connection for MCP client.
   */
  async handleSseConnection(
    req: Request,
    res: Response,
    companyId: string,
    actor: { id: string; name: string; permissions: string[] },
  ) {
    const transport = new SSEServerTransport('/api/mcp/messages', res);
    const server = this.createScopedServer(companyId, actor);

    const sessionId = transport.sessionId;
    this.sseSessions.set(sessionId, { transport, server, companyId, actor });

    transport.onclose = () => {
      mcpLogger.info({ sessionId, companyId }, 'MCP SSE transport connection closed');
      this.sseSessions.delete(sessionId);
    };

    await server.connect(transport);
    mcpLogger.info({ sessionId, companyId }, 'MCP SSE transport connected');
  }

  /**
   * Handles incoming POST messages for established SSE session.
   */
  async handleSseMessage(req: Request, res: Response) {
    const sessionId = req.query.sessionId as string;
    if (!sessionId) {
      res.status(400).json({ error: 'Missing sessionId query parameter' });
      return;
    }

    const session = this.sseSessions.get(sessionId);
    if (!session) {
      res.status(404).json({ error: 'SSE session not found' });
      return;
    }

    await session.transport.handlePostMessage(req, res);
  }

  /**
   * Direct JSON HTTP list tools helper.
   */
  listToolsForActor(actor: { permissions: string[] }) {
    const allTools = mcpToolsRegistry.listTools();
    const hasWrite =
      actor.permissions.includes('*') ||
      actor.permissions.includes('mcp:*') ||
      actor.permissions.includes('mcp:write');

    return allTools
      .filter((t) => (t.scope === 'mcp:write' ? hasWrite : true))
      .map((t) => ({
        name: t.name,
        description: t.description,
        scope: t.scope,
        inputSchema: t.inputSchema,
      }));
  }

  /**
   * Direct JSON HTTP execute tool helper.
   */
  async executeDirectTool(
    toolName: string,
    companyId: string,
    args: Record<string, unknown>,
    actor: { id: string; name: string; permissions: string[] },
  ) {
    const tool = mcpToolsRegistry.getTool(toolName);
    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }

    if (tool.scope === 'mcp:write') {
      const hasWrite =
        actor.permissions.includes('*') ||
        actor.permissions.includes('mcp:*') ||
        actor.permissions.includes('mcp:write');

      if (!hasWrite) {
        throw new Error(`Forbidden: Tool '${toolName}' requires 'mcp:write' permission scope.`);
      }
    }

    return await mcpToolsRegistry.executeTool(toolName, companyId, args, actor);
  }
}

export const mcpService = new McpService();
