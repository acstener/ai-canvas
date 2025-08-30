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

export function toExcalidrawElements(nodes: AINode[], edges: AIEdge[]): CanvasElement[] {
  const elements: CanvasElement[] = [];
  const nodeMap: NodeMap = new Map();
  const now = Date.now();

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

  function measureTextBox(text: string, fontSize: number, maxWidth: number) {
    const charWidth = fontSize * 0.6; // rough approx
    const words = text.split(/\s+/);
    let lineWidth = 0;
    let lines = 1;
    for (const word of words) {
      const w = (word.length + 1) * charWidth; // word + space
      if (lineWidth + w > maxWidth - TEXT_PADDING * 2) {
        lines += 1;
        lineWidth = w;
      } else {
        lineWidth += w;
      }
    }
    const width = Math.min(
      Math.max(lineWidth + TEXT_PADDING * 2, Math.min(MAX_TEXT_WIDTH, maxWidth)),
      maxWidth
    );
    const lineHeight = Math.round(fontSize * 1.2);
    const height = lines * lineHeight + TEXT_PADDING;
    return { width, height, lines, lineHeight };
  }

  const layout = computeLayeredLayout(nodes, edges);

  for (const n of nodes) {
    const lp = layout.get(n.id);
    const nx = lp?.x ?? n.x;
    const ny = lp?.y ?? n.y;
    const nw = lp?.w ?? n.w;
    const nh = lp?.h ?? n.h;
    nodeMap.set(n.id, { x: nx, y: ny, w: nw, h: nh });
    if (n.type === "text") {
      const content = n.text ?? "";
      const maxWidth = Math.max(MIN_SHAPE_WIDTH, Math.round(nw * SHAPE_SCALE), MAX_TEXT_WIDTH);
      const metrics = measureTextBox(content, TEXT_FONT_SIZE, maxWidth);
      const textEl = {
        type: "text",
        id: n.id,
        x: nx,
        y: ny,
        width: Math.max(metrics.width, MIN_SHAPE_WIDTH),
        height: Math.max(metrics.height, TEXT_FONT_SIZE + 12),
        angle: 0,
        backgroundColor: "transparent",
        fillStyle: "solid" as const,
        strokeColor: DEFAULTS.strokeColor,
        strokeWidth: DEFAULTS.strokeWidth,
      strokeStyle: DEFAULTS.strokeStyle,
      opacity: DEFAULTS.opacity,
      roughness: DEFAULTS.roughness,
        roundness: null,
        seed: now,
        version: 1,
        versionNonce: now + 1,
        isDeleted: false,
        groupIds: [],
        boundElements: [],
        updated: now,
        link: null,
        locked: false,
        text: n.text ?? "",
        fontSize: TEXT_FONT_SIZE,
        fontFamily: 1,
        textAlign: "left" as const,
        verticalAlign: "top" as const,
        lineHeight: 1.2,
        baseline: TEXT_FONT_SIZE - 2,
        containerId: null,
        originalText: n.text ?? "",
      } satisfies CanvasElement as CanvasElement;
      elements.push(textEl);
      continue;
    }

    const el: CanvasElement = {
      type: n.type,
      id: n.id,
      x: nx,
      y: ny,
      width: Math.max(MIN_SHAPE_WIDTH, Math.round(nw * SHAPE_SCALE)),
      height: Math.max(MIN_SHAPE_HEIGHT, Math.round(nh * SHAPE_SCALE)),
      angle: 0,
      backgroundColor: DEFAULTS.backgroundColor,
      fillStyle: DEFAULTS.fillStyle,
      strokeColor: DEFAULTS.strokeColor,
      strokeWidth: DEFAULTS.strokeWidth,
      strokeStyle: DEFAULTS.strokeStyle,
      opacity: DEFAULTS.opacity,
      roughness: DEFAULTS.roughness,
      roundness: { type: 2 },
      seed: now,
      version: 1,
      versionNonce: now + 1,
      isDeleted: false,
      groupIds: [],
      boundElements: [],
      updated: now,
      link: null,
      locked: false,
    } satisfies CanvasElement;
    elements.push(el);

    if (n.text) {
      // Add a label inside the shape
      const shapeWidth = elements[elements.length - 1].width as number;
      const shapeHeight = elements[elements.length - 1].height as number;
      const usableWidth = Math.max(32, shapeWidth - 16);
      const metrics = measureTextBox(n.text, LABEL_FONT_SIZE, usableWidth);
      const labelX = nx + (shapeWidth - metrics.width) / 2;
      const labelY = ny + (shapeHeight - metrics.height) / 2;
      const label: CanvasElement = {
        type: "text",
        id: `${n.id}-label`,
        x: Math.round(labelX),
        y: Math.round(labelY),
        width: Math.round(metrics.width),
        height: Math.round(metrics.height),
        angle: 0,
        backgroundColor: "transparent",
        fillStyle: "solid",
        strokeColor: DEFAULTS.strokeColor,
        strokeWidth: DEFAULTS.strokeWidth,
      strokeStyle: DEFAULTS.strokeStyle,
      opacity: DEFAULTS.opacity,
      roughness: DEFAULTS.roughness,
        roundness: null,
        seed: now,
        version: 1,
        versionNonce: now + 2,
        isDeleted: false,
        groupIds: [],
        boundElements: [],
        updated: now,
        link: null,
        locked: false,
        text: n.text,
        fontSize: LABEL_FONT_SIZE,
        fontFamily: 1,
        textAlign: "center",
        verticalAlign: "middle",
        lineHeight: 1.2,
        baseline: Math.round(LABEL_FONT_SIZE * 0.9),
        containerId: null,
        originalText: n.text,
      } satisfies CanvasElement;
      elements.push(label);
    }
  }

  for (const e of edges) {
    const from = nodeMap.get(e.from);
    const to = nodeMap.get(e.to);
    if (!from || !to) continue;
    const { cx: x1, cy: y1 } = centerOf(from);
    const { cx: x2, cy: y2 } = centerOf(to);

    const arrow: CanvasElement = {
      type: "arrow",
      id: `${e.from}->${e.to}`,
      x: Math.min(x1, x2),
      y: Math.min(y1, y2),
      width: Math.abs(x2 - x1),
      height: Math.abs(y2 - y1),
      angle: 0,
      backgroundColor: "transparent",
      fillStyle: "solid",
      strokeColor: DEFAULTS.strokeColor,
      strokeWidth: DEFAULTS.strokeWidth,
      strokeStyle: DEFAULTS.strokeStyle,
      opacity: DEFAULTS.opacity,
      roughness: DEFAULTS.roughness,
      roundness: null,
      seed: now,
      version: 1,
      versionNonce: now + 3,
      isDeleted: false,
      groupIds: [],
      boundElements: [],
      updated: now,
      link: null,
      locked: false,
      points: [
        [0, 0],
        [x2 - x1, y2 - y1],
      ],
      startBinding: null,
      endBinding: null,
      startArrowhead: "dot",
      endArrowhead: "arrow",
    } satisfies CanvasElement;
    elements.push(arrow);

    if (e.label) {
      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;
      const metrics = measureTextBox(e.label, 16, 280);
      const label: CanvasElement = {
        type: "text",
        id: `${e.from}->${e.to}-label`,
        x: Math.round(midX - metrics.width / 2),
        y: Math.round(midY - metrics.height / 2),
        width: Math.round(metrics.width),
        height: Math.round(metrics.height),
        angle: 0,
        backgroundColor: "transparent",
        fillStyle: "solid",
        strokeColor: DEFAULTS.strokeColor,
        strokeWidth: DEFAULTS.strokeWidth,
      strokeStyle: DEFAULTS.strokeStyle,
      opacity: DEFAULTS.opacity,
      roughness: DEFAULTS.roughness,
        roundness: null,
        seed: now,
        version: 1,
        versionNonce: now + 4,
        isDeleted: false,
        groupIds: [],
        boundElements: [],
        updated: now,
        link: null,
        locked: false,
        text: e.label,
        fontSize: 16,
        fontFamily: 1,
        textAlign: "center",
        verticalAlign: "middle",
        lineHeight: 1.2,
        baseline: 14,
        containerId: null,
        originalText: e.label,
      } satisfies CanvasElement;
      elements.push(label);
    }
  }

  return clampElements(elements);
}
