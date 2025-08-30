// VARIATION 3: Debug convertToExcalidrawElements output and manually fix arrows
import { ExcalidrawElementSkeleton, AINode, AIEdge } from "./excalidrawTransform";

const DEFAULTS = {
  strokeColor: "#1e293b", 
  backgroundColor: "#e2e8f0",
  strokeWidth: 2,
};

const MIN_SHAPE_WIDTH = 160;
const MIN_SHAPE_HEIGHT = 64;
const SHAPE_SCALE = 1.6;

export async function toExcalidrawElementsV3(nodes: AINode[], edges: AIEdge[]): Promise<any[]> {
  console.log("=== VARIATION 3: POST-CONVERSION DEBUG ===");
  
  // Create basic skeleton
  const skeletonElements: ExcalidrawElementSkeleton[] = [];
  
  // Simple vertical layout for shapes
  let yOffset = 100;
  const xCenter = 600;
  
  for (const n of nodes) {
    const width = Math.max(MIN_SHAPE_WIDTH, Math.round(n.w * SHAPE_SCALE));
    const height = Math.max(MIN_SHAPE_HEIGHT, Math.round(n.h * SHAPE_SCALE));
    
    skeletonElements.push({
      id: n.id,
      type: n.type,
      x: xCenter - width/2,
      y: yOffset,
      width,
      height,
      backgroundColor: DEFAULTS.backgroundColor,
      strokeColor: DEFAULTS.strokeColor,
      strokeWidth: DEFAULTS.strokeWidth,
      label: n.text ? { text: n.text, fontSize: 18 } : undefined,
    });
    
    yOffset += height + 100;
  }
  
  console.log("Skeleton before conversion:", skeletonElements);
  
  // Convert to Excalidraw elements
  const { convertToExcalidrawElements } = await import("@excalidraw/excalidraw");
  const convertedElements = convertToExcalidrawElements(skeletonElements);
  
  console.log("After convertToExcalidrawElements:", convertedElements);
  
  // NOW manually add arrows to the converted elements
  const elementMap = new Map();
  convertedElements.forEach((el: any) => {
    if (el.id && el.id.match(/^\d+$/)) { // Our node IDs are numbers
      elementMap.set(el.id, el);
    }
  });
  
  console.log("Element map for arrows:", elementMap);
  
  // Create manual arrows between the converted elements
  const now = Date.now();
  for (let i = 0; i < edges.length; i++) {
    const e = edges[i];
    const fromEl = elementMap.get(e.from);
    const toEl = elementMap.get(e.to);
    
    if (!fromEl || !toEl) {
      console.warn("Missing elements for arrow:", e, { fromEl, toEl });
      continue;
    }
    
    // Calculate connection points
    const fromCenter = { x: fromEl.x + fromEl.width/2, y: fromEl.y + fromEl.height/2 };
    const toCenter = { x: toEl.x + toEl.width/2, y: toEl.y + toEl.height/2 };
    
    // Simple edge connection (exit from bottom, enter from top)
    const fromPoint = { x: fromCenter.x, y: fromEl.y + fromEl.height };
    const toPoint = { x: toCenter.x, y: toEl.y };
    
    const arrow = {
      type: "arrow",
      id: `manual-arrow-${i}`,
      x: Math.min(fromPoint.x, toPoint.x),
      y: Math.min(fromPoint.y, toPoint.y), 
      width: Math.abs(toPoint.x - fromPoint.x),
      height: Math.abs(toPoint.y - fromPoint.y),
      angle: 0,
      backgroundColor: "transparent",
      fillStyle: "solid",
      strokeColor: DEFAULTS.strokeColor,
      strokeWidth: DEFAULTS.strokeWidth,
      strokeStyle: "solid",
      opacity: 100,
      roughness: 1,
      roundness: null,
      seed: now + i,
      version: 1,
      versionNonce: now + i + 1000,
      isDeleted: false,
      groupIds: [],
      boundElements: [],
      updated: now,
      link: null,
      locked: false,
      points: [
        [0, 0],
        [toPoint.x - fromPoint.x, toPoint.y - fromPoint.y]
      ],
      startBinding: { elementId: fromEl.id, focus: 0, gap: 8, fixedPoint: null },
      endBinding: { elementId: toEl.id, focus: 0, gap: 8, fixedPoint: null },
      startArrowhead: null,
      endArrowhead: "arrow",
    };
    
    console.log("Created manual arrow:", arrow);
    convertedElements.push(arrow);
  }
  
  console.log("Final elements with manual arrows:", convertedElements);
  console.log("=== END VARIATION 3 DEBUG ===");
  
  return convertedElements;
}