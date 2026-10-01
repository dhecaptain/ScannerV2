import React, { useEffect, useRef, useState } from 'react';
import { Camera, X, RefreshCw, AlertCircle } from 'lucide-react';
import { useReceiptStore } from '../store/useReceiptStore';

export const LiveCameraModal: React.FC = () => {
  const { isCameraOpen, setCameraOpen, addUploadedFiles } = useReceiptStore();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState<boolean>(false);

  useEffect(() => {
    if (!isCameraOpen) {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
        setStream(null);
      }
      return;
    }

    let activeStream: MediaStream | null = null;

    async function initCamera() {
      setCameraError(null);
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        });
        activeStream = s;
        setStream(s);
        if (videoRef.current) {
          videoRef.current.srcObject = s;
        }
      } catch (err: any) {
        console.error('Camera error:', err);
        setCameraError(err.message || 'Unable to access device camera.');
      }
    }

    initCamera();

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [isCameraOpen, facingMode]);

  const handleCapture = () => {
    if (!videoRef.current) return;
    setIsCapturing(true);

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      setIsCapturing(false);
      if (blob) {
        const file = new File([blob], `Receipt_Capture_${new Date().toISOString().slice(0, 19)}.jpg`, {
          type: 'image/jpeg',
        });
        addUploadedFiles([file]);
        setCameraOpen(false);
      }
    }, 'image/jpeg', 0.9);
  };

  const handleSwitchCamera = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  if (!isCameraOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4">
      <div className="relative max-w-2xl w-full bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-800 flex flex-col">
        {/* Header */}
        <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between">
          <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full text-white text-xs font-semibold">
            <Camera className="w-3.5 h-3.5 text-emerald-400" />
            <span>Align Receipt in Frame</span>
          </div>

          <button
            onClick={() => setCameraOpen(false)}
            className="w-9 h-9 rounded-full bg-black/60 backdrop-blur-md text-white hover:bg-black/90 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video feed with guides */}
        <div className="relative aspect-[3/4] sm:aspect-[4/5] bg-black flex items-center justify-center overflow-hidden">
          {cameraError ? (
            <div className="p-6 text-center text-rose-400 space-y-2">
              <AlertCircle className="w-10 h-10 mx-auto" />
              <p className="text-sm font-semibold">{cameraError}</p>
              <p className="text-xs text-slate-400">
                Please check camera permissions in your browser or use the file upload option.
              </p>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />

              {/* Receipt Framing Overlay */}
              <div className="absolute inset-8 sm:inset-12 pointer-events-none border-2 border-emerald-400/80 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]">
                {/* Corner brackets */}
                <div className="absolute -top-2 -left-2 w-6 h-6 border-t-4 border-l-4 border-emerald-400" />
                <div className="absolute -top-2 -right-2 w-6 h-6 border-t-4 border-r-4 border-emerald-400" />
                <div className="absolute -bottom-2 -left-2 w-6 h-6 border-b-4 border-l-4 border-emerald-400" />
                <div className="absolute -bottom-2 -right-2 w-6 h-6 border-b-4 border-r-4 border-emerald-400" />

                {/* Center scan line animation */}
                <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-pulse absolute top-1/2 -translate-y-1/2" />
              </div>

              {/* Flash animation */}
              {isCapturing && (
                <div className="absolute inset-0 bg-white animate-fade-out" />
              )}
            </>
          )}
        </div>

        {/* Controls footer */}
        <div className="p-6 bg-slate-950 flex items-center justify-around">
          <button
            onClick={handleSwitchCamera}
            className="w-12 h-12 rounded-full bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center transition-colors"
            title="Switch front/back camera"
          >
            <RefreshCw className="w-5 h-5" />
          </button>

          {/* Shutter Button */}
          <button
            onClick={handleCapture}
            disabled={Boolean(cameraError)}
            className="w-18 h-18 rounded-full border-4 border-white p-1 hover:scale-105 active:scale-95 transition-all shadow-lg disabled:opacity-50"
          >
            <div className="w-full h-full bg-emerald-500 rounded-full flex items-center justify-center shadow-inner">
              <div className="w-5 h-5 bg-white rounded-full" />
            </div>
          </button>

          <div className="w-12" /> {/* Spacer */}
        </div>
      </div>
    </div>
  );
};
