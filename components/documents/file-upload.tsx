"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Upload, Loader2, Check, X } from "lucide-react";

interface FileUploadProps {
  caseId: string;
  documentName: string;
  stage: number;
  onUploaded?: () => void;
  variant?: "default" | "compact";
}

export function FileUpload({
  caseId,
  documentName,
  stage,
  onUploaded,
  variant = "default",
}: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setError("");
      setUploading(true);
      setFileName(file.name);

      const formData = new FormData();
      formData.append("file", file);
      formData.append("caseId", caseId);
      formData.append("documentName", documentName);
      formData.append("stage", String(stage));

      try {
        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        const result = await res.json();

        if (!res.ok) {
          setError(result.error || "Upload failed");
          setUploading(false);
          return;
        }

        setDone(true);
        setUploading(false);
        onUploaded?.();
      } catch {
        setError("Upload failed. Please try again.");
        setUploading(false);
      }
    },
    [caseId, documentName, stage, onUploaded]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  if (done) {
    return (
      <div className="flex items-center gap-2 text-sm text-emerald-600 font-medium">
        <Check className="h-4 w-4" />
        {fileName} uploaded
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp"
          onChange={handleInputChange}
          className="hidden"
        />
        <Button
          size="sm"
          variant="default"
          className="text-xs h-8 gap-1.5"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Upload className="h-3 w-3" />
          )}
          {uploading ? "Uploading..." : "Upload"}
        </Button>
        {error && <p className="text-xs text-destructive mt-1">{error}</p>}
      </div>
    );
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.webp"
        onChange={handleInputChange}
        className="hidden"
      />
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all ${
          dragOver
            ? "border-primary bg-blue-50"
            : "border-gray-300 hover:border-gray-400 bg-gray-50"
        }`}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="text-sm text-gray-500">
              Uploading {fileName}...
            </span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload className="h-6 w-6 text-gray-400" />
            <span className="text-sm text-gray-500">
              Drag & drop or click to upload
            </span>
            <span className="text-xs text-gray-400">
              PDF, JPG, PNG up to 10MB
            </span>
          </div>
        )}
      </div>
      {error && (
        <div className="flex items-center gap-1.5 mt-2 text-sm text-destructive">
          <X className="h-3.5 w-3.5" />
          {error}
        </div>
      )}
    </div>
  );
}
