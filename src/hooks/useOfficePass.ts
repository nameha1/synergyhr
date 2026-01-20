import { useCallback, useRef, useState } from 'react';
import { getApiUrl } from '@/config/api';

type OfficePassStatus = 'idle' | 'checking' | 'allowed' | 'blocked';

interface OfficePassState {
  status: OfficePassStatus;
  pass: string | null;
}

const PASS_TTL_MS = 110_000;

export const useOfficePass = () => {
  const [state, setState] = useState<OfficePassState>({
    status: 'idle',
    pass: null,
  });
  const passRef = useRef<{ value: string; expiresAt: number } | null>(null);

  const checkOfficePass = useCallback(async () => {
    setState((prev) => ({ ...prev, status: 'checking' }));
    try {
      const response = await fetch(getApiUrl('/api/attendance/check'));
      if (!response.ok) {
        throw new Error('Office network required');
      }
      const data = (await response.json()) as { pass?: string };
      const pass = data.pass ?? null;
      if (!pass) {
        throw new Error('Office pass missing');
      }
      passRef.current = { value: pass, expiresAt: Date.now() + PASS_TTL_MS };
      setState({ status: 'allowed', pass });
      return pass;
    } catch (error) {
      passRef.current = null;
      setState({ status: 'blocked', pass: null });
      return null;
    }
  }, []);

  const getValidPass = useCallback(async () => {
    if (passRef.current && passRef.current.expiresAt > Date.now()) {
      return passRef.current.value;
    }
    return checkOfficePass();
  }, [checkOfficePass]);

  const resetOfficePass = useCallback(() => {
    passRef.current = null;
    setState({ status: 'idle', pass: null });
  }, []);

  return {
    status: state.status,
    pass: state.pass,
    checkOfficePass,
    getValidPass,
    resetOfficePass,
  };
};
