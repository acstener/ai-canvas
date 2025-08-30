import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import type { ExcalidrawInitialDataState } from "@excalidraw/excalidraw/types";

export const createBoard = mutation({
  args: {
    title: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const boardId = await ctx.db.insert("boards", {
      title: args.title,
      ownerId: "anonymous", // No auth - everyone is anonymous
      createdAt: now,
      updatedAt: now,
    });

    const initialData: ExcalidrawInitialDataState = {
      elements: [],
      appState: {
        viewBackgroundColor: "#ffffff",
      },
      files: {},
    };

    await ctx.db.insert("board_docs", {
      boardId,
      data: initialData,
      version: 1,
      updatedBy: "anonymous",
      updatedAt: now,
    });

    return boardId;
  },
});

export const listBoards = query({
  args: {},
  handler: async (ctx) => {
    // Return all boards for anonymous access
    const boards = await ctx.db
      .query("boards")
      .order("desc")
      .collect();

    return boards;
  },
});

export const getBoard = query({
  args: { boardId: v.id("boards") },
  handler: async (ctx, { boardId }) => {
    const board = await ctx.db.get(boardId);
    if (!board) throw new Error("Board not found");
    return board;
  },
});

export const getScene = query({
  args: { boardId: v.id("boards") },
  handler: async (ctx, { boardId }) => {
    const board = await ctx.db.get(boardId);
    if (!board) throw new Error("Board not found");

    const doc = await ctx.db
      .query("board_docs")
      .withIndex("by_board", (q) => q.eq("boardId", boardId))
      .first();

    if (!doc) {
      return null;
    }

    return { data: doc.data as ExcalidrawInitialDataState, version: doc.version };
  },
});

export const saveScene = mutation({
  args: {
    boardId: v.id("boards"),
    expectedVersion: v.number(),
    data: v.any(),
  },
  handler: async (ctx, { boardId, expectedVersion, data }) => {
    const board = await ctx.db.get(boardId);
    if (!board) throw new Error("Board not found");

    const doc = await ctx.db
      .query("board_docs")
      .withIndex("by_board", (q) => q.eq("boardId", boardId))
      .first();

    const now = Date.now();
    if (!doc) {
      const version = 1;
      await ctx.db.insert("board_docs", {
        boardId,
        data: data as ExcalidrawInitialDataState,
        version,
        updatedBy: "anonymous",
        updatedAt: now,
      });
      await ctx.db.patch(boardId, { updatedAt: now });
      return { version };
    }

    // Simple LWW: ignore if client is behind, client will refresh via query
    if (expectedVersion < doc.version) {
      return { version: doc.version };
    }

    const newVersion = doc.version + 1;
    await ctx.db.patch(doc._id, {
      data: data as ExcalidrawInitialDataState,
      version: newVersion,
      updatedBy: "anonymous",
      updatedAt: now,
    });

    await ctx.db.patch(boardId, { updatedAt: now });

    return { version: newVersion };
  },
});
