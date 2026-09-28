import {
  ConfidentialClientApplication,
  type Configuration,
} from '@azure/msal-node';
import type { AuthenticatedUser } from './auth.js';
import type { ServiceConfig } from './config.js';

export interface OrbusObject {
  objectId: string;
  name: string;
  objectTypeId: string;
  modelId: string;
  citation: string;
}

export interface OrbusSearchResult {
  objects: OrbusObject[];
  hasMore: boolean;
}

interface ODataPage {
  value: unknown[];
  nextLink?: string;
}

export function buildObjectSearchUrl(baseUrl: URL, query: string, limit: number): URL {
  const url = new URL('/odata/Objects', baseUrl);
  const escapedQuery = query.replaceAll("'", "''");
  url.searchParams.set('$select', 'objectId,name,objectTypeId,modelId');
  url.searchParams.set('$filter', `substringof('${escapedQuery}',name) eq true`);
  url.searchParams.set('$top', String(limit));
  return url;
}

export class OrbusClient {
  private readonly app: ConfidentialClientApplication;

  constructor(private readonly config: ServiceConfig) {
    const msalConfig: Configuration = {
      auth: {
        clientId: config.clientId,
        authority: `https://login.microsoftonline.com/${config.tenantId}`,
        clientSecret: config.clientSecret,
      },
    };
    this.app = new ConfidentialClientApplication(msalConfig);
  }

  async searchObjects(user: AuthenticatedUser, query: string, limit: number): Promise<OrbusSearchResult> {
    const tokenResult = await this.app.acquireTokenOnBehalfOf({
      oboAssertion: user.accessToken,
      scopes: [this.config.orbusScope],
    });
    if (!tokenResult?.accessToken) {
      throw new Error('Entra did not return a delegated Orbus access token.');
    }

    const url = buildObjectSearchUrl(this.config.orbusBaseUrl, query, limit);
    const response = await fetch(url, {
      headers: { authorization: `Bearer ${tokenResult.accessToken}`, accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      throw new Error(`Orbus returned HTTP ${response.status}.`);
    }

    const page = parseODataPage(await response.json());
    return {
      objects: page.value.map((item) => toOrbusObject(item, this.config.orbusBaseUrl)),
      hasMore: page.nextLink !== undefined,
    };
  }
}

function parseODataPage(value: unknown): ODataPage {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('value' in value) ||
    !Array.isArray(value.value)
  ) {
    throw new Error('Orbus returned an invalid OData response.');
  }

  const nextLink = '@odata.nextLink' in value && typeof value['@odata.nextLink'] === 'string'
    ? value['@odata.nextLink']
    : undefined;
  return { value: value.value, nextLink };
}

function toOrbusObject(value: unknown, baseUrl: URL): OrbusObject {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('objectId' in value) ||
    typeof value.objectId !== 'string' ||
    !isUuid(value.objectId) ||
    !('name' in value) ||
    typeof value.name !== 'string' ||
    !('objectTypeId' in value) ||
    typeof value.objectTypeId !== 'string' ||
    !('modelId' in value) ||
    typeof value.modelId !== 'string'
  ) {
    throw new Error('Orbus returned an object that does not match the documented model.');
  }

  return {
    objectId: value.objectId,
    name: value.name,
    objectTypeId: value.objectTypeId,
    modelId: value.modelId,
    citation: new URL(`/odata/Objects(${value.objectId})`, baseUrl).toString(),
  };
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
