# Marlin MCP service

This Node.js service is a separate, read-only Streamable HTTP MCP endpoint. Its initial Orbus tool uses Entra delegated authentication (OBO), and it requires both the configured API scope and the allowed Entra group claim. It never falls back to anonymous or application-only access.

## Local setup

1. Copy `.env.example` to `.env` and fill in the Entra app registration, allowed group, production Orbus URL and delegated scope, and public service URL. The Swagger host in the supplied file is a demo host; it is deliberately not selected automatically.
2. Install dependencies with `npm install`.
3. Run `npm run dev`.
4. Use `POST /mcp` as the MCP endpoint and `GET /healthz` for liveness.

The Entra API registration must issue v2 access tokens for this service with the configured scope and group claim. The app registration used for OBO must have the delegated Orbus API permission and admin consent. The incoming token is validated for signature, issuer, audience, tenant, version, scope, and group before any tool runs.

## Current boundary

The Rayfin schema is ready for programme records and knowledge facts, with authenticated read-only access. Restrict the Rayfin Fabric item itself to the approved Marlin security group; the authenticated Rayfin role does not encode Entra group membership. The `search_programme_context` tool intentionally returns an MCP error until a user-authorized bridge from Entra identity to Rayfin sessions is validated and implemented. The data API does not receive an application-wide fallback token.

Rayfin's Fabric auth uses a Fabric Portal handoff and Rayfin-managed opaque sessions; the Orbus Swagger file advertises OAuth2 implicit flow. Validate the production Orbus tenant's delegated scopes and the Rayfin identity bridge before deployment. Do not put client secrets or access tokens in this repository; use an approved secret store for deployment.

All Orbus search results include an API citation. Only `search_orbus_objects` and `search_programme_context` are exposed at this stage; neither can modify source data.
