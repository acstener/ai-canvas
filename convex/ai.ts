import { action } from "./_generated/server";
import { v } from "convex/values";
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

// Simple global rate limiter (no per-user tracking)
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 1000; // 1 second between requests

function checkRateLimit() {
  const now = Date.now();
  if (now - lastRequestTime < MIN_REQUEST_INTERVAL) {
    throw new Error("Please wait a moment before making another request.");
  }
  lastRequestTime = now;
}

export const generateDiagram = action({
  args: { prompt: v.string(), maxShapes: v.optional(v.number()) },
  handler: async (ctx, args) => {
    checkRateLimit();

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("Server misconfigured: OPENAI_API_KEY not set");

    const client = new OpenAI({ apiKey });

    const maxAllowed = Math.min(args.maxShapes ?? 12, 20);

    const system = [
      "You are a diagram generator that creates flowcharts with connected elements.",
      "ALWAYS return a JSON object with both 'nodes' and 'edges' arrays.",
      "Each node: {id, type, x, y, w, h, text?}.",
      "type is one of rectangle|diamond|ellipse|text.",
      `Return at most ${maxAllowed} nodes.`,
      "Each edge: {from, to, label?} where from/to reference node ids.",
      "IMPORTANT: For flowcharts, ALWAYS create edges connecting the nodes in sequence.",
      "For user journey/process flows, connect each step to the next with edges.",
      "Do not return any prose or markdown. JSON only.",
    ].join(" ");

    const user = [
      "Create a diagram for this prompt:",
      args.prompt,
    ].join("\n\n");

    const completion = await client.chat.completions.create({
      model: "gpt-4o",
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
      console.error("AI response validation failed:", result.error);
      console.error("Raw AI response:", parsed);
      throw new Error(
        "The AI response did not match the expected diagram format. Please try again."
      );
    }

    // Debug: Log what we're generating
    console.log("AI generated diagram:", {
      nodes: result.data.nodes.length,
      edges: result.data.edges.length,
      edgeDetails: result.data.edges
    });

    // Enforce max nodes runtime as well
    const limited = {
      nodes: result.data.nodes.slice(0, maxAllowed),
      edges: result.data.edges.slice(0, maxAllowed * 3),
    } as z.infer<typeof DiagramSchema>;

    const clamped = clampDiagram(limited);
    return clamped;
  },
});

export const generateText = action({
  args: { prompt: v.string() },
  handler: async (ctx, args) => {
    checkRateLimit();

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("Server misconfigured: OPENAI_API_KEY not set");

    const client = new OpenAI({ apiKey });

    const system = [
      "You generate text content based on the user's prompt.",
      "Return JSON only: {\"text\": string}.",
      "No additional fields. No prose.",
    ].join(" ");

    const completion = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: system },
        { role: "user", content: args.prompt },
      ],
      temperature: 0.7,
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

export const combineTexts = action({
  args: { texts: v.array(v.string()), instruction: v.optional(v.string()) },
  handler: async (ctx, args) => {
    checkRateLimit();

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("Server misconfigured: OPENAI_API_KEY not set");

    const client = new OpenAI({ apiKey });

    const system = [
      "You combine and rewrite multiple text fragments into a cohesive piece.",
      "Return JSON only: {\"text\": string}.",
      "No additional fields. No prose.",
    ].join(" ");

    const textList = args.texts.map((text, i) => `${i + 1}. ${text}`).join("\n\n");
    const user = [
      args.instruction ? `Instruction: ${args.instruction}` : "Instruction: Combine these text fragments into a cohesive, well-structured piece",
      "\n\nText fragments:",
      textList,
    ].join("\n");

    const completion = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.5,
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

export const rewriteText = action({
  args: { text: v.string(), instruction: v.optional(v.string()) },
  handler: async (ctx, args) => {
    checkRateLimit();

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
      model: "gpt-4o",
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
