const API_BASE_URL = "http://localhost:3000/api";

export async function createBooking(booking) {
	const response = await fetch(`${API_BASE_URL}/bookings`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(booking)
	});
	const data = await response.json();

	if (!response.ok) {
		throw new Error(data.error || "No se pudo registrar el turno.");
	}

	return data;
}

export async function getAvailableBarbers() {
	const response = await fetch(`${API_BASE_URL}/barbers`);
	return response.ok ? response.json() : [];
}
