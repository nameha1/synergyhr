import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, RefreshCw, Check, AlertCircle, Loader2, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';
import { useFaceRecognition } from '@/hooks/useFaceRecognition';
import { Progress } from '@/components/ui/progress';

interface CapturedAngle {
  image: string;
  descriptor: number[];
  label: string;
}

const CAPTURE_ANGLES = [
  { id: 'front', label: 'Front View', instruction: 'Look directly at the camera' },
  { id: 'left', label: 'Left Side', instruction: 'Turn your head slightly to the left' },
  { id: 'right', label: 'Right Side', instruction: 'Turn your head slightly to the right' },
  { id: 'up', label: 'Looking Up', instruction: 'Tilt your head slightly upward' },
  { id: 'down', label: 'Looking Down', instruction: 'Tilt your head slightly downward' },
];

interface MultiFaceCaptureProps {
  onComplete: (descriptors: number[][]) => void;
  onCancel?: () => void;
  minCaptures?: number;
  existingDescriptors?: number[][] | null;
}

export const MultiFaceCapture: React.FC<MultiFaceCaptureProps> = ({
  onComplete,
  onCancel,
  minCaptures = 3,
  existingDescriptors,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [isStreaming, setIsStreaming] = useState(false);
  const [captures, setCaptures] = useState<CapturedAngle[]>([]);
  const [currentAngleIndex, setCurrentAngleIndex] = useState(0);
  const [status, setStatus] = useState<'idle' | 'detecting' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  const {
    isModelLoaded,
    isLoading: modelsLoading,
    error: modelError,
    detectFace,
    descriptorToArray,
  } = useFaceRecognition();

  const currentAngle = CAPTURE_ANGLES[currentAngleIndex];
  const progress = (captures.length / CAPTURE_ANGLES.length) * 100;

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
        setMessage(currentAngle?.instruction || 'Position your face in the frame');
      }
    } catch (err) {
      console.error('Camera access error:', err);
      setStatus('error');
      setMessage('Camera access denied. Please allow camera permissions.');
    }
  }, [currentAngle]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  useEffect(() => {
    if (isModelLoaded && previewIndex === null) {
      startCamera();
    }
    return () => stopCamera();
  }, [isModelLoaded, startCamera, stopCamera, previewIndex]);

  useEffect(() => {
    if (currentAngle) {
      setMessage(currentAngle.instruction);
    }
  }, [currentAngle]);

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
    const descriptor = await detectFace(canvas);

    if (!descriptor) {
      setStatus('error');
      setMessage('No face detected. Please try again.');
      return;
    }

    const newCapture: CapturedAngle = {
      image: imageData,
      descriptor: descriptorToArray(descriptor),
      label: currentAngle.label,
    };

    setCaptures(prev => [...prev, newCapture]);
    setStatus('success');
    setMessage(`${currentAngle.label} captured!`);

    // Move to next angle or finish
    if (currentAngleIndex < CAPTURE_ANGLES.length - 1) {
      setTimeout(() => {
        setCurrentAngleIndex(prev => prev + 1);
        setStatus('idle');
      }, 1000);
    }
  };

  const handleRemoveCapture = (index: number) => {
    setCaptures(prev => prev.filter((_, i) => i !== index));
    // Find the angle that was removed and set it as current
    const removedLabel = captures[index]?.label;
    const angleIndex = CAPTURE_ANGLES.findIndex(a => a.label === removedLabel);
    if (angleIndex !== -1 && angleIndex < currentAngleIndex) {
      setCurrentAngleIndex(angleIndex);
    }
    setPreviewIndex(null);
    setStatus('idle');
  };

  const handleComplete = () => {
    const descriptors = captures.map(c => c.descriptor);
    stopCamera();
    onComplete(descriptors);
  };

  const handleReset = () => {
    setCaptures([]);
    setCurrentAngleIndex(0);
    setPreviewIndex(null);
    setStatus('idle');
    startCamera();
  };

  const canComplete = captures.length >= minCaptures;
  const allCaptured = captures.length === CAPTURE_ANGLES.length;

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
      {/* Progress indicator */}
      <div className="w-full space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Capture Progress</span>
          <span className="font-medium">{captures.length} / {CAPTURE_ANGLES.length}</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Current angle instruction */}
      {!allCaptured && (
        <div className="text-center p-3 rounded-lg bg-primary/5 border border-primary/20 w-full">
          <p className="text-sm font-medium text-primary">{currentAngle?.label}</p>
          <p className="text-xs text-muted-foreground mt-1">{currentAngle?.instruction}</p>
        </div>
      )}

      {/* Camera/Captured Image Display */}
      <div className="relative w-full max-w-sm aspect-[4/3] bg-muted rounded-lg overflow-hidden">
        {previewIndex !== null ? (
          <img
            src={captures[previewIndex]?.image}
            alt={captures[previewIndex]?.label}
            className="w-full h-full object-cover"
          />
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
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

      {/* Captured thumbnails */}
      {captures.length > 0 && (
        <div className="w-full">
          <p className="text-xs text-muted-foreground mb-2">Captured angles (click to preview)</p>
          <div className="flex gap-2 flex-wrap">
            {captures.map((capture, index) => (
              <div
                key={index}
                className={`relative group cursor-pointer rounded-md overflow-hidden border-2 transition-colors ${
                  previewIndex === index ? 'border-primary' : 'border-transparent'
                }`}
                onClick={() => setPreviewIndex(previewIndex === index ? null : index)}
              >
                <img
                  src={capture.image}
                  alt={capture.label}
                  className="w-14 h-14 object-cover"
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveCapture(index);
                  }}
                  className="absolute inset-0 bg-destructive/80 text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
                <div className="absolute bottom-0 left-0 right-0 bg-background/80 text-[10px] text-center truncate px-1">
                  {capture.label.split(' ')[0]}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 flex-wrap justify-center">
        {previewIndex !== null ? (
          <Button variant="outline" onClick={() => setPreviewIndex(null)}>
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back to Camera
          </Button>
        ) : allCaptured ? (
          <Button variant="outline" onClick={handleReset}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Start Over
          </Button>
        ) : (
          <Button
            onClick={captureAndDetect}
            disabled={!isStreaming || status === 'detecting'}
          >
            <Camera className="w-4 h-4 mr-2" />
            Capture {currentAngle?.label}
          </Button>
        )}

        {canComplete && (
          <Button onClick={handleComplete} className="bg-green-600 hover:bg-green-700">
            <Check className="w-4 h-4 mr-2" />
            Complete ({captures.length} angles)
          </Button>
        )}

        {onCancel && (
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>

      {/* Min captures hint */}
      {!canComplete && (
        <p className="text-xs text-muted-foreground text-center">
          Capture at least {minCaptures} angles to complete. More angles = better accuracy.
        </p>
      )}
    </div>
  );
};
