const configuredApiBaseUrl = document.querySelector('meta[name="api-base-url"]')?.content;
const defaultApiBaseUrl = "http://localhost:3000/api";
const apiBaseUrl = configuredApiBaseUrl && !configuredApiBaseUrl.startsWith("__")
	? configuredApiBaseUrl
	: defaultApiBaseUrl;

export const API_BASE_URL = apiBaseUrl.replace(/\/+$/, "");