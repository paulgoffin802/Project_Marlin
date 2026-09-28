# Project Marlin

Marlin combines a Rayfin Fabric app for programme data with a separate, read-only Streamable HTTP MCP service.

## Components

- `rayfin/` — Rayfin app configuration and authenticated, read-only programme-context schema.
- `src/` — Rayfin's scaffolded Fabric-authenticated React app.
- `mcp-server/` — Entra-protected MCP service with delegated Orbus search and citations.

The Orbus integration uses on-behalf-of token exchange and requires a v2 Entra API token with the configured scope and allowed group claim. The Rayfin programme-context tool remains disabled until per-user identity propagation between Entra MCP clients and Rayfin sessions is validated; it never substitutes an application-wide token.

## Development

```bash
npm install
npm run build
npm test

cd mcp-server
npm install
npm run build
npm test
```

Set up `mcp-server/.env` from `.env.example` before running `npm run mcp:dev`. Do not commit secrets. Deployment and Fabric schema application require tenant setup, approved permissions, and validated identity flows; no cloud resources are deployed by these commands.
