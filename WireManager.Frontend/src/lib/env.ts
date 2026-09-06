/**
 * Builds the backend API base URL from the API_BASE_URL environment variable.
 */
export function getApiBaseUrl(): string {
  const baseUrl = process.env.API_BASE_URL || 'https://localhost:7254';
  return baseUrl.replace(/\/+$/, ''); // strip trailing slashes
}
