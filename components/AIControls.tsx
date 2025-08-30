"use client";

import { useState, useMemo } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { CanvasElement } from "@/components/excalidrawTransform";
import { toExcalidrawElements } from "./excalidrawTransform";

export default function AIControls({
  onInsert,
  onRewriteSelected,
  getSelection,
  busy,
}: {
  onInsert: (elements: CanvasElement[]) => void;
  onRewriteSelected: (updates: Record<string, string>) => void;
  getSelection: () => { ids: string[]; elements: CanvasElement[] };
  busy: boolean;
}) {
  const generateDiagram = useAction(api.ai.generateDiagram);
  const rewriteText = useAction(api.ai.rewriteText);

  const [prompt, setPrompt] = useState("");
  const [maxShapes, setMaxShapes] = useState<number>(8);
  const [instruction, setInstruction] = useState("make concise");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selection = useMemo(() => getSelection(), [getSelection]);
  const hasTextSelection = selection.elements.some(
    (el) => el.type === "text"
  );

  return (
    <div className="absolute top-14 right-3 w-80 bg-white/90 backdrop-blur rounded border shadow-sm p-3 space-y-2 text-sm">
      <div className="font-medium">AI</div>
      {error && (
        <div className="text-red-600 text-xs">{error}</div>
      )}
      <div className="space-y-1">
        <textarea
          placeholder="Describe a diagram to generate…"
          className="w-full border rounded p-2 text-sm"
          rows={3}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
        <div className="flex items-center justify-between gap-2">
          <label className="text-xs">Max shapes</label>
          <input
            type="number"
            min={1}
            max={20}
            className="w-20 border rounded p-1 text-xs text-right"
            value={maxShapes}
            onChange={(e) => setMaxShapes(Number(e.target.value))}
          />
        </div>
        <button
          className="w-full bg-black text-white rounded py-1.5 disabled:opacity-50"
          disabled={loading || busy || !prompt.trim()}
          onClick={async () => {
            setError(null);
            setLoading(true);
            try {
              const res = await generateDiagram({ prompt, maxShapes });
              const elements = toExcalidrawElements(res.nodes, res.edges);
              onInsert(elements);
            } catch (err: unknown) {
              const message = err instanceof Error ? err.message : "Failed to generate diagram";
              setError(message);
            } finally {
              setLoading(false);
            }
          }}
        >
          {loading ? "Generating…" : "Generate"}
        </button>
      </div>

      {hasTextSelection && (
        <div className="pt-2 border-t space-y-2">
          <div className="text-xs">Rewrite selection</div>
          <input
            className="w-full border rounded p-2 text-sm"
            placeholder="e.g., make concise, make friendlier"
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
          />
          <button
            className="w-full bg-slate-800 text-white rounded py-1.5 disabled:opacity-50"
            disabled={loading || busy}
            onClick={async () => {
              setError(null);
              setLoading(true);
              try {
                const updates: Record<string, string> = {};
                // naive per-element calls for MVP
                for (const el of selection.elements) {
                  if (el.type !== "text") continue;
                  const curText = (el as unknown as { text?: string }).text ?? "";
                  if (!curText.trim()) continue;
                  const res = await rewriteText({ text: curText, instruction });
                  updates[el.id] = res.text;
                }
                if (Object.keys(updates).length > 0) {
                  onRewriteSelected(updates);
                }
              } catch (err: unknown) {
                const message = err instanceof Error ? err.message : "Failed to rewrite selection";
                setError(message);
              } finally {
                setLoading(false);
              }
            }}
          >
            {loading ? "Rewriting…" : "Rewrite selection"}
          </button>
        </div>
      )}
    </div>
  );
}
