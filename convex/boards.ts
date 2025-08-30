import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import type { ExcalidrawInitialDataState } from "@excalidraw/excalidraw/types";
import { getAuthUserId } from "@convex-dev/auth/server";

export const createBoard = mutation({
  args: {
    title: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const now = Date.now();
    const boardId = await ctx.db.insert("boards", {
      title: args.title,
      ownerId: userId,
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
      updatedBy: userId,
      updatedAt: now,
    });

    return boardId;
  },
});

export const listBoards = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const boards = await ctx.db
      .query("boards")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .order("desc")
      .collect();

    return boards;
  },
});

export const getBoard = query({
  args: { boardId: v.id("boards") },
  handler: async (ctx, { boardId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const board = await ctx.db.get(boardId);
    if (!board) throw new Error("Board not found");
    if (board.ownerId !== userId) throw new Error("Forbidden");
    return board;
  },
});

export const getScene = query({
  args: { boardId: v.id("boards") },
  handler: async (ctx, { boardId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const board = await ctx.db.get(boardId);
    if (!board) throw new Error("Board not found");
    if (board.ownerId !== userId) throw new Error("Forbidden");

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
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const board = await ctx.db.get(boardId);
    if (!board) throw new Error("Board not found");
    if (board.ownerId !== userId) throw new Error("Forbidden");

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
        updatedBy: userId,
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
      updatedBy: userId,
      updatedAt: now,
    });

    await ctx.db.patch(boardId, { updatedAt: now });

    return { version: newVersion };
  },
});
