import { API_BASE_URL } from "./api-config.js";

const ADMIN_API_BASE_URL = `${API_BASE_URL}/admin`;

async function parseResponse(response) {
	if (response.status === 204) {
		return null;
	}
	const data = await response.json();
	if (!response.ok) {
		throw new Error(data.error || "No se pudo completar la operación.");
	}
	return data;
}

export async function getBarbers() {
	try {
		const response = await fetch(`${ADMIN_API_BASE_URL}/barbers`, { credentials: "include" });
		return parseResponse(response);
	} catch {
		throw new Error("No se pudo conectar con la API. Iniciá el backend con: cd BackEnd && npm start");
	}
}

export async function addBarber(barber) {
	const response = await fetch(`${ADMIN_API_BASE_URL}/barbers`, {
		method: "POST",
		credentials: "include",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(barber)
	});
	return parseResponse(response);
}

export async function removeBarber(id) {
	const response = await fetch(`${ADMIN_API_BASE_URL}/barbers/${id}`, { method: "DELETE", credentials: "include" });
	return parseResponse(response);
}