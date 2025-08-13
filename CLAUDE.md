# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Development

- `npm run dev` - Start development server (SvelteKit with Vite)
- `npm run build` - Build production version (static adapter)
- `npm run build:node` - Build with Node.js adapter (sets ADAPTER=node)
- `npm run preview` - Preview production build

### Code Quality

- `npm run check` - Run Svelte type checking
- `npm run check:watch` - Run type checking in watch mode
- `npm run lint` - Run Prettier and ESLint checks
- `npm run eslint:fix` - Auto-fix ESLint issues
- `npm run format` - Format code with Prettier

### Testing

- `npm run test` - Run unit tests with Vitest
- `npm run test:unit` - Run tests in watch mode

### Database & MCP

- `npm run clear-db` - Clear database using scripts/clear-db.js
- `npm run mcp` - Start MCP inspector (DANGEROUSLY_OMIT_AUTH=true)
- Visit `http://localhost:5173/api/migrate` to run database migrations
- Visit `http://localhost:5173/admin` to access admin panel (password: "secret")

### Infrastructure

- `docker-compose up` - Start PostgreSQL, Redis, Adminer, and Redis Commander
- Database: PostgreSQL on port 5432 (admin/admin)
- Adminer: http://localhost:8080 (auto-login enabled)
- Redis: port 6379, Commander on http://localhost:8081

## Architecture Overview

This is a **SvelteKit-based MCP (Model Context Protocol) server** that provides documentation access for Astro framework. The application serves both a web interface and MCP endpoints for AI assistants.

### Key Components

**MCP Handler (`src/lib/mcpHandler.ts`)**

- Core MCP server implementation using `mcp-handler` package
- Provides two main tools: `list_sections` and `get_documentation`
- Serves resources via `astro-llm://` protocol
- Supports both preset bundles and individual documents
- Redis-backed caching with 1-hour max duration

**Database Layer (`src/lib/server/`)**

- PostgreSQL with connection pooling via `pg`
- `contentDb.ts` - Raw documentation content storage
- `contentDistilledDb.ts` - AI-processed/condensed content
- `presetDb.ts` - Preset configurations and metadata
- Migrations in `migrations/` directory

**Presets System (`src/lib/presets.ts`)**

- Configuration for documentation bundles (e.g., "astro-full", "astro-distilled")
- Supports glob patterns for file selection and content minimization options
- Default repository: `withastro/docs`

**Content Processing**

- `fetchMarkdown.ts` - GitHub API integration for content retrieval
- `contentSync.ts` - Synchronization between GitHub and database
- `schedulerService.ts` - Background content updates via cron jobs
- Support for frontmatter removal, whitespace normalization, and content distillation

### MCP Endpoints

- **SSE (Claude Desktop)**: `/mcp/sse`
- **HTTP (other clients)**: `/mcp/mcp`
- Test with MCP Inspector: `npm run mcp`

### Environment Setup

```env
GITHUB_TOKEN=         # Classic token with public_repo permissions
DB_URL=postgres://admin:admin@localhost:5432/db
REDIS_URL=redis://127.0.0.1:6379
```

### Testing Configuration

- **Client tests**: Svelte components with jsdom environment
- **Server tests**: Node.js environment for database/API logic
- Test files: `*.test.ts` and `*.spec.ts` (Svelte components use `*.svelte.test.ts`)
- Integration tests in `handlers.integration.test.ts`

## Development Notes

**SvelteKit Specifics**

- Uses Node.js adapter with single bundle strategy
- TypeScript with strict mode enabled
- ESLint configured for TypeScript and Svelte with relaxed rules for `any` and unused vars

**Database Patterns**

- All database queries go through `src/lib/server/db.ts` connection pool
- Debug queries with `DB_DEBUG=true` environment variable
- Use parameterized queries to prevent SQL injection

**Content Management**

- GitHub content is cached in database for performance
- Distilled content provides LLM-optimized versions
- Path cleaning utilities in `pathUtils.ts` for URL normalization

# Guidelines

- Use comments sparingly
