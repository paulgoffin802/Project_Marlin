# Project Marlin

Marlin is a programme-assistant MCP server backed by live reads from Orbus Infinity and a small,
Rayfin-hosted programme database. It is built from two parts that are deployed separately:

- **[`marlin/`](marlin)** — a [Rayfin](https://github.com/microsoft/rayfin) Fabric app that holds the
  programme-context data model (programme records and knowledge facts, both with source citations).
- **[`marlin/mcp-server/`](marlin/mcp-server)** — a standalone, Entra-protected Streamable HTTP MCP
  service. It exposes read-only tools backed by an on-behalf-of (OBO) call into Orbus, and (once a
  validated identity bridge exists) the Rayfin programme data.

Nothing here is deployed yet, and no secrets are stored in the repository.

## Why two parts?

Rayfin's Fabric authentication is a Fabric Portal sign-in with Rayfin-managed opaque sessions. The
MCP protocol instead hands the service a Microsoft Entra access token per request. Until a validated
way to bridge an Entra MCP caller into a per-user Rayfin session exists, the MCP service keeps its
Rayfin-backed tool (`search_programme_context`) fail-closed rather than using a shared/application
token that would leak data across users.

## Repository layout

```
marlin/
├── rayfin/            Rayfin app config, programme/knowledge-fact schema
├── src/                Rayfin's scaffolded Fabric-authenticated React app
└── mcp-server/         Entra-protected MCP service (Orbus search + citations)
```

## Getting started

Prerequisites: Node.js LTS (used to scaffold with v24.21.0 / npm 11.19.0) and, for the Rayfin app,
access to a Microsoft Fabric workspace/capacity.

### Rayfin app

```bash
cd marlin
npm install
npm run build
npm test
```

### MCP service

```bash
cd marlin/mcp-server
npm install
cp .env.example .env   # fill in Entra + Orbus settings below, then:
npm run build
npm test
npm run dev             # serves POST /mcp and GET /healthz on :3000
```

`.env` requires, at minimum:

| Variable | Purpose |
| --- | --- |
| `MCP_PUBLIC_URL` | Public HTTPS URL this service will be reachable at |
| `ENTRA_TENANT_ID` | Entra tenant GUID |
| `ENTRA_API_AUDIENCE` | API audience of the MCP app registration |
| `ENTRA_REQUIRED_SCOPE` | Delegated scope callers must present |
| `ENTRA_ALLOWED_GROUP_ID` | Security group GUID permitted to use the service |
| `ENTRA_CLIENT_ID` / `ENTRA_CLIENT_SECRET` | Credentials for the OBO client |
| `ORBUS_BASE_URL` | Production Orbus Infinity OData base URL (HTTPS) |
| `ORBUS_SCOPE` | Delegated scope for the Orbus OBO exchange |

See [`marlin/mcp-server/README.md`](marlin/mcp-server/README.md) for the full authentication and
data-boundary details, and [`marlin/README.md`](marlin/README.md) for Rayfin-specific commands.

## Current status / next steps

1. Confirm with your Entra/Orbus administrators: the production Orbus URL, delegated scope, and
   whether Orbus accepts Entra OBO tokens (the supplied Swagger advertises OAuth2 implicit flow).
2. Register the MCP API in Entra with the required scope and group claim, and grant/consent the
   delegated Orbus permission to the OBO client.
3. Run the MCP service locally against those settings and validate `search_orbus_objects`.
4. Stand up the Rayfin Fabric environment, apply the schema, and load approved programme data.
5. Design and validate a per-user Rayfin identity bridge before enabling `search_programme_context`.
6. Complete a security review/DPIA and plan deployment (secrets in an approved secret store, not
   this repository) before going live.

## Security notes

- Both MCP tools are read-only; nothing here can modify source-system data.
- All Orbus results carry a source-API citation.
- Tokens are validated for signature, issuer, audience, tenant, token version, scope, and group
  membership before any tool executes.
- Do not commit `.env`, tokens, or credentials — `.gitignore` excludes them, but always double-check
  before committing.
