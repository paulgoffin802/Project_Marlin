import assert from 'node:assert/strict';
import test from 'node:test';
import { readConfig } from './config.js';

const environment = {
  PORT: '3000',
  MCP_PUBLIC_URL: 'https://marlin-mcp.example.com',
  ENTRA_TENANT_ID: '11111111-1111-4111-8111-111111111111',
  ENTRA_API_AUDIENCE: 'api://marlin-mcp',
  ENTRA_REQUIRED_SCOPE: 'access_as_user',
  ENTRA_ALLOWED_GROUP_ID: '22222222-2222-4222-8222-222222222222',
  ENTRA_CLIENT_ID: '33333333-3333-4333-8333-333333333333',
  ENTRA_CLIENT_SECRET: 'test-only',
  ORBUS_BASE_URL: 'https://orbus.example.com',
  ORBUS_SCOPE: 'api://orbus/user_impersonation',
};

test('loads valid configuration without embedding secrets in URLs', () => {
  const config = readConfig(environment);
  assert.equal(config.port, 3000);
  assert.equal(config.orbusBaseUrl.origin, 'https://orbus.example.com');
});

test('refuses to start when required identity or source settings are missing', () => {
  assert.throws(() => readConfig({}), /Missing required setting ENTRA_TENANT_ID/);
  assert.throws(() => readConfig({ ...environment, ORBUS_BASE_URL: '' }), /Missing required setting ORBUS_BASE_URL/);
});

test('requires HTTPS for remote endpoints', () => {
  assert.throws(() => readConfig({ ...environment, ORBUS_BASE_URL: 'http://orbus.example.com' }), /ORBUS_BASE_URL must be an HTTPS origin/);
  assert.throws(() => readConfig({ ...environment, MCP_PUBLIC_URL: 'http://marlin-mcp.example.com' }), /MCP_PUBLIC_URL must be a secure origin/);
});
