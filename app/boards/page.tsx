"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function BoardsPage() {
  const router = useRouter();
  const boards = useQuery(api.boards.listBoards, {});
  const createBoard = useMutation(api.boards.createBoard);
  const [title, setTitle] = useState("");

  const onCreate = async () => {
    const name = title.trim() || "Untitled";
    const id = await createBoard({ title: name });
    router.push(`/boards/${id}`);
  };

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Your Boards</h1>
      <div className="flex gap-2">
        <input
          className="border rounded px-3 py-2"
          placeholder="Board title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <button
          className="bg-black text-white px-4 py-2 rounded"
          onClick={onCreate}
        >
          Create board
        </button>
      </div>
      <ul className="space-y-2">
        {boards?.map((b) => (
          <li key={b._id}>
            <a
              className="text-blue-600 underline"
              href={`/boards/${b._id}`}
            >
              {b.title}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
