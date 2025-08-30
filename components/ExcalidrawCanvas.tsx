"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { ExcalidrawInitialDataState, BinaryFiles, AppState } from "@excalidraw/excalidraw/types";
import throttle from "lodash.throttle";

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

  return (
    <div className="relative w-full h-full">
      <Excalidraw
        initialData={initialData}
        onChange={(elements, appState, files) => {
          const data: ExcalidrawInitialDataState = { elements, appState, files };
          throttledSave(data);
        }}
      />
      <div className="absolute top-3 right-3 text-xs bg-white/80 px-2 py-1 rounded border">
        {savedState === "saving" ? "Saving…" : savedState === "saved" ? "Saved" : ""}
      </div>
    </div>
  );
}
