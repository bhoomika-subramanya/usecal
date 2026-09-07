# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Universal Annotator — a desktop-class annotation app with a global hotkey popup experience.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui + framer-motion
- **Routing**: wouter

## Artifacts

- `artifacts/universal-annotator` — Main web app (preview path: `/`)
- `artifacts/api-server` — Express REST API (preview path: `/api`)

## Features

- **Dashboard** — stats overview, recent annotations, pinned items, type breakdown chart
- **Annotations** — searchable + filterable list with inline pin/delete
- **Annotation Detail/Create** — full form with type, color, source URL, tags
- **Tags** — tag management with color picker and annotation counts
- **Popup** — simulated global hotkey popup (Ctrl+Alt+L), floating overlay with blur backdrop

## Database Schema

- `annotations` — id, title, content, type (text|highlight|drawing|link), color, source_url, source_title, source_app, source_window_title, local_file_path, os_tags_synced, is_pinned, tags (array), created_at, updated_at
- `tags` — id, name, color, created_at

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally
- `pnpm --filter @workspace/universal-annotator run dev` — run frontend locally

## Keyboard Shortcuts (in-app)

- `N` — new annotation (when not in input)
- `Ctrl+Alt+L` — open quick popup (simulated in browser; global shortcut in Tauri desktop app)
- `ESC` — close popup (click outside)

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
