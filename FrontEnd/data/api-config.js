const configuredApiBaseUrl = document.querySelector('meta[name="api-base-url"]')?.content;

export const API_BASE_URL = (configuredApiBaseUrl || "http://localhost:3000/api").replace(/\/+$/, "");