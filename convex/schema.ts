import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

// The schema is normally optional, but Convex Auth
// requires indexes defined on `authTables`.
// The schema provides more precise TypeScript types.
export default defineSchema({
  ...authTables,
  numbers: defineTable({
    value: v.number(),
  }),
  // Boards for canvas documents
  boards: defineTable({
    title: v.string(),
    ownerId: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_owner", ["ownerId"]),
  // One document per board storing the Excalidraw scene
  board_docs: defineTable({
    boardId: v.id("boards"),
    data: v.any(),
    version: v.number(),
    updatedBy: v.id("users"),
    updatedAt: v.number(),
  }).index("by_board", ["boardId"]),
});
