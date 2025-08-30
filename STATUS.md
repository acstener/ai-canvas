## Project status: Excalidraw boards MVP

This repo now includes a minimal collaborative-canvas foundation using Excalidraw embedded in a Next.js + Convex + Convex Auth stack. The MVP focuses on reliability and persistence (no realtime presence or CRDT yet).

### What’s working
- Excalidraw canvas embedded on a per-board page
- Full-scene persistence to Convex with simple versioning (LWW)
- Auth-protected routes; owners-only access to boards
- Create/list boards UI

### How to run locally
```bash
npm run dev
# Next.js on http://localhost:3000, Convex dev runs alongside
```
- Go to `/boards`, click “Create board”, then draw at `/boards/<id>`.

### Routes
- `/boards`: list + create boards
- `/boards/[id]`: Excalidraw canvas for the board
- Home page and existing demo remain unchanged

### Data model (Convex)
- `boards`: { title, ownerId, createdAt, updatedAt }
  - Index: `by_owner (ownerId)`
- `board_docs`: { boardId, data, version, updatedBy, updatedAt }
  - Index: `by_board (boardId)`

### Convex functions
- `createBoard({ title })`: create board + initialize empty scene
- `listBoards()`: list current user’s boards
- `getBoard({ boardId })`: fetch board metadata (authz enforced)
- `getScene({ boardId })`: reactive scene data + version
- `saveScene({ boardId, expectedVersion, data })`: LWW save, bumps version

### Frontend pieces
- `app/boards/page.tsx`: board list + create
- `app/boards/[id]/page.tsx`: board page wrapper (preloads scene)
- `components/ExcalidrawCanvas.tsx`: client component; throttled saves, “Saved” indicator
- `app/layout.tsx`: global import of Excalidraw CSS
- `middleware.ts`: protects `/boards` routes

### Tech choices
- Option A: Excalidraw + Convex selected for MVP
- No presence/CRDT yet; persistence is full-scene JSON with throttling

### Limitations and considerations
- LWW conflict model: concurrent saves close together can overwrite; queries reconcile quickly
- Scene size: large scenes may need compression or per-op patching in future
- No multi-user presence/cursors yet

### Next steps (AI integration)
- Add a “Generate” button that calls a Convex action (OpenAI/Anthropic) to:
  - Insert generated text/shapes/components onto the canvas via Excalidraw imperative API
  - Optionally scaffold UI flows (frames + labeled elements) from prompts
- Optional upgrades later:
  - Presence (cursors, avatars) via Convex
  - Switch to per-op patch log or Yjs for CRDT/offline
  - Sharing/permissions beyond owner-only

### Dependencies added
- `@excalidraw/excalidraw`
- `lodash.throttle`
- `nanoid`

### Security
- Only authenticated users can access `/boards` routes
- Only the board owner can read/write board data
