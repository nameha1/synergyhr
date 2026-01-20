import { useEffect, useState, useCallback, useRef } from 'react';
import * as faceapi from 'face-api.js';

// Use absolute path for production, relative for dev
const getModelUrl = () => {
  if (import.meta.env.DEV) {
    return '/models';
  }
  return `${window.location.protocol}//${window.location.host}/models`;
};

const MODEL_URL = getModelUrl();

export interface FaceRecognitionState {
  isModelLoaded: boolean;
  isLoading: boolean;
  error: string | null;
}

export const useFaceRecognition = () => {
  const [state, setState] = useState<FaceRecognitionState>({
    isModelLoaded: false,
    isLoading: true,
    error: null,
  });
  const loadingRef = useRef(false);

  useEffect(() => {
    const loadModels = async () => {
      if (loadingRef.current || state.isModelLoaded) return;
      loadingRef.current = true;

      try {
        console.log('[useFaceRecognition] Loading models from:', MODEL_URL);
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);
        console.log('[useFaceRecognition] Models loaded successfully');
        setState({ isModelLoaded: true, isLoading: false, error: null });
      } catch (err) {
        console.error('[useFaceRecognition] Error loading face-api models:', err);
        console.error('[useFaceRecognition] Model URL was:', MODEL_URL);
        setState({
          isModelLoaded: false,
          isLoading: false,
          error: 'Failed to load facial recognition models. Please refresh.',
        });
      }
    };

    loadModels();
  }, [state.isModelLoaded]);

  const detectFace = useCallback(
    async (
      videoOrImage: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement
    ): Promise<Float32Array | null> => {
      if (!state.isModelLoaded) return null;

      try {
        const detection = await faceapi
          .detectSingleFace(videoOrImage)
          .withFaceLandmarks()
          .withFaceDescriptor();

        if (!detection) return null;
        return detection.descriptor;
      } catch (err) {
        console.error('Face detection error:', err);
        return null;
      }
    },
    [state.isModelLoaded]
  );

  const compareFaces = useCallback(
    (descriptor1: Float32Array, descriptor2: Float32Array): number => {
      return faceapi.euclideanDistance(descriptor1, descriptor2);
    },
    []
  );

  // Compare against multiple stored descriptors, return best match
  const compareFacesMultiple = useCallback(
    (descriptor: Float32Array, storedDescriptors: number[][]): { distance: number; bestIndex: number } => {
      let bestDistance = Infinity;
      let bestIndex = -1;

      for (let i = 0; i < storedDescriptors.length; i++) {
        const storedDescriptor = new Float32Array(storedDescriptors[i]);
        const distance = faceapi.euclideanDistance(descriptor, storedDescriptor);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestIndex = i;
        }
      }

      return { distance: bestDistance, bestIndex };
    },
    []
  );

  const descriptorToArray = useCallback(
    (descriptor: Float32Array): number[] => Array.from(descriptor),
    []
  );

  const arrayToDescriptor = useCallback(
    (arr: number[]): Float32Array => new Float32Array(arr),
    []
  );

  return {
    ...state,
    detectFace,
    compareFaces,
    compareFacesMultiple,
    descriptorToArray,
    arrayToDescriptor,
  };
};
