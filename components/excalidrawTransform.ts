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

  for (const n of nodes) {
    nodeMap.set(n.id, { x: n.x, y: n.y, w: n.w, h: n.h });
    if (n.type === "text") {
      const content = n.text ?? "";
      const maxWidth = Math.max(MIN_SHAPE_WIDTH, Math.round(n.w * SHAPE_SCALE), MAX_TEXT_WIDTH);
      const metrics = measureTextBox(content, TEXT_FONT_SIZE, maxWidth);
      const textEl = {
        type: "text",
        id: n.id,
        x: n.x,
        y: n.y,
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
      x: n.x,
      y: n.y,
      width: Math.max(MIN_SHAPE_WIDTH, Math.round(n.w * SHAPE_SCALE)),
      height: Math.max(MIN_SHAPE_HEIGHT, Math.round(n.h * SHAPE_SCALE)),
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
      const labelX = n.x + (shapeWidth - metrics.width) / 2;
      const labelY = n.y + (shapeHeight - metrics.height) / 2;
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
