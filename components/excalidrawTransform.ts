// Local minimal element type compatible with Excalidraw runtime
export type CanvasElement = {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  [key: string]: unknown;
};

// Excalidraw Skeleton types for proper arrow bindings
export type ExcalidrawElementSkeleton = {
  id?: string;
  type: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  label?: {
    text: string;
    fontSize?: number;
    strokeColor?: string;
  };
  start?: {
    id?: string;
    type?: string;
  };
  end?: {
    id?: string;
    type?: string;
  };
  [key: string]: unknown;
};

export type AINode = {
  id: string;
  type: "rectangle" | "diamond" | "ellipse" | "text";
  x: number;
  y: number;
  w: number;
  h: number;
  text?: string;
};

export type AIEdge = { from: string; to: string; label?: string };

type NodeMap = Map<string, { x: number; y: number; w: number; h: number }>;

const DEFAULTS = {
  strokeColor: "#1e293b",
  backgroundColor: "#e2e8f0",
  fillStyle: "solid" as const,
  strokeWidth: 2,
  strokeStyle: "solid" as const,
  opacity: 100,
  roughness: 1,
};

// Sizing defaults to make shapes readable by default
const SHAPE_SCALE = 1.6;
const MIN_SHAPE_WIDTH = 160;
const MIN_SHAPE_HEIGHT = 64;
const TEXT_FONT_SIZE = 22;
const LABEL_FONT_SIZE = 20;
const MAX_TEXT_WIDTH = 360;
const TEXT_PADDING = 12;

function centerOf(node: { x: number; y: number; w: number; h: number }) {
  return { cx: node.x + node.w / 2, cy: node.y + node.h / 2 };
}

export function clampElements<T extends CanvasElement>(elements: T[]): T[] {
  const MIN_COORD = -5000;
  const MAX_COORD = 5000;
  return elements.map((el) => ({
    ...el,
    x: Math.min(MAX_COORD, Math.max(MIN_COORD, el.x)),
    y: Math.min(MAX_COORD, Math.max(MIN_COORD, el.y)),
  }));
}

export function toExcalidrawElements(nodes: AINode[], edges: AIEdge[]): ExcalidrawElementSkeleton[] {
  // Simple layered top-to-bottom layout to avoid overlapping nodes.
  function computeLayeredLayout(
    inputNodes: AINode[],
    inputEdges: AIEdge[]
  ): Map<string, { x: number; y: number; w: number; h: number }> {
    const nodeById = new Map(inputNodes.map((n) => [n.id, { ...n }]));
    const incomingCounts = new Map<string, number>();
    const outgoing = new Map<string, string[]>();
    for (const n of inputNodes) {
      incomingCounts.set(n.id, 0);
      outgoing.set(n.id, []);
    }
    for (const e of inputEdges) {
      if (!nodeById.has(e.from) || !nodeById.has(e.to)) continue;
      incomingCounts.set(e.to, (incomingCounts.get(e.to) ?? 0) + 1);
      outgoing.get(e.from)!.push(e.to);
    }

    // Kahn-like layering
    const queue: string[] = [];
    for (const n of inputNodes) if ((incomingCounts.get(n.id) ?? 0) === 0) queue.push(n.id);
    if (queue.length === 0 && inputNodes.length > 0) queue.push(inputNodes[0].id);

    const level = new Map<string, number>();
    while (queue.length) {
      const id = queue.shift()!;
      const currentLevel = level.get(id) ?? 0;
      for (const nxt of outgoing.get(id) ?? []) {
        if (!level.has(nxt)) level.set(nxt, currentLevel + 1);
        const remaining = Math.max(0, (incomingCounts.get(nxt) ?? 1) - 1);
        incomingCounts.set(nxt, remaining);
        if (remaining === 0) queue.push(nxt);
      }
      if (!level.has(id)) level.set(id, currentLevel);
    }
    for (const n of inputNodes) if (!level.has(n.id)) level.set(n.id, 0);

    const groups = new Map<number, string[]>();
    for (const [id, lvl] of level.entries()) {
      if (!groups.has(lvl)) groups.set(lvl, []);
      groups.get(lvl)!.push(id);
    }
    for (const ids of groups.values()) ids.sort();

    // Use scaled sizes for layout measurements
    const scaledSize = new Map<string, { w: number; h: number }>();
    for (const n of inputNodes) {
      scaledSize.set(n.id, {
        w: Math.max(MIN_SHAPE_WIDTH, Math.round(n.w * SHAPE_SCALE)),
        h: Math.max(MIN_SHAPE_HEIGHT, Math.round(n.h * SHAPE_SCALE)),
      });
    }

    const H_MARGIN = 80;
    const V_MARGIN = 80;
    const H_GAP = 160;
    const V_GAP = 160;

    // Determine maximum row width and row heights
    const levels = Array.from(groups.keys());
    const maxLevel = levels.length ? Math.max(...levels) : 0;
    let maxRowWidth = 0;
    const rowHeights: number[] = [];
    for (let lvl = 0; lvl <= maxLevel; lvl++) {
      const ids = groups.get(lvl) ?? [];
      let rowWidth = 0;
      let rH = 0;
      ids.forEach((id, idx) => {
        const s = scaledSize.get(id)!;
        rowWidth += s.w;
        if (idx < ids.length - 1) rowWidth += H_GAP;
        rH = Math.max(rH, s.h);
      });
      maxRowWidth = Math.max(maxRowWidth, rowWidth);
      rowHeights[lvl] = rH;
    }

    // Position nodes centered per row
    const pos = new Map<string, { x: number; y: number; w: number; h: number }>();
    let yCursor = V_MARGIN;
    for (let lvl = 0; lvl <= maxLevel; lvl++) {
      const ids = groups.get(lvl) ?? [];
      let rowWidth = 0;
      ids.forEach((id, idx) => {
        const s = scaledSize.get(id)!;
        rowWidth += s.w;
        if (idx < ids.length - 1) rowWidth += H_GAP;
      });
      let xCursor = H_MARGIN + (maxRowWidth - rowWidth) / 2;
      for (const id of ids) {
        const s = scaledSize.get(id)!;
        const x = Math.round(xCursor);
        const y = Math.round(yCursor + (rowHeights[lvl] - s.h) / 2);
        pos.set(id, { x, y, w: s.w, h: s.h });
        xCursor += s.w + H_GAP;
      }
      yCursor += rowHeights[lvl] + V_GAP;
    }

    return pos;
  }

  const layout = computeLayeredLayout(nodes, edges);
  const skeletonElements: ExcalidrawElementSkeleton[] = [];

  // Create shapes using Excalidraw skeleton API
  for (const n of nodes) {
    const lp = layout.get(n.id);
    const nx = lp?.x ?? n.x;
    const ny = lp?.y ?? n.y;
    const nw = Math.max(MIN_SHAPE_WIDTH, Math.round((lp?.w ?? n.w) * SHAPE_SCALE));
    const nh = Math.max(MIN_SHAPE_HEIGHT, Math.round((lp?.h ?? n.h) * SHAPE_SCALE));

    if (n.type === "text") {
      // Standalone text element
      skeletonElements.push({
        id: n.id,
        type: "text",
        x: nx,
        y: ny,
        width: nw,
        height: nh,
        text: n.text || "",
        fontSize: TEXT_FONT_SIZE,
        strokeColor: DEFAULTS.strokeColor,
      });
    } else {
      // Shape with optional label
      const shapeElement: ExcalidrawElementSkeleton = {
        id: n.id,
        type: n.type,
        x: nx,
        y: ny,
        width: nw,
        height: nh,
        backgroundColor: DEFAULTS.backgroundColor,
        strokeColor: DEFAULTS.strokeColor,
        strokeWidth: DEFAULTS.strokeWidth,
      };

      if (n.text) {
        shapeElement.label = {
          text: n.text,
          fontSize: LABEL_FONT_SIZE,
        };
      }

      skeletonElements.push(shapeElement);
    }
  }

  // Debug: Log what edges we're processing
  console.log("Processing edges for arrows:", edges);

  // Create arrows using proper Excalidraw skeleton bindings (no explicit coordinates)
  for (const e of edges) {
    const arrowElement: ExcalidrawElementSkeleton = {
      type: "arrow",
      x: 0, // Let Excalidraw calculate
      y: 0, // Let Excalidraw calculate  
      strokeColor: DEFAULTS.strokeColor,
      strokeWidth: DEFAULTS.strokeWidth,
      start: {
        id: e.from,
      },
      end: {
        id: e.to,
      },
    };

    // Debug: Log arrow creation
    console.log("Creating arrow with pure binding:", arrowElement);

    if (e.label) {
      arrowElement.label = {
        text: e.label,
        fontSize: 16,
      };
    }

    skeletonElements.push(arrowElement);
  }

  return skeletonElements;
}
