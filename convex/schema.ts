import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  numbers: defineTable({
    value: v.number(),
  }),
  // Boards for canvas documents - no authentication needed
  boards: defineTable({
    title: v.string(),
    ownerId: v.string(), // Just a string, no user reference
    createdAt: v.number(),
    updatedAt: v.number(),
  }),
  // One document per board storing the Excalidraw scene
  board_docs: defineTable({
    boardId: v.id("boards"),
    data: v.any(),
    version: v.number(),
    updatedBy: v.string(), // Just a string, no user reference
    updatedAt: v.number(),
  }).index("by_board", ["boardId"]),
});
