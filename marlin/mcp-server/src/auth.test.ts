import assert from 'node:assert/strict';
import test from 'node:test';
import type { JWTPayload } from 'jose';
import { authenticateBearerToken, authorizeClaims, UnauthorizedError } from './auth.js';
import { readConfig } from './config.js';

const config = {
  tenantId: '11111111-1111-4111-8111-111111111111',
  requiredScope: 'access_as_user',
  allowedGroupId: '22222222-2222-4222-8222-222222222222',
};

const validClaims: JWTPayload = {
  tid: config.tenantId,
  ver: '2.0',
  oid: '33333333-3333-4333-8333-333333333333',
  scp: 'access_as_user other_scope',
  groups: [config.allowedGroupId],
};

test('authorizes a valid user from the configured group and scope', () => {
  assert.equal(authorizeClaims(validClaims, config), validClaims.oid);
});

test('rejects tokens without the required scope', () => {
  assert.throws(
    () => authorizeClaims({ ...validClaims, scp: 'other_scope' }, config),
    UnauthorizedError,
  );
});

test('rejects tokens without the configured security group claim', () => {
  assert.throws(
    () => authorizeClaims({ ...validClaims, groups: [] }, config),
    UnauthorizedError,
  );
});

test('rejects tokens for another tenant or token version', () => {
  assert.throws(
    () => authorizeClaims({ ...validClaims, tid: '44444444-4444-4444-8444-444444444444' }, config),
    UnauthorizedError,
  );
  assert.throws(
    () => authorizeClaims({ ...validClaims, ver: '1.0' }, config),
    UnauthorizedError,
  );
});

test('returns unauthorized for malformed bearer tokens', async () => {
  const serviceConfig = readConfig({
    PORT: '3000',
    MCP_PUBLIC_URL: 'https://marlin-mcp.example.com',
    ENTRA_TENANT_ID: config.tenantId,
    ENTRA_API_AUDIENCE: 'api://marlin-mcp',
    ENTRA_REQUIRED_SCOPE: config.requiredScope,
    ENTRA_ALLOWED_GROUP_ID: config.allowedGroupId,
    ENTRA_CLIENT_ID: '55555555-5555-4555-8555-555555555555',
    ENTRA_CLIENT_SECRET: 'test-only',
    ORBUS_BASE_URL: 'https://orbus.example.com',
    ORBUS_SCOPE: 'api://orbus/user_impersonation',
  });

  await assert.rejects(
    authenticateBearerToken('not-a-jwt', serviceConfig),
    UnauthorizedError,
  );
});
