import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface OfficeLocation {
  latitude: number;
  longitude: number;
  radius_meters: number;
  enabled: boolean;
}

interface LocationVerificationState {
  isVerifying: boolean;
  ipAllowed: boolean | null;
  locationAllowed: boolean | null;
  currentIp: string | null;
  currentLocation: { latitude: number; longitude: number } | null;
  error: string | null;
}

export const useLocationVerification = () => {
  const [state, setState] = useState<LocationVerificationState>({
    isVerifying: false,
    ipAllowed: null,
    locationAllowed: null,
    currentIp: null,
    currentLocation: null,
    error: null,
  });

  const getPublicIp = useCallback(async (): Promise<string | null> => {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch (err) {
      console.error('Failed to get IP:', err);
      return null;
    }
  }, []);

  const getCurrentLocation = useCallback((): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported'));
        return;
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      });
    });
  }, []);

  const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  const verifyLocation = useCallback(async (): Promise<{
    success: boolean;
    ipAllowed: boolean;
    locationAllowed: boolean;
    error?: string;
  }> => {
    setState((prev) => ({ ...prev, isVerifying: true, error: null }));

    try {
      // Fetch office settings
      const { data: settings, error: settingsError } = await supabase
        .from('office_settings')
        .select('setting_key, setting_value');

      if (settingsError) throw settingsError;

      const allowedIpsData = settings?.find((s) => s.setting_key === 'allowed_ips');
      const officeLocationData = settings?.find((s) => s.setting_key === 'office_location');

      const allowedIps: string[] = (allowedIpsData?.setting_value as unknown as string[]) || ['*'];
      const officeLocation: OfficeLocation = (officeLocationData?.setting_value as unknown as OfficeLocation) || {
        latitude: 0,
        longitude: 0,
        radius_meters: 100,
        enabled: false,
      };

      // Check IP
      const currentIp = await getPublicIp();
      let ipAllowed = true;

      if (currentIp && !allowedIps.includes('*')) {
        ipAllowed = allowedIps.includes(currentIp);
      }

      // Check geo-location
      let locationAllowed = true;
      let currentLocation: { latitude: number; longitude: number } | null = null;

      if (officeLocation.enabled) {
        try {
          const position = await getCurrentLocation();
          currentLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };

          const distance = calculateDistance(
            currentLocation.latitude,
            currentLocation.longitude,
            officeLocation.latitude,
            officeLocation.longitude
          );

          locationAllowed = distance <= officeLocation.radius_meters;
        } catch (geoError: any) {
          locationAllowed = false;
          setState((prev) => ({
            ...prev,
            error: 'Location access denied. Please enable location permissions.',
          }));
        }
      }

      const success = ipAllowed && locationAllowed;

      setState({
        isVerifying: false,
        ipAllowed,
        locationAllowed,
        currentIp,
        currentLocation,
        error: success
          ? null
          : !ipAllowed
          ? 'You are not connected to the office network.'
          : 'You are not within the office premises.',
      });

      return { success, ipAllowed, locationAllowed };
    } catch (err: any) {
      console.error('Location verification error:', err);
      setState({
        isVerifying: false,
        ipAllowed: null,
        locationAllowed: null,
        currentIp: null,
        currentLocation: null,
        error: 'Failed to verify location. Please try again.',
      });
      return { success: false, ipAllowed: false, locationAllowed: false, error: err.message };
    }
  }, [getPublicIp, getCurrentLocation]);

  const reset = useCallback(() => {
    setState({
      isVerifying: false,
      ipAllowed: null,
      locationAllowed: null,
      currentIp: null,
      currentLocation: null,
      error: null,
    });
  }, []);

  return {
    ...state,
    verifyLocation,
    reset,
  };
};
