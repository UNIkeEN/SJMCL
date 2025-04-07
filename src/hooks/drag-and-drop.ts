// TODO: Does Tauri have native API?
import { useEffect } from "react";

interface DragDropOptions {
  mimeTypes?: string[];
  onDrop: (data: string, event: DragEvent) => void;
  onDragOver?: (event: DragEvent) => void;
  preventDefault?: boolean;
}

const useDragAndDrop = ({
  mimeTypes = ["text/plain"],
  onDrop,
  onDragOver,
  preventDefault = true,
}: DragDropOptions) => {
  useEffect(() => {
    const handleDragOver = (event: DragEvent) => {
      if (preventDefault) {
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer!.dropEffect = "copy";
      }
      onDragOver?.(event);
    };

    const handleDrop = (event: DragEvent) => {
      if (preventDefault) {
        event.preventDefault();
        event.stopPropagation();
      }

      for (const type of mimeTypes) {
        const data = event.dataTransfer?.getData(type);
        if (data) {
          onDrop(data, event);
          break;
        }
      }
    };

    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("drop", handleDrop);

    return () => {
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("drop", handleDrop);
    };
  }, [mimeTypes, onDrop, onDragOver, preventDefault]);
};

export default useDragAndDrop;
