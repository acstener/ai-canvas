"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type {
  ExcalidrawInitialDataState,
  BinaryFiles,
  AppState,
  ExcalidrawImperativeAPI,
} from "@excalidraw/excalidraw/types";
import type { CanvasElement } from "@/components/excalidrawTransform";
import throttle from "lodash.throttle";
import AIControls from "@/components/AIControls";

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
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
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
      throttle(async (data: ExcalidrawInitialDataState) => {
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

  const initialData: ExcalidrawInitialDataState | null =
    (scene?.data as ExcalidrawInitialDataState) ?? {
      elements: [],
      appState: { viewBackgroundColor: "#ffffff" } as Partial<AppState>,
      files: {} as BinaryFiles,
    };

  function insertElements(newElements: CanvasElement[]) {
    const api = apiRef.current;
    if (!api || !newElements.length) return;
    // Prefer API insertion if available (future-proof)
    if (typeof (api as unknown as { onInsertElements?: (els: CanvasElement[]) => void }).onInsertElements === "function") {
      (api as unknown as { onInsertElements: (els: CanvasElement[]) => void }).onInsertElements(newElements);
      return;
    }
    const existing = api.getSceneElements();
    type UpdateSceneArg = Parameters<ExcalidrawImperativeAPI["updateScene"]>[0];
    const merged = [
      ...((existing as unknown) as unknown[]),
      ...((newElements as unknown) as unknown[]),
    ];
    const updateObj = { elements: merged } as unknown as UpdateSceneArg;
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
    type UpdateSceneArg = Parameters<ExcalidrawImperativeAPI["updateScene"]>[0];
    api.updateScene({ elements: updated } as unknown as UpdateSceneArg);
  }

  function getSelection(): { ids: string[]; elements: CanvasElement[] } {
    const api = apiRef.current;
    if (!api) return { ids: [], elements: [] };
    const appState = api.getAppState() as AppState;
    const selectedIds = Object.keys(appState.selectedElementIds ?? {});
    const elements = (api
      .getSceneElements()
      .filter((el) => selectedIds.includes(el.id)) as unknown) as CanvasElement[];
    return { ids: selectedIds, elements };
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
    </div>
  );
}
