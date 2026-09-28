import express, { type ErrorRequestHandler, type Request } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import {
  authenticateBearerToken,
  AuthenticationUnavailableError,
  bearerTokenFromHeader,
  UnauthorizedError,
  type AuthenticatedUser,
} from './auth.js';
import type { ServiceConfig } from './config.js';
import { OrbusClient } from './orbus.js';

export interface ProgrammeContextSource {
  search(query: string, limit: number): Promise<ProgrammeContextItem[]>;
}

export interface ProgrammeContextItem {
  title: string;
  summary: string;
  citation: string;
}

export interface ServerDependencies {
  authenticate: (token: string) => Promise<AuthenticatedUser>;
  orbus: Pick<OrbusClient, 'searchObjects'>;
  programmeContext?: ProgrammeContextSource;
}

export function createApp(config: ServiceConfig, dependencies?: ServerDependencies) {
  const app = express();
  const auth = dependencies?.authenticate ?? ((token: string) => authenticateBearerToken(token, config));
  const orbus = dependencies?.orbus ?? new OrbusClient(config);

  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));

  app.get('/healthz', (_request, response) => {
    response.json({ status: 'ok' });
  });

  app.get('/.well-known/oauth-protected-resource', (_request, response) => {
    response.json({
      resource: new URL('/mcp', config.publicUrl).toString(),
      authorization_servers: [`https://login.microsoftonline.com/${config.tenantId}/v2.0`],
      scopes_supported: [config.requiredScope],
      bearer_methods_supported: ['header'],
    });
  });

  app.post('/mcp', async (request, response, next) => {
    try {
      if (request.get('host') !== config.publicUrl.host) {
        response.status(403).json({ error: 'Unrecognized service host.' });
        return;
      }
      const token = bearerTokenFromHeader(request.get('authorization'));
      const user = await auth(token);
      const server = createMcpServer(user, orbus, dependencies?.programmeContext);
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      });

      await server.connect(transport);
      try {
        await transport.handleRequest(request, response, request.body);
      } finally {
        await server.close();
      }
    } catch (error) {
      next(error);
    }
  });

  app.all('/mcp', (_request, response) => {
    response.setHeader('Allow', 'POST');
    response.status(405).json({ error: 'Method not allowed.' });
  });

  app.use(createErrorHandler(config));
  return app;
}

function createMcpServer(
  user: AuthenticatedUser,
  orbus: Pick<OrbusClient, 'searchObjects'>,
  programmeContext?: ProgrammeContextSource,
): McpServer {
  const server = new McpServer({ name: 'marlin-mcp', version: '0.1.0' });

  server.registerTool(
    'search_orbus_objects',
    {
      title: 'Search Orbus objects',
      description: 'Search Orbus objects by name. Returns live results with source API citations.',
      inputSchema: {
        query: z.string().trim().min(1).max(200),
        limit: z.number().int().min(1).max(25).default(10),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
    },
    async ({ query, limit }) => {
      const result = await orbus.searchObjects(user, query, limit);
      return {
        content: [{ type: 'text', text: JSON.stringify(result) }],
        structuredContent: { ...result },
      };
    },
  );

  server.registerTool(
    'search_programme_context',
    {
      title: 'Search programme context',
      description: 'Search programme records and knowledge facts. Results include their source citations.',
      inputSchema: {
        query: z.string().trim().min(1).max(200),
        limit: z.number().int().min(1).max(25).default(10),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async ({ query, limit }) => {
      if (!programmeContext) {
        return {
          content: [{
            type: 'text',
            text: 'Programme context is unavailable: a user-authorized Rayfin data connector has not been configured.',
          }],
          isError: true,
        };
      }
      const results = await programmeContext.search(query, limit);
      if (results.some((result) => !isCitedProgrammeItem(result))) {
        throw new Error('Rayfin returned a result without a valid source citation.');
      }
      return {
        content: [{ type: 'text', text: JSON.stringify(results) }],
        structuredContent: { results },
      };
    },
  );

  return server;
}

function isCitedProgrammeItem(value: ProgrammeContextItem): boolean {
  if (
    typeof value !== 'object' ||
    value === null ||
    typeof value.title !== 'string' ||
    typeof value.summary !== 'string'
  ) {
    return false;
  }
  try {
    const citation = new URL(value.citation);
    return citation.protocol === 'https:' && citation.hostname.length > 0;
  } catch {
    return false;
  }
}

function createErrorHandler(config: ServiceConfig): ErrorRequestHandler {
  return (error: unknown, _request: Request, response, _next) => {
    if (error instanceof UnauthorizedError) {
      response.setHeader(
        'WWW-Authenticate',
        `Bearer resource_metadata="${new URL('/.well-known/oauth-protected-resource', config.publicUrl)}"`,
      );
      response.status(401).json({ error: error.message });
      return;
    }
    if (error instanceof AuthenticationUnavailableError) {
      response.status(503).json({ error: 'Authentication is temporarily unavailable.' });
      return;
    }

    console.error('MCP request failed.', error instanceof Error ? error.name : 'Unknown error');
    response.status(500).json({ error: 'The MCP request could not be completed.' });
  };
}
