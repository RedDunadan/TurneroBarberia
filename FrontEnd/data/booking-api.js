import { API_BASE_URL } from "./api-config.js";

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

export async function getPendingBookings() {
	try {
		const response = await fetch(`${API_BASE_URL}/admin/bookings/pending`, { credentials: "include" });
		return parseResponse(response);
	} catch {
		throw new Error("No se pudo conectar con la API. Iniciá el backend con: cd BackEnd && npm start");
	}
}

export async function deleteAdminBooking(id) {
	const response = await fetch(`${API_BASE_URL}/admin/bookings/${id}`, {
		method: "DELETE",
		credentials: "include"
	});
	return parseResponse(response);
}

export async function createBooking(booking) {
	const response = await fetch(`${API_BASE_URL}/bookings`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(booking)
	});
	return parseResponse(response);
}

export async function getCustomerBookings(token) {
	const params = new URLSearchParams({ token });
	const response = await fetch(`${API_BASE_URL}/bookings/customer?${params}`);
	return parseResponse(response);
}

export async function cancelBooking(id, token) {
	const response = await fetch(`${API_BASE_URL}/bookings/${id}/cancel`, {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ token })
	});
	return parseResponse(response);
}

export async function getAvailableBarbers() {
	const response = await fetch(`${API_BASE_URL}/barbers`);
	return response.ok ? response.json() : [];
}
