import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface OfficeLocation {
  latitude: number;
  longitude: number;
  radius_meters: number;
  enabled: boolean;
}

interface IpinfoLiteResp {
  ip?: string;
  asn?: string;
  as_name?: string;
  country?: string;
  country_code?: string;
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

  const normalizeStringList = (value: unknown): string[] => {
    if (Array.isArray(value)) {
      return value.map((item) => String(item).trim()).filter(Boolean);
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return [];
      if (trimmed.startsWith('[')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) {
            return parsed.map((item) => String(item).trim()).filter(Boolean);
          }
        } catch {
          return [trimmed];
        }
      }
      return [trimmed];
    }
    return [];
  };

  const normalizeAsnList = (value: unknown): number[] => {
    return normalizeStringList(value)
      .map((item) => item.replace(/[^0-9]/g, ''))
      .map((item) => Number(item))
      .filter((item) => Number.isFinite(item));
  };

  const ipv4ToInt = (ip: string): number | null => {
    const parts = ip.split('.').map((part) => Number(part));
    if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
      return null;
    }
    return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
  };

  const cidrContainsIPv4 = (cidr: string, ip: string): boolean => {
    const [netStr, bitsStr] = cidr.split('/');
    const bits = Number(bitsStr);
    if (!Number.isInteger(bits) || bits < 0 || bits > 32) return false;

    const net = ipv4ToInt(netStr);
    const addr = ipv4ToInt(ip);
    if (net === null || addr === null) return false;

    const mask = bits === 0 ? 0 : (~((1 << (32 - bits)) - 1) >>> 0) >>> 0;
    return (net & mask) === (addr & mask);
  };

  const getIpInfo = useCallback(async (ip: string): Promise<IpinfoLiteResp | null> => {
    const token = process.env.NEXT_PUBLIC_IPINFO_TOKEN as string | undefined;
    if (!token) return null;
    try {
      const response = await fetch(
        `https://api.ipinfo.io/lite/${encodeURIComponent(ip)}?token=${encodeURIComponent(token)}`,
        { cache: 'no-store' }
      );
      if (!response.ok) return null;
      const data = (await response.json()) as IpinfoLiteResp;
      return data;
    } catch (err) {
      console.error('Failed to get ASN:', err);
      return null;
    }
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
      const allowedAsnsData = settings?.find((s) => s.setting_key === 'allowed_asns');
      const allowedCidrsData = settings?.find((s) => s.setting_key === 'allowed_cidrs');
      const officeLocationData = settings?.find((s) => s.setting_key === 'office_location');

      const allowedIps = normalizeStringList(allowedIpsData?.setting_value);
      const allowedAsns = normalizeAsnList(allowedAsnsData?.setting_value);
      const allowedCidrs = normalizeStringList(allowedCidrsData?.setting_value);
      
      // If no IP settings exist at all, default to allowing all (wildcard behavior)
      const hasNoIpSettings = !allowedIpsData || allowedIps.length === 0;
      const allowWildcard = allowedIps.includes('*') || hasNoIpSettings;
      const officeLocation: OfficeLocation = (officeLocationData?.setting_value as unknown as OfficeLocation) || {
        latitude: 0,
        longitude: 0,
        radius_meters: 100,
        enabled: false,
      };

      // Check IP
      const currentIp = await getPublicIp();
      let currentAsn: number | null = null;
      const hasIpRestriction = allowedIps.length > 0 && !allowWildcard;
      const hasCidrRestriction = allowedCidrs.length > 0;
      const hasAsnRestriction = allowedAsns.length > 0;

      const ipMatch = currentIp ? allowedIps.includes(currentIp) : false;
      const cidrMatch = currentIp
        ? allowedCidrs.some((cidr) => cidrContainsIPv4(cidr, currentIp))
        : false;

      if (currentIp && hasAsnRestriction) {
        const info = await getIpInfo(currentIp);
        const asnStr = (info?.asn ?? '').replace(/^AS/i, '');
        const parsedAsn = Number(asnStr);
        if (Number.isFinite(parsedAsn)) {
          currentAsn = parsedAsn;
        }
      }

      const asnMatch = currentAsn !== null ? allowedAsns.includes(currentAsn) : false;

      // Determine network access
      // If wildcard (*) is in allowed_ips, always allow network access
      // Otherwise, check if any of the specific restrictions match
      let networkAllowed = true;
      
      console.log('[LocationVerification] Settings:', {
        allowedIps,
        allowedAsns,
        allowedCidrs,
        allowWildcard,
        hasNoIpSettings,
        currentIp,
        currentAsn,
        hasIpRestriction,
        hasCidrRestriction,
        hasAsnRestriction,
      });
      
      if (allowWildcard) {
        // Wildcard means allow all IPs - skip all network checks
        networkAllowed = true;
        console.log('[LocationVerification] Wildcard enabled - allowing all');
      } else if (hasIpRestriction || hasCidrRestriction || hasAsnRestriction) {
        // Only check restrictions if there are any configured (and no wildcard)
        networkAllowed =
          (hasIpRestriction && ipMatch) ||
          (hasCidrRestriction && cidrMatch) ||
          (hasAsnRestriction && asnMatch);
        console.log('[LocationVerification] Restriction check:', { ipMatch, cidrMatch, asnMatch, networkAllowed });
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
        } catch (geoError: unknown) {
          locationAllowed = false;
          setState((prev) => ({
            ...prev,
            error: 'Location access denied. Please enable location permissions.',
          }));
        }
      }

      const success = networkAllowed && locationAllowed;

      setState({
        isVerifying: false,
        ipAllowed: networkAllowed,
        locationAllowed,
        currentIp,
        currentLocation,
        error: success
          ? null
          : !networkAllowed
          ? 'You are not connected to the office network.'
          : 'You are not within the office premises.',
      });

      return { success, ipAllowed: networkAllowed, locationAllowed };
    } catch (err: unknown) {
      console.error('Location verification error:', err);
      const message = err instanceof Error ? err.message : 'Unknown error';
      setState({
        isVerifying: false,
        ipAllowed: null,
        locationAllowed: null,
        currentIp: null,
        currentLocation: null,
        error: 'Failed to verify location. Please try again.',
      });
      return { success: false, ipAllowed: false, locationAllowed: false, error: message };
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
