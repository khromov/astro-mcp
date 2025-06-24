# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Commands

### Development

Note: Never run "npm run dev", test changes with "npm run build".
Note: Run "npm run format" after making code changes to fix formatting.

- `npm run dev` - Start development server
- `npm run build` - Build production bundle
- `npm run build:node` - Build for Node.js deployment
- `npm run preview` - Preview production build

### Testing and Quality

- `npm run test` - Run all tests (unit tests via vitest)
- `npm run test:unit` - Run unit tests only
- `npm run check` - Type check with svelte-check
- `npm run check:watch` - Type check in watch mode
- `npm run lint` - Check code formatting and linting
- `npm run format` - Auto-format code with prettier

### MCP Development

- Debug MCP endpoint: `NODE_TLS_REJECT_UNAUTHORIZED=0 NODE_OPTIONS="--insecure-http-parser" npx @modelcontextprotocol/inspector`

## Architecture Overview

This is a SvelteKit application that provides Svelte 5 and SvelteKit documentation in LLM-friendly formats. Key architectural components:

### Core Functionality

- **Documentation Transformation**: Fetches markdown files from GitHub repositories and processes them into LLM-optimized formats
- **Preset System**: Configurable documentation bundles defined in `src/lib/presets.ts` with different sizes and content filters
- **Database Storage**: PostgreSQL database for storing processed documentation and caching
- **Distilled Content**: AI-processed versions of documentation stored in the database

### Key Routes

- `/[preset]` - Main documentation endpoint that serves processed markdown
- `/mcp/[...rest]` - MCP (Model Context Protocol) server for AI assistant integration
- `/api/distilled-versions` - API for managing distilled documentation versions
- `/api/update-distilled` - API for updating distilled content
- `/api/preset-content/[presetKey]/[version]` - API for retrieving specific versions of preset content

### Important Files

- `src/lib/presets.ts` - Defines all available documentation presets and their configurations
- `src/lib/fetchMarkdown.ts` - Core logic for fetching and processing GitHub markdown content
- `src/lib/presetCache.ts` - Database caching system with staleness detection
- `src/lib/server/presetDb.ts` - Database service layer for preset operations
- `src/routes/[preset]/+server.ts` - Main documentation serving endpoint

### Database Schema

The application uses PostgreSQL with the following main tables:

- `presets` - Stores preset content and metadata
- `distillation_jobs` - Tracks AI distillation processes
- `distillation_results` - Results from AI processing

### Environment Setup

- Requires `GITHUB_TOKEN` in `.env` file with `public_repo` permissions for GitHub API access
- Requires `DB_URL` for PostgreSQL connection
- Optional `DISTILL_SECRET_KEY` for protected distillation endpoint
- Uses Svelte 5 with runes syntax throughout the codebase
- Built with TypeScript and uses Vitest for testing

### MCP Integration

The application provides MCP endpoints for AI assistants:

- SSE endpoint: `/mcp/sse` (for Claude Desktop)
- HTTP endpoint: `/mcp/mcp` (for other clients)
- Tools: `list_sections` and `get_documentation` for querying Svelte/SvelteKit docs

### Deployment Notes

- Uses Node.js adapter for production deployment
- Supports Docker deployment via included Dockerfile
- Database migrations are handled via `/api/migrate` endpoint
- All content is served from the database in production
