import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { AuthenticatedUser } from './auth.js';
import type { ServiceConfig } from './config.js';
import { createApp } from './server.js';

const user: AuthenticatedUser = {
  subject: '33333333-3333-4333-8333-333333333333',
  tenantId: '11111111-1111-4111-8111-111111111111',
  accessToken: 'test-token',
};

const config: ServiceConfig = {
  port: 0,
  publicUrl: new URL('http://localhost:3000'),
  tenantId: user.tenantId,
  audience: 'api://marlin-mcp',
  requiredScope: 'access_as_user',
  allowedGroupId: '22222222-2222-4222-8222-222222222222',
  clientId: '44444444-4444-4444-8444-444444444444',
  clientSecret: 'test-only',
  orbusBaseUrl: new URL('https://demo-api.iserver365.com'),
  orbusScope: 'api://orbus/user_impersonation',
};

test('serves authenticated MCP tools and rejects missing citations', async (context) => {
  const app = createApp(config, {
    authenticate: async (token) => {
      if (token !== 'test-token') {
        throw new Error('Unexpected test token.');
      }
      return user;
    },
    orbus: {
      searchObjects: async (_user, query, limit) => ({
        objects: [{
          objectId: '55555555-5555-4555-8555-555555555555',
          name: `${query} result`,
          objectTypeId: '66666666-6666-4666-8666-666666666666',
          modelId: '77777777-7777-4777-8777-777777777777',
          citation: 'https://demo-api.iserver365.com/odata/Objects(55555555-5555-4555-8555-555555555555)',
        }].slice(0, limit),
        hasMore: false,
      }),
    },
    programmeContext: {
      search: async () => [{ title: 'No citation', summary: 'Invalid test fixture', citation: 'file:///private' }],
    },
  });
  const httpServer = createServer(app);
  await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
  const address = httpServer.address();
  assert.ok(address && typeof address !== 'string');
  const endpoint = `http://127.0.0.1:${address.port}/mcp`;
  config.publicUrl = new URL(`http://127.0.0.1:${address.port}`);

  const anonymousResponse = await fetch(endpoint, { method: 'POST' });
  assert.equal(anonymousResponse.status, 401);
  assert.match(anonymousResponse.headers.get('www-authenticate') ?? '', /oauth-protected-resource/);

  const client = new Client({ name: 'marlin-test', version: '1.0.0' });
  context.after(async () => {
    await client.close();
    await new Promise<void>((resolve, reject) => {
      httpServer.close((error) => error ? reject(error) : resolve());
    });
  });
  const transport = new StreamableHTTPClientTransport(new URL(endpoint), {
    requestInit: { headers: { authorization: 'Bearer test-token' } },
  });
  await client.connect(transport);

  const tools = await client.listTools();
  assert.deepEqual(
    tools.tools.map((tool) => tool.name).sort(),
    ['search_orbus_objects', 'search_programme_context'],
  );

  const orbusResult = await client.callTool({
    name: 'search_orbus_objects',
    arguments: { query: 'Zendesk', limit: 5 },
  });
  assert.equal(orbusResult.isError, undefined);
  assert.match(JSON.stringify(orbusResult), /https:\/\/demo-api\.iserver365\.com\/odata\/Objects/);

  const programmeResult = await client.callTool({
    name: 'search_programme_context',
    arguments: { query: 'HRIS' },
  });
  assert.equal(programmeResult.isError, true);
});
