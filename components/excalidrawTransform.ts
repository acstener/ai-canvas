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
  strokeWidth: 1,
  strokeStyle: "solid" as const,
  opacity: 100,
  roughness: 1,
};

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

  for (const n of nodes) {
    nodeMap.set(n.id, { x: n.x, y: n.y, w: n.w, h: n.h });
    if (n.type === "text") {
      const textEl = {
        type: "text",
        id: n.id,
        x: n.x,
        y: n.y,
        width: n.w,
        height: n.h,
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
        fontSize: 20,
        fontFamily: 1,
        textAlign: "left" as const,
        verticalAlign: "top" as const,
        lineHeight: 1.2,
        baseline: 18,
        containerId: null,
        originalText: n.text ?? "",
      } satisfies CanvasElement as CanvasElement;
      elements.push(textEl);
      continue;
    }

    const el: CanvasElement = {
      type: n.type,
      id: n.id,
      x: n.x,
      y: n.y,
      width: n.w,
      height: n.h,
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
      const label: CanvasElement = {
        type: "text",
        id: `${n.id}-label`,
        x: n.x + 8,
        y: n.y + 8,
        width: n.w - 16,
        height: 24,
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
        fontSize: 18,
        fontFamily: 1,
        textAlign: "left",
        verticalAlign: "top",
        lineHeight: 1.2,
        baseline: 16,
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
      const label: CanvasElement = {
        type: "text",
        id: `${e.from}->${e.to}-label`,
        x: midX + 6,
        y: midY + 6,
        width: 200,
        height: 24,
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
        verticalAlign: "top",
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
