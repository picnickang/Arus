import { useCallback, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { useToast } from "@/hooks/use-toast";
import { ALLOWED_FILE_TYPES, MAX_ATTACHMENTS, MAX_FILE_SIZE_BYTES } from "./constants";

export function useAgentChatAttachments() {
  const { toast } = useToast();
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [filePreviews, setFilePreviews] = useState<Map<string, string>>(new Map());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const generatePreview = useCallback((file: File) => {
    if (file.type.startsWith("image/")) {
      const key = `${file.name}-${file.size}`;
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result;
        if (typeof result === "string") {
          setFilePreviews((prev) => new Map(prev).set(key, result));
        }
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const addFiles = useCallback(
    (files: File[]) => {
      const valid = files.filter(
        (f) => ALLOWED_FILE_TYPES.includes(f.type) && f.size <= MAX_FILE_SIZE_BYTES
      );
      if (valid.length < files.length) {
        toast({
          title: "Some files skipped",
          description: "Only PNG/JPG images, PDFs, and CSV files under 10MB are supported.",
          variant: "destructive",
        });
      }
      valid.forEach(generatePreview);
      setAttachedFiles((prev) => [...prev, ...valid].slice(0, MAX_ATTACHMENTS));
    },
    [toast, generatePreview]
  );

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    addFiles(files);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeFile = (index: number) => {
    setAttachedFiles((prev) => {
      const removed = prev[index];
      if (removed) {
        const key = `${removed.name}-${removed.size}`;
        setFilePreviews((p) => {
          const n = new Map(p);
          n.delete(key);
          return n;
        });
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      const droppedFiles = Array.from(e.dataTransfer.files);
      if (droppedFiles.length > 0) {
        addFiles(droppedFiles);
      }
    },
    [addFiles]
  );

  return {
    attachedFiles,
    fileInputRef,
    filePreviews,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    handleFileSelect,
    isDragOver,
    removeFile,
    setAttachedFiles,
    setFilePreviews,
    setUploadProgress,
    uploadProgress,
  };
}
