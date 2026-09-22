const API_BASE_URL = "http://localhost:3000/api";

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
	const response = await fetch(`${API_BASE_URL}/barbers`);
	return parseResponse(response);
}

export async function addBarber(barber) {
	const response = await fetch(`${API_BASE_URL}/barbers`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(barber)
	});
	return parseResponse(response);
}

export async function removeBarber(id) {
	const response = await fetch(`${API_BASE_URL}/barbers/${id}`, { method: "DELETE" });
	return parseResponse(response);
}