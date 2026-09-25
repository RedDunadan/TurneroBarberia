const API_BASE_URL = "http://localhost:3000/api";

export async function isAdminAuthenticated() {
	try {
		const response = await fetch(`${API_BASE_URL}/auth/me`, { credentials: "include" });
		return response.ok;
	} catch {
		return false;
	}
}

export async function loginAdmin(username, password) {
	try {
		const response = await fetch(`${API_BASE_URL}/auth/login`, {
			method: "POST",
			credentials: "include",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ username, password })
		});
		return response.ok;
	} catch {
		return false;
	}
}

export async function logoutAdmin() {
	await fetch(`${API_BASE_URL}/auth/logout`, {
		method: "POST",
		credentials: "include"
	});
}
