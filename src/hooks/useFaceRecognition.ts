import { useEffect, useState, useCallback, useRef } from 'react';
import * as faceapi from 'face-api.js';

const MODEL_URL = '/models';

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
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);
        setState({ isModelLoaded: true, isLoading: false, error: null });
      } catch (err) {
        console.error('Error loading face-api models:', err);
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
    descriptorToArray,
    arrayToDescriptor,
  };
};
