import { action } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import OpenAI from "openai";
import { z } from "zod";

// Zod schemas for model I/O
export const NodeSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["rectangle", "diamond", "ellipse", "text"]),
  x: z.number(),
  y: z.number(),
  w: z.number().positive().max(2000),
  h: z.number().positive().max(2000),
  text: z.string().max(2000).optional(),
});

export const EdgeSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  label: z.string().max(500).optional(),
});

export const DiagramSchema = z.object({
  nodes: z.array(NodeSchema).max(30),
  edges: z.array(EdgeSchema).max(60),
});

// Helper to clamp diagram into reasonable bounds and sizes
function clampDiagram(diagram: z.infer<typeof DiagramSchema>) {
  const MIN_COORD = -5000;
  const MAX_COORD = 5000;
  const MAX_W = 2000;
  const MAX_H = 2000;

  const clampedNodes = diagram.nodes.map((n) => ({
    ...n,
    x: Math.min(MAX_COORD, Math.max(MIN_COORD, n.x)),
    y: Math.min(MAX_COORD, Math.max(MIN_COORD, n.y)),
    w: Math.min(MAX_W, Math.max(1, n.w)),
    h: Math.min(MAX_H, Math.max(1, n.h)),
    text: n.text?.slice(0, 2000),
  }));

  const clampedEdges = diagram.edges.map((e) => ({
    ...e,
    label: e.label?.slice(0, 500),
  }));

  return { nodes: clampedNodes, edges: clampedEdges };
}

// Optional in-memory rate limiter (best-effort, per runtime)
const userRateWindowMs = 60_000; // 1 minute
const userRateMax = 30; // max requests per window
const userRateState = new Map<string, { windowStart: number; count: number }>();

function checkRateLimit(userId: string) {
  const now = Date.now();
  const state = userRateState.get(userId);
  if (!state || now - state.windowStart > userRateWindowMs) {
    userRateState.set(userId, { windowStart: now, count: 1 });
    return;
    }
  if (state.count >= userRateMax) {
    throw new Error("Rate limit exceeded. Please wait a minute and try again.");
  }
  state.count += 1;
}

export const generateDiagram = action({
  args: { prompt: v.string(), maxShapes: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    checkRateLimit(userId);

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("Server misconfigured: OPENAI_API_KEY not set");

    const client = new OpenAI({ apiKey });

    const maxAllowed = Math.min(args.maxShapes ?? 12, 20);

    const system = [
      "You are a diagram generator.",
      "Return a single JSON object with keys 'nodes' and 'edges'.",
      "Each node: {id, type, x, y, w, h, text?}.",
      "type is one of rectangle|diamond|ellipse|text.",
      `Return at most ${maxAllowed} nodes.`,
      "Each edge: {from, to, label?} where from/to reference node ids.",
      "Do not return any prose or markdown. JSON only.",
    ].join(" ");

    const user = [
      "Create a diagram for this prompt:",
      args.prompt,
    ].join("\n\n");

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.2,
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content ?? "";
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (err) {
      throw new Error("The AI returned invalid JSON. Please try again or refine your prompt.");
    }

    // Validate shape
    const result = DiagramSchema.safeParse(parsed);
    if (!result.success) {
      throw new Error(
        "The AI response did not match the expected diagram format. Please try again."
      );
    }

    // Enforce max nodes runtime as well
    const limited = {
      nodes: result.data.nodes.slice(0, maxAllowed),
      edges: result.data.edges.slice(0, maxAllowed * 3),
    } as z.infer<typeof DiagramSchema>;

    const clamped = clampDiagram(limited);
    return clamped;
  },
});

export const rewriteText = action({
  args: { text: v.string(), instruction: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    checkRateLimit(userId);

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("Server misconfigured: OPENAI_API_KEY not set");

    const client = new OpenAI({ apiKey });

    const system = [
      "You rewrite text according to an instruction.",
      "Return JSON only: {\"text\": string}.",
      "No additional fields. No prose.",
    ].join(" ");

    const user = [
      args.instruction ? `Instruction: ${args.instruction}` : "Instruction: Improve clarity and conciseness",
      "\n\nText:",
      args.text,
    ].join("\n");

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.3,
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content ?? "";
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (err) {
      throw new Error("The AI returned invalid JSON. Please try again.");
    }

    const TextSchema = z.object({ text: z.string().max(4000) });
    const result = TextSchema.safeParse(parsed);
    if (!result.success) {
      throw new Error("The AI response did not match the expected format.");
    }

    return { text: result.data.text };
  },
});
