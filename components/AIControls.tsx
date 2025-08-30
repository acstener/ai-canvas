"use client";

import { useState, useEffect } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toExcalidrawElementsV1 } from "./excalidrawTransform_v1";

export default function AIControls({
  onInsert,
  onRewriteSelected,
  getSelection,
  busy,
}: {
  onInsert: (elements: unknown[]) => void;
  onRewriteSelected: (updates: Record<string, string>) => void;
  getSelection: () => { ids: string[]; elements: unknown[] };
  busy: boolean;
}) {
  const generateDiagram = useAction(api.ai.generateDiagram);
  const generateText = useAction(api.ai.generateText);
  const combineTexts = useAction(api.ai.combineTexts);
  const rewriteText = useAction(api.ai.rewriteText);

  const [prompt, setPrompt] = useState("");
  const [instruction, setInstruction] = useState("make concise");
  const [combineInstruction, setCombineInstruction] = useState("combine into cohesive text");
  const [mode, setMode] = useState<"diagram" | "text">("diagram");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectionState, setSelectionState] = useState({
    hasTextSelection: false,
    hasMultipleTextSelection: false,
    textCount: 0
  });

  // Update selection state more reliably
  useEffect(() => {
    const updateSelection = () => {
      try {
        const selection = getSelection();
        const textElements = selection.elements.filter(
          (el): el is { type: string; text?: string } => 
            typeof el === "object" && el !== null && 
            (el as { type?: string }).type === "text" && 
            Boolean((el as { text?: string }).text?.trim())
        );
        
        const newState = {
          hasTextSelection: textElements.length > 0,
          hasMultipleTextSelection: textElements.length > 1,
          textCount: textElements.length
        };
        
        setSelectionState(newState);
      } catch (error) {
        // If getSelection fails, reset state
        console.log("Selection update failed:", error);
        setSelectionState({
          hasTextSelection: false,
          hasMultipleTextSelection: false,
          textCount: 0
        });
      }
    };

    // Update selection state immediately and on interval
    updateSelection();
    const interval = setInterval(updateSelection, 500); // Check every 500ms
    
    return () => clearInterval(interval);
  }, [getSelection]);

  // Helper to create a text element
  const createTextElement = (text: string, x = 600, y = 300) => {
    const now = Date.now();
    const fontSize = 18;
    const width = Math.max(300, text.length * fontSize * 0.6 + 40);
    const height = Math.max(40, Math.ceil(text.length / 50) * fontSize * 1.2 + 20);
    
    return {
      type: "text",
      id: `text-${now}`,
      x: x - width/2,
      y: y - height/2,
      width,
      height,
      angle: 0,
      backgroundColor: "transparent",
      fillStyle: "solid",
      strokeColor: "#1e293b",
      strokeWidth: 0,
      strokeStyle: "solid",
      opacity: 100,
      roughness: 0,
      roundness: null,
      seed: now,
      version: 1,
      versionNonce: now + 1000,
      isDeleted: false,
      groupIds: [],
      boundElements: [],
      updated: now,
      link: null,
      locked: false,
      text,
      fontSize,
      fontFamily: 1,
      textAlign: "left",
      verticalAlign: "top",
      lineHeight: 1.2,
      baseline: 16,
      containerId: null,
      originalText: text,
    };
  };

  return (
    <div className="absolute top-14 right-3 z-[1000] w-80 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="font-medium text-sm text-gray-700">AI</div>
          <div className="flex bg-gray-200 rounded text-xs">
            <button
              className={`px-2 py-1 rounded ${mode === "diagram" ? "bg-white shadow-sm" : ""}`}
              onClick={() => setMode("diagram")}
            >
              Diagram
            </button>
            <button
              className={`px-2 py-1 rounded ${mode === "text" ? "bg-white shadow-sm" : ""}`}
              onClick={() => setMode("text")}
            >
              Text
            </button>
          </div>
        </div>
      </div>
      
      <div className="p-3 space-y-4">
        {/* Error display */}
        {error && (
          <div className="text-red-600 text-xs bg-red-50 border border-red-200 rounded p-2">
            {error}
          </div>
        )}
        
        {/* Generate section */}
        <div className="space-y-3">
          <textarea
            placeholder={mode === "diagram" ? "Start with a prompt…" : "Describe the text you want to generate…"}
            className="w-full border border-gray-300 rounded text-sm p-2 resize-none focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            rows={3}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
          
          <button
            className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded h-8 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            disabled={loading || busy || !prompt.trim()}
            onClick={async () => {
              setError(null);
              setLoading(true);
              try {
                if (mode === "diagram") {
                  const res = await generateDiagram({ prompt });
                  const elements = toExcalidrawElementsV1(res.nodes, res.edges);
                  onInsert(elements);
                } else {
                  console.log("Generating text with prompt:", prompt);
                  const res = await generateText({ prompt });
                  console.log("Got text response:", res);
                  const textElement = createTextElement(res.text);
                  console.log("Created text element:", textElement);
                  onInsert([textElement]);
                  console.log("Text element inserted");
                }
              } catch (err: unknown) {
                console.error("Error generating:", err);
                const message = err instanceof Error ? err.message : `Failed to generate ${mode}`;
                setError(message);
              } finally {
                setLoading(false);
              }
            }}
          >
            {loading ? "Generating…" : `Generate ${mode}`}
          </button>
        </div>
        
        {/* Combine multiple texts section */}
        {selectionState.hasMultipleTextSelection && (
          <div className="border-t border-gray-200 pt-3 space-y-3">
            <div className="text-xs font-medium text-gray-600 uppercase tracking-wide">
              Combine texts ({selectionState.textCount} selected)
            </div>
            <input
              className="w-full border border-gray-300 rounded text-sm p-2 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., combine into cohesive text, make it a story"
              value={combineInstruction}
              onChange={(e) => setCombineInstruction(e.target.value)}
            />
            <button
              className="w-full bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded h-8 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              disabled={loading || busy}
              onClick={async () => {
                setError(null);
                setLoading(true);
                try {
                  const currentSelection = getSelection();
                  const textElements = currentSelection.elements.filter(
                    (el): el is { type: string; text?: string } =>
                      typeof el === "object" && el !== null &&
                      (el as { type?: string }).type === "text" &&
                      Boolean((el as { text?: string }).text?.trim())
                  );
                  const texts = textElements.map((el) => el.text!);
                  
                  const res = await combineTexts({ texts, instruction: combineInstruction });
                  const combinedElement = createTextElement(res.text);
                  onInsert([combinedElement]);
                } catch (err: unknown) {
                  const message = err instanceof Error ? err.message : "Failed to combine texts";
                  setError(message);
                } finally {
                  setLoading(false);
                }
              }}
            >
              {loading ? "Combining…" : "Combine & rewrite"}
            </button>
          </div>
        )}

        {/* Rewrite section */}
        {selectionState.hasTextSelection && (
          <div className="border-t border-gray-200 pt-3 space-y-3">
            <div className="text-xs font-medium text-gray-600 uppercase tracking-wide">Rewrite selection</div>
            <input
              className="w-full border border-gray-300 rounded text-sm p-2 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., make concise, make friendlier"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
            />
            <button
              className="w-full bg-gray-700 hover:bg-gray-800 text-white text-sm font-medium rounded h-8 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              disabled={loading || busy}
              onClick={async () => {
                setError(null);
                setLoading(true);
                try {
                  const currentSelection = getSelection();
                  const updates: Record<string, string> = {};
                  // naive per-element calls for MVP
                  for (const el of currentSelection.elements) {
                    if (typeof el !== "object" || el === null) continue;
                    const element = el as { type?: string; text?: string; id?: string };
                    if (element.type !== "text") continue;
                    const curText = element.text ?? "";
                    if (!curText.trim()) continue;
                    const res = await rewriteText({ text: curText, instruction });
                    if (element.id) {
                      updates[element.id] = res.text;
                    }
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
    </div>
  );
}
