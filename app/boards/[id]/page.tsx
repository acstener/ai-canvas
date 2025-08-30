import { preloadQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import ExcalidrawCanvas from "@/components/ExcalidrawCanvas";

export default async function BoardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const boardId = id as Id<"boards">;

  // Preload scene data for faster first paint (optional)
  void preloadQuery(api.boards.getScene, { boardId });

  return (
    <div className="w-full h-[calc(100vh-0px)]">
      <ExcalidrawCanvas boardId={boardId} />
    </div>
  );
}
