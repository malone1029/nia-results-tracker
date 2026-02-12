"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui";
import QRCode from "qrcode";

interface SurveyQrModalProps {
  url: string;
  surveyTitle: string;
  onClose: () => void;
}

export default function SurveyQrModal({ url, surveyTitle, onClose }: SurveyQrModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!canvasRef.current) return;

    QRCode.toCanvas(canvasRef.current, url, {
      width: 280,
      margin: 2,
      color: {
        dark: "#324a4d",  // NIA dark teal
        light: "#ffffff",
      },
    }).catch(() => setError("Failed to generate QR code"));
  }, [url]);

  function downloadPng() {
    if (!canvasRef.current) return;

    // Create a higher-res version for download
    const downloadCanvas = document.createElement("canvas");
    QRCode.toCanvas(downloadCanvas, url, {
      width: 600,
      margin: 3,
      color: {
        dark: "#324a4d",
        light: "#ffffff",
      },
    }).then(() => {
      const link = document.createElement("a");
      link.download = `${surveyTitle.replace(/\s+/g, "-")}-QR.png`;
      link.href = downloadCanvas.toDataURL("image/png");
      link.click();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-card rounded-2xl border border-border shadow-xl max-w-sm w-full p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">QR Code</h3>
          <button
            onClick={onClose}
            className="p-1.5 text-text-muted hover:text-text-secondary rounded-lg hover:bg-surface-subtle"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p className="text-sm text-text-secondary">
          Scan this code to open the survey on any device.
        </p>

        {/* QR Code */}
        <div className="flex justify-center">
          {error ? (
            <div className="text-sm text-nia-red py-8">{error}</div>
          ) : (
            <canvas ref={canvasRef} className="rounded-lg" />
          )}
        </div>

        {/* URL preview */}
        <div className="text-xs text-text-muted text-center break-all px-4">
          {url}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" className="flex-1" onClick={onClose}>
            Close
          </Button>
          <Button size="sm" className="flex-1" onClick={downloadPng}>
            Download PNG
          </Button>
        </div>
      </div>
    </div>
  );
}
