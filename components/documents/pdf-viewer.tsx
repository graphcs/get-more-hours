"use client";

interface PdfViewerProps {
  storagePath?: string | null;
  ocrProcessed: boolean;
}

export function PdfViewer({ ocrProcessed }: PdfViewerProps) {
  return (
    <div className="flex-1 flex flex-col bg-gray-100">
      {/* Dark toolbar */}
      <div className="px-4 py-2 bg-gray-700 flex justify-center">
        <span className="text-sm text-white">Page 1 of 1</span>
      </div>

      {/* PDF render area */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-[520px] min-h-[640px] bg-white rounded-sm shadow-lg p-14 relative">
          {/* Placeholder for actual PDF rendering */}
          <div className="text-center text-gray-400 mt-20">
            <div className="text-4xl mb-4">📄</div>
            <p className="text-sm">PDF document preview</p>
            <p className="text-xs mt-1 text-gray-300">
              Full PDF rendering will be available with Supabase Storage signed
              URLs
            </p>
          </div>

          {ocrProcessed && (
            <div className="absolute top-3 right-3 px-2 py-1 rounded bg-emerald-50 border border-emerald-200 text-[10px] font-semibold text-emerald-600">
              OCR Processed
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
