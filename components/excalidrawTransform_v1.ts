// VARIATION 1: Manual arrow creation with proper boundary intersection
import { ExcalidrawElementSkeleton, AINode, AIEdge } from "./excalidrawTransform";

const DEFAULTS = {
  strokeColor: "#1e293b",
  backgroundColor: "#e2e8f0",
  fillStyle: "solid" as const,
  strokeWidth: 2,
  strokeStyle: "solid" as const,
  opacity: 100,
  roughness: 1,
};

const MIN_SHAPE_WIDTH = 160;
const MIN_SHAPE_HEIGHT = 64;
const SHAPE_SCALE = 1.6;

// Text measurement helpers
function estimateTextWidth(text: string, fontSize: number): number {
  // Rough approximation: each character is about 0.6 * fontSize wide
  const avgCharWidth = fontSize * 0.6;
  return text.length * avgCharWidth;
}

function calculateOptimalShapeSize(text: string, fontSize: number): {width: number, height: number} {
  if (!text) {
    return { width: MIN_SHAPE_WIDTH, height: MIN_SHAPE_HEIGHT };
  }
  
  // Calculate text width with padding
  const textWidth = estimateTextWidth(text, fontSize);
  const padding = 40; // 20px padding on each side
  const minWidth = Math.max(MIN_SHAPE_WIDTH, textWidth + padding);
  
  // For very long text, limit width and allow more height for wrapping
  const maxWidth = 300;
  let width = Math.min(minWidth, maxWidth);
  
  // Estimate height based on text wrapping
  const charsPerLine = Math.floor((width - padding) / (fontSize * 0.6));
  const lines = Math.max(1, Math.ceil(text.length / charsPerLine));
  const lineHeight = fontSize * 1.2;
  const textHeight = lines * lineHeight;
  const height = Math.max(MIN_SHAPE_HEIGHT, textHeight + 30); // 15px padding top/bottom
  
  return { width, height };
}

// Calculate where arrow should connect to shape boundary
function getShapeEdgePoints(from: {x: number, y: number, w: number, h: number}, 
                           to: {x: number, y: number, w: number, h: number}) {
  const fromCenter = { x: from.x + from.w/2, y: from.y + from.h/2 };
  const toCenter = { x: to.x + to.w/2, y: to.y + to.h/2 };
  
  const dx = toCenter.x - fromCenter.x;
  const dy = toCenter.y - fromCenter.y;
  
  // For vertical layout, always connect bottom to top with small gap
  const gap = 8; // pixels gap from shape edge
  
  const fromPoint = {
    x: fromCenter.x,
    y: from.y + from.h + gap  // Bottom of source shape + gap
  };
  
  const toPoint = {
    x: toCenter.x, 
    y: to.y - gap  // Top of target shape - gap
  };
  
  return { from: fromPoint, to: toPoint };
}

export function toExcalidrawElementsV1(nodes: AINode[], edges: AIEdge[]): any[] {
  const elements: any[] = [];
  const nodePositions = new Map<string, {x: number, y: number, w: number, h: number}>();
  const now = Date.now();
  
  // Simple vertical layout
  let yOffset = 100;
  const xCenter = 600;
  
  // Create shapes first
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    const fontSize = 18;
    
    // Calculate optimal size based on text content
    const optimalSize = calculateOptimalShapeSize(n.text || "", fontSize);
    const width = Math.max(optimalSize.width, Math.round(n.w * SHAPE_SCALE));
    const height = Math.max(optimalSize.height, Math.round(n.h * SHAPE_SCALE));
    
    const x = xCenter - width/2;
    const y = yOffset;
    
    nodePositions.set(n.id, { x, y, w: width, h: height });
    
    const shape = {
      type: n.type,
      id: n.id,
      x,
      y,
      width,
      height,
      angle: 0,
      backgroundColor: DEFAULTS.backgroundColor,
      fillStyle: DEFAULTS.fillStyle,
      strokeColor: DEFAULTS.strokeColor,
      strokeWidth: DEFAULTS.strokeWidth,
      strokeStyle: DEFAULTS.strokeStyle,
      opacity: DEFAULTS.opacity,
      roughness: DEFAULTS.roughness,
      roundness: n.type === "diamond" ? null : { type: 2 },
      seed: now + i,
      version: 1,
      versionNonce: now + i + 1000,
      isDeleted: false,
      groupIds: [],
      boundElements: [],
      updated: now,
      link: null,
      locked: false,
    };
    
    elements.push(shape);
    
    // Add text label inside shape
    if (n.text) {
      const textPadding = 10;
      const textWidth = width - (textPadding * 2);
      const textHeight = Math.max(20, fontSize * 1.5);
      
      elements.push({
        type: "text",
        id: `${n.id}-label`,
        x: x + textPadding,
        y: y + (height - textHeight) / 2,
        width: textWidth,
        height: textHeight,
        angle: 0,
        backgroundColor: "transparent",
        fillStyle: "solid",
        strokeColor: DEFAULTS.strokeColor,
        strokeWidth: 0,
        strokeStyle: "solid",
        opacity: 100,
        roughness: 0,
        roundness: null,
        seed: now + i + 2000,
        version: 1,
        versionNonce: now + i + 3000,
        isDeleted: false,
        groupIds: [],
        boundElements: [],
        updated: now,
        link: null,
        locked: false,
        text: n.text,
        fontSize: fontSize,
        fontFamily: 1,
        textAlign: "center",
        verticalAlign: "middle",
        lineHeight: 1.2,
        baseline: 16,
        containerId: null,
        originalText: n.text,
      });
    }
    
    yOffset += height + 100;
  }
  
  // Create arrows with proper boundary connections
  for (let i = 0; i < edges.length; i++) {
    const e = edges[i];
    const fromPos = nodePositions.get(e.from);
    const toPos = nodePositions.get(e.to);
    
    if (!fromPos || !toPos) continue;
    
    const points = getShapeEdgePoints(fromPos, toPos);
    
    const arrow = {
      type: "arrow",
      id: `arrow-${e.from}-${e.to}`,
      x: points.from.x,  // Start from the source point
      y: points.from.y,
      width: Math.abs(points.to.x - points.from.x),
      height: Math.abs(points.to.y - points.from.y),
      angle: 0,
      backgroundColor: "transparent",
      fillStyle: "solid",
      strokeColor: DEFAULTS.strokeColor,
      strokeWidth: DEFAULTS.strokeWidth,
      strokeStyle: DEFAULTS.strokeStyle,
      opacity: DEFAULTS.opacity,
      roughness: DEFAULTS.roughness,
      roundness: null,
      seed: now + i + 4000,
      version: 1,
      versionNonce: now + i + 5000,
      isDeleted: false,
      groupIds: [],
      boundElements: [],
      updated: now,
      link: null,
      locked: false,
      points: [
        [0, 0],
        [points.to.x - points.from.x, points.to.y - points.from.y]
      ],
      startBinding: { elementId: e.from, focus: 0, gap: 8, fixedPoint: null },
      endBinding: { elementId: e.to, focus: 0, gap: 8, fixedPoint: null },
      startArrowhead: null,
      endArrowhead: "arrow",
    };
    
    elements.push(arrow);
    
    // Add arrow label if exists
    if (e.label) {
      const midX = (points.from.x + points.to.x) / 2;
      const midY = (points.from.y + points.to.y) / 2;
      
      elements.push({
        type: "text",
        id: `arrow-label-${e.from}-${e.to}`,
        x: midX - 30,
        y: midY - 10,
        width: 60,
        height: 20,
        angle: 0,
        backgroundColor: "white",
        fillStyle: "solid",
        strokeColor: DEFAULTS.strokeColor,
        strokeWidth: 0,
        strokeStyle: "solid",
        opacity: 100,
        roughness: 0,
        roundness: null,
        seed: now + i + 6000,
        version: 1,
        versionNonce: now + i + 7000,
        isDeleted: false,
        groupIds: [],
        boundElements: [],
        updated: now,
        link: null,
        locked: false,
        text: e.label,
        fontSize: 14,
        fontFamily: 1,
        textAlign: "center",
        verticalAlign: "middle",
        lineHeight: 1.2,
        baseline: 12,
        containerId: null,
        originalText: e.label,
      });
    }
  }
  
  return elements;
}