# CLAUDE.md

This file provides context for AI assistants working on this codebase.

## Project Overview

**Manjha Chat** is an AI chatbot application built on the Chat SDK template. It provides a full-featured chat interface with streaming responses, document artifacts, and multi-model support.

## Tech Stack

- **Framework**: Next.js 16 (App Router), React 19
- **AI**: Vercel AI SDK + AI Gateway (xAI grok models)
- **UI**: shadcn/ui, Tailwind CSS, Radix UI
- **Database**: Neon Serverless Postgres + Drizzle ORM
- **Storage**: Vercel Blob
- **Auth**: Auth.js (NextAuth v5 beta)
- **Code Quality**: Ultracite (Biome-based linting/formatting)
- **Testing**: Playwright E2E

## Project Structure

```
app/
├── (auth)/          # Auth routes: login, register, API
├── (chat)/          # Chat pages, streaming API, history
├── layout.tsx       # Root layout
└── globals.css      # Global styles

components/          # 52 UI components (shadcn/ui based)

lib/
├── ai/              # AI models, prompts, tools
│   ├── models.ts    # Model definitions
│   ├── prompts.ts   # System prompts
│   ├── providers.ts # AI provider config
│   └── tools/       # AI tools (weather, documents, suggestions)
├── db/              # Database layer
│   ├── schema.ts    # Drizzle schema
│   ├── queries.ts   # Database queries
│   └── migrations/  # SQL migrations
├── artifacts/       # Artifact handling
└── utils.ts         # Utility functions

artifacts/           # Artifact renderers (code, image, sheet, text)
hooks/               # Custom React hooks
tests/e2e/           # Playwright tests
```

## Key Commands

```bash
pnpm dev          # Start dev server (Turbo)
pnpm lint         # Check with Ultracite
pnpm format       # Fix with Ultracite
pnpm db:migrate   # Run database migrations
pnpm db:generate  # Generate migration from schema changes
pnpm db:studio    # Open Drizzle Studio
pnpm test         # Run Playwright E2E tests
```

## Code Conventions

### Linting & Formatting
- Uses **Ultracite** (Biome-based) for linting and formatting
- Run `pnpm format` before committing
- See `.cursor/rules/ultracite.mdc` for full rule set

### TypeScript
- Strict mode enabled
- Use `import type` for type-only imports
- Avoid `any` and `enum` types
- Use `as const` for literal types

### React/Next.js
- Use Server Components by default
- Client components marked with `'use client'`
- Use Server Actions for mutations
- Follow App Router conventions

### Database
- Drizzle ORM for type-safe queries
- Schema defined in `lib/db/schema.ts`
- Migrations in `lib/db/migrations/`

### Testing
- Playwright for E2E tests
- Test user-facing behavior, not implementation details
- Tests in `tests/e2e/`

## Environment Variables

See `.env.example` for required variables:
- `AUTH_SECRET` - NextAuth secret
- `POSTGRES_URL` - Neon database URL
- `BLOB_READ_WRITE_TOKEN` - Vercel Blob token
- `AI_GATEWAY_API_KEY` - AI Gateway key (non-Vercel deployments)

## Common Patterns

### Adding a New AI Tool
1. Create tool file in `lib/ai/tools/`
2. Export tool definition with Zod schema
3. Register in the chat route

### Adding a New Component
1. Create in `components/`
2. Use shadcn/ui primitives where possible
3. Follow existing naming conventions

### Database Changes
1. Modify `lib/db/schema.ts`
2. Run `pnpm db:generate` to create migration
3. Run `pnpm db:migrate` to apply

## AI Models

Default models (via AI Gateway):
- `grok-2-vision-1212` - Vision-capable model
- `grok-3-mini` - Fast, lightweight model

Model configuration in `lib/ai/models.ts`
