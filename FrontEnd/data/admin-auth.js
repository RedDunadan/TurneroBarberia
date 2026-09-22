const ADMIN_SESSION_KEY = "norte-barber-admin-session";
const ADMIN_CREDENTIALS = {
	username: "admin",
	password: "admin"
};

export function isAdminAuthenticated() {
	return sessionStorage.getItem(ADMIN_SESSION_KEY) === "authenticated";
}

export function loginAdmin(username, password) {
	const isValid = username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password;
	if (isValid) {
		sessionStorage.setItem(ADMIN_SESSION_KEY, "authenticated");
	}
	return isValid;
}

export function logoutAdmin() {
	sessionStorage.removeItem(ADMIN_SESSION_KEY);
}
