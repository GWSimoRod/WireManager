/**
 * Builds the backend API base URL from the API_BASE_URL environment variable.
 */
export function getApiBaseUrl(): string {
  const baseUrl = process.env.API_BASE_URL || 'https://localhost:7254';
  return baseUrl.replace(/\/+$/, ''); // strip trailing slashes
}

/**
 * Public backend URL for browser redirects (e.g. SSO login).
 * Defaults to API_BASE_URL if BACKEND_URL is not set.
 */
export function getBackendUrl(): string {
  const url = process.env.BACKEND_URL || getApiBaseUrl();
  return url.replace(/\/+$/, '');
}
