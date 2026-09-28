import { createRemoteJWKSet, errors as joseErrors, jwtVerify, type JWTPayload } from 'jose';
import type { ServiceConfig } from './config.js';

export interface AuthenticatedUser {
  subject: string;
  tenantId: string;
  accessToken: string;
}

export class UnauthorizedError extends Error {}
export class AuthenticationUnavailableError extends Error {}

const jwksByTenant = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

export function authorizeClaims(payload: JWTPayload, config: Pick<ServiceConfig, 'tenantId' | 'requiredScope' | 'allowedGroupId'>): string {
  const scopes = typeof payload.scp === 'string' ? payload.scp.split(' ') : [];
  const groups = Array.isArray(payload.groups) ? payload.groups : [];
  const subject = typeof payload.oid === 'string' ? payload.oid : undefined;

  if (
    payload.tid !== config.tenantId ||
    payload.ver !== '2.0' ||
    !subject ||
    !scopes.includes(config.requiredScope) ||
    !groups.includes(config.allowedGroupId)
  ) {
    throw new UnauthorizedError('The access token is not authorized for this Marlin MCP service.');
  }

  return subject;
}

export async function authenticateBearerToken(
  token: string,
  config: ServiceConfig,
): Promise<AuthenticatedUser> {
  let jwks = jwksByTenant.get(config.tenantId);
  if (!jwks) {
    jwks = createRemoteJWKSet(
      new URL(`https://login.microsoftonline.com/${config.tenantId}/discovery/v2.0/keys`),
    );
    jwksByTenant.set(config.tenantId, jwks);
  }
  let subject: string;
  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer: `https://login.microsoftonline.com/${config.tenantId}/v2.0`,
      audience: config.audience,
      algorithms: ['RS256'],
      requiredClaims: ['tid', 'ver', 'scp', 'oid', 'exp'],
    });
    subject = authorizeClaims(payload, config);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      throw error;
    }
    if (error instanceof joseErrors.JWKSTimeout) {
      throw new AuthenticationUnavailableError('Microsoft Entra signing keys are temporarily unavailable.');
    }
    if (
      error instanceof joseErrors.JWTExpired ||
      error instanceof joseErrors.JWTClaimValidationFailed ||
      error instanceof joseErrors.JWTInvalid ||
      error instanceof joseErrors.JWSInvalid ||
      error instanceof joseErrors.JWSSignatureVerificationFailed ||
      error instanceof joseErrors.JWKSNoMatchingKey ||
      error instanceof joseErrors.JOSEAlgNotAllowed
    ) {
      throw new UnauthorizedError('The bearer access token is invalid or expired.');
    }
    throw error;
  }

  return { subject, tenantId: config.tenantId, accessToken: token };
}

export function bearerTokenFromHeader(value: string | undefined): string {
  const match = value?.match(/^Bearer ([^\s]+)$/i);
  if (!match) {
    throw new UnauthorizedError('A bearer access token is required.');
  }
  return match[1];
}
