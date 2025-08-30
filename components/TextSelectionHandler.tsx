"use client";

import { useEffect, useState } from "react";

interface TextSelectionHandlerProps {
  onDuplicateText: (text: string, x: number, y: number) => void;
}

export default function TextSelectionHandler({ onDuplicateText }: TextSelectionHandlerProps) {
  const [selection, setSelection] = useState<{
    text: string;
    rect: DOMRect;
    show: boolean;
  } | null>(null);

  useEffect(() => {
    function checkForTextSelection() {
      console.log("=== CHECKING FOR TEXT SELECTION ===");
      
      // Check for textarea/input selection first (Excalidraw uses these)
      const activeElement = document.activeElement;
      console.log("Active element:", activeElement);
      
      if (activeElement && (activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'INPUT')) {
        const input = activeElement as HTMLTextAreaElement | HTMLInputElement;
        const start = input.selectionStart || 0;
        const end = input.selectionEnd || 0;
        const selectedText = input.value.substring(start, end).trim();
        
        console.log("Input selection:", { start, end, selectedText, value: input.value });
        
        // Check if it's in an Excalidraw text editor
        const isExcalidrawEditor = input.closest('.excalidraw-textEditorContainer');
        console.log("Is Excalidraw editor:", !!isExcalidrawEditor);
        
        if (selectedText && start !== end && isExcalidrawEditor) {
          const rect = input.getBoundingClientRect();
          console.log("Showing button for input selection!");
          setSelection({
            text: selectedText,
            rect,
            show: true,
          });
          return;
        }
      }
      
      // Fallback to regular selection API
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        const selectedText = range.toString().trim();
        
        if (selectedText) {
          const rect = range.getBoundingClientRect();
          console.log("Using window selection:", selectedText);
          setSelection({
            text: selectedText,
            rect,
            show: true,
          });
          return;
        }
      }
      
      console.log("No selection found, but keeping button visible for a bit");
      // Don't immediately hide - let click outside handler manage this
      // setSelection(null);
    }

    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Element;
      console.log("Click outside detected, target:", target);
      if (!target.closest('.text-selection-handler')) {
        // Add a small delay to allow button clicks to register
        setTimeout(() => {
          console.log("Hiding button after delay");
          setSelection(null);
        }, 100);
      }
    }

    // Listen to multiple events to catch text selection
    console.log("TextSelectionHandler: Adding event listeners");
    document.addEventListener('selectionchange', checkForTextSelection);
    document.addEventListener('mouseup', checkForTextSelection);
    document.addEventListener('keyup', checkForTextSelection);
    document.addEventListener('select', checkForTextSelection);
    document.addEventListener('input', checkForTextSelection);
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      console.log("TextSelectionHandler: Removing event listeners");
      document.removeEventListener('selectionchange', checkForTextSelection);
      document.removeEventListener('mouseup', checkForTextSelection);
      document.removeEventListener('keyup', checkForTextSelection);
      document.removeEventListener('select', checkForTextSelection);
      document.removeEventListener('input', checkForTextSelection);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  console.log("TextSelectionHandler render - selection state:", selection);
  
  if (!selection?.show) {
    console.log("TextSelectionHandler: Not showing button");
    return null;
  }

  console.log("TextSelectionHandler: Showing button at position:", selection.rect);

  const handleDuplicate = () => {
    console.log("Duplicating text:", selection.text);
    const x = selection.rect.left + selection.rect.width + 20;
    const y = selection.rect.top + selection.rect.height / 2;
    
    onDuplicateText(selection.text, x, y);
    setSelection(null);
    
    // Clear the selection
    window.getSelection()?.removeAllRanges();
    
    // Clear input selection if applicable
    const activeElement = document.activeElement;
    if (activeElement && (activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'INPUT')) {
      const input = activeElement as HTMLTextAreaElement | HTMLInputElement;
      input.setSelectionRange(input.selectionEnd || 0, input.selectionEnd || 0);
    }
  };

  return (
    <button
      onClick={(e) => {
        console.log("DUPLICATE BUTTON CLICKED!");
        e.preventDefault();
        e.stopPropagation();
        handleDuplicate();
      }}
      className="text-selection-handler fixed z-[2000] bg-blue-600 hover:bg-blue-700 text-white text-xs px-2 py-1 rounded shadow-lg flex items-center gap-1 transition-colors"
      style={{
        left: selection.rect.right + 8,
        top: selection.rect.top + selection.rect.height / 2 - 14,
      }}
    >
      📋 Duplicate
    </button>
  );
}