"use client";

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, RefreshCw, Check, AlertCircle, Loader2 } from 'lucide-react';
import { useFaceRecognition } from '@/hooks/useFaceRecognition';

interface FaceCaptureProps {
  onCapture: (descriptor: number[]) => void;
  onCancel?: () => void;
  mode?: 'register' | 'verify';
  existingDescriptor?: number[] | null;
  existingDescriptors?: number[][] | null; // Multi-angle descriptors
  onVerified?: (match: boolean, distance: number) => void;
}

export const FaceCapture: React.FC<FaceCaptureProps> = ({
  onCapture,
  onCancel,
  mode = 'register',
  existingDescriptor,
  existingDescriptors,
  onVerified,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [isStreaming, setIsStreaming] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'detecting' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const {
    isModelLoaded,
    isLoading: modelsLoading,
    error: modelError,
    detectFace,
    compareFaces,
    compareFacesMultiple,
    descriptorToArray,
    arrayToDescriptor,
  } = useFaceRecognition();

  const MATCH_THRESHOLD = 0.6; // Lower = stricter matching

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsStreaming(true);
        setStatus('idle');
        setMessage('Position your face in the frame');
      }
    } catch (err) {
      console.error('Camera access error:', err);
      setStatus('error');
      setMessage('Camera access denied. Please allow camera permissions.');
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  useEffect(() => {
    if (isModelLoaded) {
      startCamera();
    }
    return () => stopCamera();
  }, [isModelLoaded, startCamera, stopCamera]);

  const captureAndDetect = async () => {
    if (!videoRef.current || !canvasRef.current || !isModelLoaded) return;

    setStatus('detecting');
    setMessage('Detecting face...');

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    const imageData = canvas.toDataURL('image/jpeg');
    setCapturedImage(imageData);

    const descriptor = await detectFace(canvas);

    if (!descriptor) {
      setStatus('error');
      setMessage('No face detected. Please try again.');
      setCapturedImage(null);
      return;
    }

    if (mode === 'verify') {
      // Check against multiple descriptors first, then fall back to single
      if (existingDescriptors && existingDescriptors.length > 0) {
        const { distance } = compareFacesMultiple(descriptor, existingDescriptors);
        const isMatch = distance < MATCH_THRESHOLD;

        if (isMatch) {
          setStatus('success');
          setMessage(`Face verified! (Confidence: ${((1 - distance) * 100).toFixed(0)}%)`);
          stopCamera();
          onVerified?.(true, distance);
        } else {
          setStatus('error');
          setMessage('Face does not match. Please try again.');
          setCapturedImage(null);
          onVerified?.(false, distance);
        }
      } else if (existingDescriptor) {
        // Legacy single descriptor support
        const storedDescriptor = arrayToDescriptor(existingDescriptor);
        const distance = compareFaces(descriptor, storedDescriptor);
        const isMatch = distance < MATCH_THRESHOLD;

        if (isMatch) {
          setStatus('success');
          setMessage(`Face verified! (Confidence: ${((1 - distance) * 100).toFixed(0)}%)`);
          stopCamera();
          onVerified?.(true, distance);
        } else {
          setStatus('error');
          setMessage('Face does not match. Please try again.');
          setCapturedImage(null);
          onVerified?.(false, distance);
        }
      } else {
        setStatus('error');
        setMessage('No face data on record for verification.');
        setCapturedImage(null);
        onVerified?.(false, 1);
      }
    } else {
      // Registration mode
      setStatus('success');
      setMessage('Face captured successfully!');
      stopCamera();
      onCapture(descriptorToArray(descriptor));
    }
  };

  const handleRetry = () => {
    setCapturedImage(null);
    setStatus('idle');
    setMessage('Position your face in the frame');
    startCamera();
  };

  if (modelsLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading facial recognition models...</p>
      </div>
    );
  }

  if (modelError) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-4">
        <AlertCircle className="w-8 h-8 text-destructive" />
        <p className="text-sm text-destructive text-center">{modelError}</p>
        <Button onClick={() => window.location.reload()}>Reload Page</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center space-y-4">
      {/* Camera/Captured Image Display */}
      <div className="relative w-full max-w-sm aspect-[4/3] bg-muted rounded-lg overflow-hidden">
        {capturedImage ? (
          <img
            src={capturedImage}
            alt="Captured face"
            className="w-full h-full object-cover"
          />
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover mirror"
            style={{ transform: 'scaleX(-1)' }}
          />
        )}

        {/* Overlay frame guide */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            className={`w-48 h-56 border-2 rounded-full transition-colors ${
              status === 'success'
                ? 'border-green-500'
                : status === 'error'
                ? 'border-destructive'
                : 'border-primary/50'
            }`}
          />
        </div>

        {/* Status indicator */}
        {status === 'detecting' && (
          <div className="absolute inset-0 bg-background/50 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}
      </div>

      {/* Hidden canvas for capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Status message */}
      <div
        className={`flex items-center gap-2 text-sm ${
          status === 'success'
            ? 'text-green-600'
            : status === 'error'
            ? 'text-destructive'
            : 'text-muted-foreground'
        }`}
      >
        {status === 'success' && <Check className="w-4 h-4" />}
        {status === 'error' && <AlertCircle className="w-4 h-4" />}
        <span>{message}</span>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        {status === 'success' ? (
          <>
            <Button variant="outline" onClick={handleRetry}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Retake
            </Button>
            {mode === 'register' && (
              <Button onClick={() => onCapture}>
                <Check className="w-4 h-4 mr-2" />
                Confirm
              </Button>
            )}
          </>
        ) : status === 'error' ? (
          <Button onClick={handleRetry}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        ) : (
          <Button
            onClick={captureAndDetect}
            disabled={!isStreaming || status === 'detecting'}
          >
            <Camera className="w-4 h-4 mr-2" />
            {mode === 'verify' ? 'Verify Face' : 'Capture Face'}
          </Button>
        )}

        {onCancel && (
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
};
