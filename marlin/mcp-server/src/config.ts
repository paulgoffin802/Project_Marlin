export interface ServiceConfig {
  port: number;
  publicUrl: URL;
  tenantId: string;
  audience: string;
  requiredScope: string;
  allowedGroupId: string;
  clientId: string;
  clientSecret: string;
  orbusBaseUrl: URL;
  orbusScope: string;
}

export function readConfig(env: NodeJS.ProcessEnv = process.env): ServiceConfig {
  const tenantId = required(env, 'ENTRA_TENANT_ID');
  const audience = required(env, 'ENTRA_API_AUDIENCE');
  const requiredScope = required(env, 'ENTRA_REQUIRED_SCOPE');
  const allowedGroupId = required(env, 'ENTRA_ALLOWED_GROUP_ID');
  const clientId = required(env, 'ENTRA_CLIENT_ID');
  const clientSecret = required(env, 'ENTRA_CLIENT_SECRET');
  const orbusBaseUrl = new URL(required(env, 'ORBUS_BASE_URL'));
  const publicUrl = new URL(required(env, 'MCP_PUBLIC_URL'));
  const orbusScope = required(env, 'ORBUS_SCOPE');
  const port = Number(env.PORT ?? '3000');

  if (!isUuid(tenantId) || !isUuid(allowedGroupId) || !isUuid(clientId)) {
    throw new Error('ENTRA_TENANT_ID, ENTRA_ALLOWED_GROUP_ID, and ENTRA_CLIENT_ID must be GUIDs.');
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }
  if (
    orbusBaseUrl.protocol !== 'https:' ||
    orbusBaseUrl.username ||
    orbusBaseUrl.password ||
    orbusBaseUrl.pathname !== '/' ||
    orbusBaseUrl.search ||
    orbusBaseUrl.hash
  ) {
    throw new Error('ORBUS_BASE_URL must be an HTTPS origin without embedded credentials or a path.');
  }
  if (
    !isSecurePublicUrl(publicUrl) ||
    publicUrl.username ||
    publicUrl.password ||
    publicUrl.pathname !== '/' ||
    publicUrl.search ||
    publicUrl.hash
  ) {
    throw new Error('MCP_PUBLIC_URL must be a secure origin without a path.');
  }

  return {
    port,
    publicUrl,
    tenantId,
    audience,
    requiredScope,
    allowedGroupId,
    clientId,
    clientSecret,
    orbusBaseUrl,
    orbusScope,
  };
}

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required setting ${name}.`);
  }
  return value;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isSecurePublicUrl(url: URL): boolean {
  return url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname));
}
