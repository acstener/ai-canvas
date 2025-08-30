# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Development Setup
- `npm install` - Install dependencies
- `npm run dev` - Start development mode (parallel frontend + backend)
  - Runs Next.js dev server at http://localhost:3000
  - Runs Convex dev environment with real-time sync
  - Opens Convex dashboard automatically
- `npm run predev` - Pre-development setup (runs convex setup and dashboard)

### Individual Services
- `npm run dev:frontend` - Start only Next.js dev server
- `npm run dev:backend` - Start only Convex backend

### Build and Deploy
- `npm run build` - Build Next.js application for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint

### Convex Commands
- `npx convex dev` - Start Convex development environment
- `npx convex dashboard` - Open Convex dashboard
- `npx convex docs` - Open Convex documentation

## Architecture Overview

This is a collaborative canvas application built with:
- **Frontend**: Next.js 15 with React 19, TypeScript, Tailwind CSS
- **Backend**: Convex (real-time database and serverless functions)
- **Canvas**: Excalidraw integration for drawing/diagramming
- **AI**: OpenAI GPT-4o-mini integration for diagram generation and text rewriting
- **Auth**: Convex Auth for authentication

### Key Architecture Patterns

**Real-time Collaborative Canvas**
- Excalidraw canvas embedded in Next.js pages
- Full-scene persistence with Last-Write-Wins (LWW) conflict resolution
- Throttled auto-save (600ms) with version tracking
- Owner-only access control per board

**AI Integration**
- AI-powered diagram generation from natural language prompts
- Text rewriting functionality for selected canvas elements
- Rate limiting (30 requests/minute per user)
- Structured JSON output with Zod validation

**Data Model Architecture**
- `boards` table: Board metadata with owner-based access control
- `board_docs` table: Canvas scene data with versioning
- Auth tables from Convex Auth for user management

## File Structure

### Frontend Components
- `app/boards/page.tsx` - Board listing and creation
- `app/boards/[id]/page.tsx` - Individual board canvas view
- `components/ExcalidrawCanvas.tsx` - Main canvas component with auto-save
- `components/AIControls.tsx` - AI diagram generation UI
- `components/excalidrawTransform.ts` - Utilities for converting AI data to Excalidraw elements

### Backend Functions (Convex)
- `convex/boards.ts` - Board CRUD operations and scene persistence
- `convex/ai.ts` - AI actions for diagram generation and text rewriting
- `convex/schema.ts` - Database schema definitions
- `convex/auth.ts` & `convex/auth.config.ts` - Authentication configuration

### Key Technical Details

**Convex Function Architecture**
- Uses new Convex function syntax with explicit `args`, `returns`, and `handler`
- All functions include proper Zod validators for type safety
- Authentication enforced via `getAuthUserId()` from Convex Auth
- Internal vs public function separation (use `internalAction`, `internalMutation` for private functions)

**Canvas Integration**
- Dynamic import of Excalidraw to avoid SSR issues
- Imperative API access via refs for programmatic element insertion
- Type-safe integration with custom `CanvasElement` type definitions

**AI Features**
- Structured output using OpenAI's JSON mode with Zod schema validation
- Diagram auto-layout with node positioning and edge relationships
- Per-element text rewriting with context-aware instructions

## Security Notes

- All board operations are owner-restricted (only board creator can read/write)
- AI actions are rate-limited and authenticated
- OpenAI API key must be set in environment variables (`OPENAI_API_KEY`)
- Canvas data is stored as JSON in Convex with size limits enforced

## Development Guidelines

When working with this codebase:
- Follow the Convex function syntax patterns shown in `.cursor/rules/convex_rules.mdc`
- Use the existing UI patterns from Tailwind for consistency
- Maintain owner-based access control for all board operations
- Test AI features with proper error handling for API failures
- Use the existing throttling patterns for performance-sensitive operations