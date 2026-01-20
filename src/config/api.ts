// API Configuration
// In Next.js, API routes are on the same domain, so we just use relative URLs
export const API_BASE_URL = '';

export const getApiUrl = (path: string) => {
  return `${API_BASE_URL}${path}`;
};
