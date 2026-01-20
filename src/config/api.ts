// API Configuration
export const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export const getApiUrl = (path: string) => {
  return `${API_BASE_URL}${path}`;
};
