"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
// Types will be imported dynamically to avoid SSR issues
// Remove the old import since we'll use any[] for now
import throttle from "lodash.throttle";
import AIControls from "@/components/AIControls";
import TextSelectionHandler from "@/components/TextSelectionHandler";

const Excalidraw = dynamic(async () => (await import("@excalidraw/excalidraw")).Excalidraw, {
  ssr: false,
});

export default function ExcalidrawCanvas({
  boardId,
}: {
  boardId: Id<"boards">;
}) {
  const scene = useQuery(api.boards.getScene, { boardId });
  const saveScene = useMutation(api.boards.saveScene);
  const lastServerVersionRef = useRef<number>(scene?.version ?? 0);
  const apiRef = useRef<any | null>(null);
  const [savedState, setSavedState] = useState<"idle" | "saving" | "saved">(
    "idle"
  );

  useEffect(() => {
    if (scene && scene.version > lastServerVersionRef.current) {
      lastServerVersionRef.current = scene.version;
    }
  }, [scene]);

  const throttledSave = useMemo(
    () =>
      throttle(async (data: any) => {
        setSavedState("saving");
        try {
          const result = await saveScene({
            boardId,
            expectedVersion: lastServerVersionRef.current,
            data,
          });
          lastServerVersionRef.current = result.version;
          setSavedState("saved");
          setTimeout(() => setSavedState("idle"), 800);
        } catch {
          setSavedState("idle");
        }
      }, 600),
    [boardId, saveScene]
  );

  const initialData: any | null =
    (scene?.data as any) ?? {
      elements: [],
      appState: { viewBackgroundColor: "#ffffff" },
      files: {},
    };

  function insertElements(newElements: any[]) {
    const api = apiRef.current;
    if (!api || !newElements.length) return;
    // Prefer API insertion if available (future-proof)
    if (typeof (api as unknown as { onInsertElements?: (els: any[]) => void }).onInsertElements === "function") {
      (api as unknown as { onInsertElements: (els: any[]) => void }).onInsertElements(newElements);
      return;
    }
    const existing = api.getSceneElements();
    const merged = [
      ...(existing as unknown[]),
      ...(newElements as unknown[]),
    ];
    const updateObj = { elements: merged };
    api.updateScene(updateObj);
  }

  function updateTextElementsById(updates: Record<string, string>) {
    const api = apiRef.current;
    if (!api) return;
    const existing = api.getSceneElements();
    type AnyEl = { id: string; type: string; [k: string]: unknown };
    const updated = (existing as unknown as AnyEl[]).map((el) => {
      const id = el.id as string;
      if (el.type === "text" && Object.prototype.hasOwnProperty.call(updates, id)) {
        return { ...el, text: updates[id] } as AnyEl;
      }
      return el;
    });
    api.updateScene({ elements: updated });
  }

  function getSelection(): { ids: string[]; elements: any[] } {
    const api = apiRef.current;
    if (!api) return { ids: [], elements: [] };
    const appState = api.getAppState() as any;
    const selectedIds = Object.keys(appState.selectedElementIds ?? {});
    const elements = (api
      .getSceneElements()
      .filter((el) => selectedIds.includes(el.id)) as unknown) as any[];
    return { ids: selectedIds, elements };
  }

  function createTextElementFromSelection(text: string, clientX: number, clientY: number) {
    console.log("=== CREATING TEXT ELEMENT FROM SELECTION ===");
    console.log("Text:", text);
    console.log("Client coordinates:", { clientX, clientY });
    
    const api = apiRef.current;
    console.log("API ref:", api);
    if (!api) {
      console.error("No API ref available");
      return;
    }

    // Get the canvas bounds and convert client coordinates to canvas coordinates
    let canvasElement = document.querySelector('.excalidraw__canvas canvas') as HTMLCanvasElement;
    console.log("Canvas element (attempt 1):", canvasElement);
    
    if (!canvasElement) {
      // Try alternative selectors
      canvasElement = document.querySelector('canvas') as HTMLCanvasElement;
      console.log("Canvas element (attempt 2 - any canvas):", canvasElement);
    }
    
    if (!canvasElement) {
      canvasElement = document.querySelector('.excalidraw canvas') as HTMLCanvasElement;
      console.log("Canvas element (attempt 3):", canvasElement);
    }
    
    if (!canvasElement) {
      // Use a simpler approach - just position relative to viewport
      console.warn("No canvas found, using simple positioning");
      const textElement = {
        type: "text",
        id: `text-duplicate-${Date.now()}`,
        x: 300, // Simple fixed position
        y: 300,
        width: Math.max(200, text.length * 16 * 0.6 + 20),
        height: Math.max(30, Math.ceil(text.length / 40) * 16 * 1.2 + 10),
        angle: 0,
        backgroundColor: "transparent",
        fillStyle: "solid",
        strokeColor: "#1e293b",
        strokeWidth: 0,
        strokeStyle: "solid",
        opacity: 100,
        roughness: 0,
        roundness: null,
        seed: Date.now(),
        version: 1,
        versionNonce: Date.now() + 1000,
        isDeleted: false,
        groupIds: [],
        boundElements: [],
        updated: Date.now(),
        link: null,
        locked: false,
        text,
        fontSize: 16,
        fontFamily: 1,
        textAlign: "left",
        verticalAlign: "top",
        lineHeight: 1.2,
        baseline: 14,
        containerId: null,
        originalText: text,
      };

      console.log("Created simple text element:", textElement);
      insertElements([textElement]);
      return;
    }

    const rect = canvasElement.getBoundingClientRect();
    const appState = api.getAppState() as any;
    console.log("Canvas rect:", rect);
    console.log("App state:", { offsetLeft: appState.offsetLeft, offsetTop: appState.offsetTop, zoom: appState.zoom });
    
    // Convert client coordinates to canvas coordinates accounting for zoom and pan
    const canvasX = (clientX - rect.left - (appState.offsetLeft || 0)) / (appState.zoom?.value || 1);
    const canvasY = (clientY - rect.top - (appState.offsetTop || 0)) / (appState.zoom?.value || 1);
    console.log("Converted canvas coordinates:", { canvasX, canvasY });

    const now = Date.now();
    const fontSize = 16;
    const width = Math.max(200, text.length * fontSize * 0.6 + 20);
    const height = Math.max(30, Math.ceil(text.length / 40) * fontSize * 1.2 + 10);
    
    const textElement = {
      type: "text",
      id: `text-duplicate-${now}`,
      x: canvasX,
      y: canvasY,
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
      baseline: 14,
      containerId: null,
      originalText: text,
    };

    console.log("Created text element:", textElement);
    console.log("Calling insertElements...");
    insertElements([textElement]);
    console.log("=== END TEXT ELEMENT CREATION ===");
  }

  return (
    <div className="relative w-full h-full">
      <Excalidraw
        initialData={initialData}
        excalidrawAPI={(api) => {
          apiRef.current = api;
        }}
        onChange={(elements, appState, files) => {
          const data: ExcalidrawInitialDataState = { elements, appState, files };
          throttledSave(data);
        }}
      />
      <div className="absolute top-3 right-3 text-xs bg-white/80 px-2 py-1 rounded border">
        {savedState === "saving" ? "Saving…" : savedState === "saved" ? "Saved" : ""}
      </div>
      <AIControls
        onInsert={insertElements}
        onRewriteSelected={updateTextElementsById}
        getSelection={getSelection}
        busy={savedState !== "idle"}
      />
      <TextSelectionHandler
        onDuplicateText={createTextElementFromSelection}
      />
    </div>
  );
}
