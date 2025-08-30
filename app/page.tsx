"use client";

import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Home() {
  const createBoard = useMutation(api.boards.createBoard);
  const router = useRouter();

  useEffect(() => {
    // Auto-create a new board and redirect to it
    const createAndRedirect = async () => {
      try {
        const boardId = await createBoard({ title: "New Canvas" });
        router.push(`/boards/${boardId}`);
      } catch (error) {
        console.error("Failed to create board:", error);
      }
    };
    
    createAndRedirect();
  }, [createBoard, router]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-gray-900 mb-4">
          Canvas AI
        </h1>
        <p className="text-gray-600">
          Creating your canvas...
        </p>
      </div>
    </div>
  );
}
