// VARIATION 2: Fixed skeleton format with extensive debugging
import { ExcalidrawElementSkeleton, AINode, AIEdge } from "./excalidrawTransform";

const DEFAULTS = {
  strokeColor: "#1e293b",
  backgroundColor: "#e2e8f0",
  strokeWidth: 2,
};

const MIN_SHAPE_WIDTH = 160;
const MIN_SHAPE_HEIGHT = 64;
const SHAPE_SCALE = 1.6;

export function toExcalidrawElementsV2(nodes: AINode[], edges: AIEdge[]): ExcalidrawElementSkeleton[] {
  const elements: ExcalidrawElementSkeleton[] = [];
  
  console.log("=== VARIATION 2: SKELETON DEBUG ===");
  console.log("Input nodes:", nodes);
  console.log("Input edges:", edges);
  
  // Simple vertical layout
  let yOffset = 100;
  const xCenter = 600;
  
  // Create shapes with explicit IDs
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    const width = Math.max(MIN_SHAPE_WIDTH, Math.round(n.w * SHAPE_SCALE));
    const height = Math.max(MIN_SHAPE_HEIGHT, Math.round(n.h * SHAPE_SCALE));
    
    const shapeElement: ExcalidrawElementSkeleton = {
      id: n.id, // EXPLICIT ID
      type: n.type,
      x: xCenter - width/2,
      y: yOffset,
      width,
      height,
      backgroundColor: DEFAULTS.backgroundColor,
      strokeColor: DEFAULTS.strokeColor,
      strokeWidth: DEFAULTS.strokeWidth,
    };

    if (n.text) {
      shapeElement.label = {
        text: n.text,
        fontSize: 18,
      };
    }
    
    console.log("Created shape skeleton:", shapeElement);
    elements.push(shapeElement);
    
    yOffset += height + 100;
  }
  
  // Create arrows with VERY SIMPLE format
  for (const e of edges) {
    console.log(`Creating arrow: ${e.from} -> ${e.to}`);
    
    const arrowElement: ExcalidrawElementSkeleton = {
      type: "arrow",
      // NO x,y coordinates - let Excalidraw handle it
      strokeColor: DEFAULTS.strokeColor,
      strokeWidth: DEFAULTS.strokeWidth,
      start: {
        id: e.from, // Reference to shape ID
      },
      end: {
        id: e.to,   // Reference to shape ID  
      },
    };
    
    if (e.label) {
      arrowElement.label = {
        text: e.label,
        fontSize: 14,
      };
    }
    
    console.log("Created arrow skeleton:", arrowElement);
    elements.push(arrowElement);
  }
  
  console.log("Final skeleton elements:", elements);
  console.log("=== END VARIATION 2 DEBUG ===");
  
  return elements;
}