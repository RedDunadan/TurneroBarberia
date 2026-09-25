import express from "express";
import cors from "cors";
import Database from "better-sqlite3";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const databasePath = process.env.DATABASE_PATH || path.join(__dirname, "turnero.db");
const database = new Database(databasePath);
const app = express();
const port = process.env.PORT || 3000;
const frontendOrigin = process.env.FRONTEND_ORIGIN || "http://localhost:5500";
const adminUsername = process.env.ADMIN_USERNAME?.trim();
const adminPassword = process.env.ADMIN_PASSWORD;
const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;
const sessions = new Map();
const rateLimitBuckets = new Map();
const sessionDuration = 8 * 60 * 60 * 1000;
const sessionCookieName = "admin_session";
const dayNames = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

if (!adminUsername || (!adminPassword && !adminPasswordHash)) {
	throw new Error("ADMIN_USERNAME y ADMIN_PASSWORD o ADMIN_PASSWORD_HASH son obligatorios.");
}

app.use(cors({ origin: frontendOrigin, credentials: true }));
app.use(express.json({ limit: "16kb" }));

function rateLimit({ limit, windowMs, key: bucketKey }) {
	return (request, response, next) => {
		const key = `${request.socket.remoteAddress || "unknown"}:${bucketKey || request.path}`;
		const now = Date.now();
		const bucket = rateLimitBuckets.get(key);
		if (!bucket || bucket.expiresAt <= now) {
			rateLimitBuckets.set(key, { count: 1, expiresAt: now + windowMs });
			return next();
		}
		if (bucket.count >= limit) {
			response.setHeader("Retry-After", Math.ceil((bucket.expiresAt - now) / 1000));
			return response.status(429).json({ error: "Demasiados intentos. Probá nuevamente más tarde." });
		}
		bucket.count += 1;
		next();
	};
}

const rateLimitCleanup = setInterval(() => {
	const now = Date.now();
	for (const [key, bucket] of rateLimitBuckets) {
		if (bucket.expiresAt <= now) {
			rateLimitBuckets.delete(key);
		}
	}
}, 60 * 1000);
rateLimitCleanup.unref();

function requireSameOrigin(request, response, next) {
	const origin = request.headers.origin;
	if (origin && origin !== frontendOrigin) {
		return response.status(403).json({ error: "Origen de solicitud no permitido." });
	}
	next();
}

function parseCookies(request) {
	try {
		return Object.fromEntries((request.headers.cookie || "").split(";").filter(Boolean).map((cookie) => {
			const separatorIndex = cookie.indexOf("=");
			return [cookie.slice(0, separatorIndex).trim(), decodeURIComponent(cookie.slice(separatorIndex + 1).trim())];
		}));
	} catch {
		return {};
	}
}

function passwordMatches(password) {
	const configuredHash = adminPasswordHash;
	if (!configuredHash) {
		return password === adminPassword;
	}

	const [salt, expectedHash] = configuredHash.split(":");
	if (!salt || !expectedHash) {
		return false;
	}

	const actualHash = scryptSync(password, salt, 64).toString("hex");
	const expectedBuffer = Buffer.from(expectedHash, "hex");
	const actualBuffer = Buffer.from(actualHash, "hex");
	return expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer);
}

function setSessionCookie(response, token, maxAge = sessionDuration / 1000) {
	const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
	response.setHeader("Set-Cookie", `${sessionCookieName}=${encodeURIComponent(token)}; HttpOnly; Path=/; Max-Age=${maxAge}; SameSite=Strict${secure}`);
}

function requireAdmin(request, response, next) {
	const token = parseCookies(request)[sessionCookieName];
	const session = token ? sessions.get(token) : null;
	if (!session || session.expiresAt <= Date.now()) {
		if (token) {
			sessions.delete(token);
		}
		return response.status(401).json({ error: "Se requiere una sesión de administrador." });
	}

	request.adminSession = session;
	next();
}

app.post("/api/auth/login", requireSameOrigin, rateLimit({ limit: 5, windowMs: 15 * 60 * 1000 }), (request, response) => {
	const { username, password } = request.body;
	if (username !== adminUsername || typeof password !== "string" || !passwordMatches(password)) {
		return response.status(401).json({ error: "Usuario o contraseña incorrectos." });
	}

	const token = randomBytes(32).toString("hex");
	sessions.set(token, { username, expiresAt: Date.now() + sessionDuration });
	setSessionCookie(response, token);
	return response.json({ username });
});

app.post("/api/auth/logout", requireSameOrigin, (request, response) => {
	const token = parseCookies(request)[sessionCookieName];
	if (token) {
		sessions.delete(token);
	}
	setSessionCookie(response, "", 0);
	return response.status(204).send();
});

app.get("/api/auth/me", requireAdmin, (_request, response) => {
	response.json({ authenticated: true });
});

database.pragma("journal_mode = WAL");
database.pragma("foreign_keys = ON");
database.exec(`
	CREATE TABLE IF NOT EXISTS barbers (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL,
		email TEXT NOT NULL UNIQUE,
		phone TEXT NOT NULL,
		location TEXT NOT NULL CHECK (location IN ('palermo', 'belgrano')),
		days TEXT NOT NULL,
		start_time TEXT NOT NULL,
		end_time TEXT NOT NULL,
		created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS bookings (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		customer_name TEXT NOT NULL,
		customer_email TEXT NOT NULL,
		customer_phone TEXT NOT NULL,
		service TEXT NOT NULL CHECK (service IN ('corte', 'corte-barba', 'barba')),
		booking_date TEXT NOT NULL,
		location TEXT NOT NULL CHECK (location IN ('palermo', 'belgrano')),
		barber_id INTEGER REFERENCES barbers(id) ON DELETE SET NULL,
		cancellation_token TEXT UNIQUE,
		status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
		created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
	)
`);

const bookingColumns = database.prepare("PRAGMA table_info(bookings)").all();
if (!bookingColumns.some((column) => column.name === "barber_id")) {
	database.exec("ALTER TABLE bookings ADD COLUMN barber_id INTEGER REFERENCES barbers(id) ON DELETE SET NULL");
}
if (!bookingColumns.some((column) => column.name === "cancellation_token")) {
	database.exec("ALTER TABLE bookings ADD COLUMN cancellation_token TEXT");
}
database.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_cancellation_token ON bookings(cancellation_token) WHERE cancellation_token IS NOT NULL");

const listBarbers = database.prepare(`
	SELECT
		barbers.id,
		barbers.name,
		barbers.email,
		barbers.phone,
		barbers.location,
		barbers.days,
		barbers.start_time AS start,
		barbers.end_time AS end,
		COUNT(CASE WHEN bookings.status != 'cancelled' THEN bookings.id END) AS bookingCount
	FROM barbers
	LEFT JOIN bookings ON bookings.barber_id = barbers.id
	GROUP BY barbers.id
	ORDER BY barbers.name COLLATE NOCASE
`);

const insertBarber = database.prepare(`
	INSERT INTO barbers (name, email, phone, location, days, start_time, end_time)
	VALUES (@name, @email, @phone, @location, @days, @start, @end)
`);

const deleteBarber = database.prepare("DELETE FROM barbers WHERE id = ?");
const deleteBooking = database.prepare("DELETE FROM bookings WHERE id = ?");
const findBarber = database.prepare("SELECT id, location, days FROM barbers WHERE id = ?");
const listPendingBookings = database.prepare(`
	SELECT
		bookings.id,
		bookings.customer_name AS customerName,
		bookings.customer_email AS customerEmail,
		bookings.customer_phone AS customerPhone,
		bookings.service,
		bookings.booking_date AS date,
		bookings.location,
		bookings.status,
		barbers.name AS barberName
	FROM bookings
	LEFT JOIN barbers ON barbers.id = bookings.barber_id
	WHERE bookings.status = 'pending'
	ORDER BY bookings.booking_date ASC, bookings.id ASC
`);

const createBooking = database.prepare(`
	INSERT INTO bookings (
		customer_name,
		customer_email,
		customer_phone,
		service,
		booking_date,
		location,
		barber_id,
		cancellation_token
	) VALUES (@name, @email, @phone, @service, @date, @location, @barberId, @cancellationToken)
`);
const listCustomerBookings = database.prepare(`
	SELECT
		bookings.id,
		bookings.customer_name AS customerName,
		bookings.service,
		bookings.booking_date AS date,
		bookings.location,
		bookings.cancellation_token AS cancellationToken,
		barbers.name AS barberName
	FROM bookings
	LEFT JOIN barbers ON barbers.id = bookings.barber_id
	WHERE bookings.cancellation_token = ? AND bookings.status != 'cancelled'
	ORDER BY bookings.booking_date ASC, bookings.id ASC
`);
const cancelCustomerBooking = database.prepare(`
	UPDATE bookings
	SET status = 'cancelled'
	WHERE id = ? AND cancellation_token = ? AND status != 'cancelled'
`);

function isValidDate(value) {
	if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
		return false;
	}
	const parsed = new Date(`${value}T00:00:00Z`);
	return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function isValidTime(value) {
	return typeof value === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function isValidCancellationToken(value) {
	return typeof value === "string" && /^[a-f0-9]{48}$/.test(value);
}

app.get("/api/health", (_request, response) => {
	response.json({ status: "ok" });
});

app.get("/api/barbers", (_request, response) => {
	const barbers = listBarbers.all().map(({ id, name, location, days }) => ({ id, name, location, days: JSON.parse(days) }));
	response.json(barbers);
});

app.get("/api/admin/barbers", requireAdmin, (_request, response) => {
	const barbers = listBarbers.all().map((barber) => ({
		...barber,
		days: JSON.parse(barber.days),
		bookingCount: Number(barber.bookingCount)
	}));
	response.json(barbers);
});

app.post("/api/admin/barbers", requireSameOrigin, requireAdmin, (request, response) => {
	const { name, email, phone, location, days, start, end } = request.body;
	const normalizedName = typeof name === "string" ? name.trim() : "";
	const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
	const normalizedPhone = typeof phone === "string" ? phone.trim() : "";

	if (!normalizedName || normalizedName.length > 100) {
		return response.status(400).json({ error: "El nombre es obligatorio y debe tener hasta 100 caracteres." });
	}
	if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
		return response.status(400).json({ error: "Ingresá un email válido." });
	}
	if (!/^[-+()\s\d]{7,25}$/.test(normalizedPhone)) {
		return response.status(400).json({ error: "Ingresá un teléfono válido." });
	}
	if (!["palermo", "belgrano"].includes(location) || !Array.isArray(days) || !days.length || days.some((day) => !dayNames.includes(day)) || new Set(days).size !== days.length) {
		return response.status(400).json({ error: "El local y al menos un día son obligatorios." });
	}
	if (!isValidTime(start) || !isValidTime(end) || start >= end) {
		return response.status(400).json({ error: "El horario de cierre debe ser posterior al de inicio." });
	}

	try {
		const result = insertBarber.run({
			name: normalizedName,
			email: normalizedEmail,
			phone: normalizedPhone,
			location,
			days: JSON.stringify(days),
			start,
			end
		});
		return response.status(201).json({ id: result.lastInsertRowid, bookingCount: 0, message: "Barbero guardado correctamente." });
	} catch (error) {
		if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
			return response.status(409).json({ error: "Ya existe un barbero con ese email." });
		}
		console.error("Error al guardar el barbero:", error);
		return response.status(500).json({ error: "No se pudo guardar el barbero." });
	}
});

app.delete("/api/admin/barbers/:id", requireSameOrigin, requireAdmin, (request, response) => {
	const result = deleteBarber.run(request.params.id);
	if (!result.changes) {
		return response.status(404).json({ error: "Barbero no encontrado." });
	}
	return response.status(204).send();
});

app.get("/api/admin/bookings/pending", requireAdmin, (_request, response) => {
	response.json(listPendingBookings.all());
});

app.delete("/api/admin/bookings/:id", requireSameOrigin, requireAdmin, (request, response) => {
	const bookingId = Number(request.params.id);
	if (!Number.isInteger(bookingId) || bookingId < 1) {
		return response.status(400).json({ error: "El identificador del turno no es válido." });
	}

	const result = deleteBooking.run(bookingId);
	if (!result.changes) {
		return response.status(404).json({ error: "Turno no encontrado." });
	}
	return response.status(204).send();
});

app.post("/api/bookings", rateLimit({ limit: 10, windowMs: 15 * 60 * 1000 }), (request, response) => {
	const { name, email, phone, service, date, location, barberId } = request.body;
	const normalizedName = typeof name === "string" ? name.trim() : "";
	const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
	const normalizedPhone = typeof phone === "string" ? phone.trim() : "";

	if (!normalizedName || normalizedName.length > 100) {
		return response.status(400).json({ error: "El nombre es obligatorio y debe tener hasta 100 caracteres." });
	}
	if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
		return response.status(400).json({ error: "Ingresá un email válido." });
	}
	if (!/^[-+()\s\d]{7,25}$/.test(normalizedPhone)) {
		return response.status(400).json({ error: "Ingresá un teléfono válido." });
	}
	if (!["corte", "corte-barba", "barba"].includes(service)) {
		return response.status(400).json({ error: "El servicio seleccionado no es válido." });
	}
	if (!["palermo", "belgrano"].includes(location) || !isValidDate(date)) {
		return response.status(400).json({ error: "La fecha o el local no son válidos." });
	}
	if (date < new Date().toISOString().slice(0, 10)) {
		return response.status(400).json({ error: "La fecha del turno no puede ser anterior a hoy." });
	}
	if (barberId === undefined || barberId === null || !Number.isInteger(Number(barberId))) {
		return response.status(400).json({ error: "El barbero seleccionado no es válido." });
	}
	const selectedBarber = findBarber.get(Number(barberId));
	const selectedDay = dayNames[new Date(`${date}T12:00:00`).getDay()];
	if (!selectedBarber || selectedBarber.location !== location || !JSON.parse(selectedBarber.days).includes(selectedDay)) {
		return response.status(400).json({ error: "El barbero no está disponible para ese local y día." });
	}

	try {
		const cancellationToken = randomBytes(24).toString("hex");
		const result = createBooking.run({
			name: normalizedName,
			email: normalizedEmail,
			phone: normalizedPhone,
			service,
			date,
			location,
			barberId: Number(barberId),
			cancellationToken
		});
		return response.status(201).json({ id: result.lastInsertRowid, cancellationToken, message: "Turno registrado correctamente." });
	} catch (error) {
		console.error("Error al guardar el turno:", error);
		return response.status(500).json({ error: "No se pudo guardar el turno." });
	}
});

app.get("/api/bookings/customer", rateLimit({ limit: 10, windowMs: 15 * 60 * 1000 }), (request, response) => {
	const cancellationToken = typeof request.query.token === "string" ? request.query.token.trim().toLowerCase() : "";

	if (!isValidCancellationToken(cancellationToken)) {
		return response.status(400).json({ error: "Ingresá el código de cancelación de tu reserva." });
	}
	return response.json(listCustomerBookings.all(cancellationToken));
});

app.patch("/api/bookings/:id/cancel", rateLimit({ limit: 10, windowMs: 15 * 60 * 1000, key: "booking-cancel" }), (request, response) => {
	const cancellationToken = typeof request.body.token === "string" ? request.body.token.trim().toLowerCase() : "";
	const bookingId = Number(request.params.id);

	if (!Number.isInteger(bookingId) || !isValidCancellationToken(cancellationToken)) {
		return response.status(400).json({ error: "El código de cancelación no es válido." });
	}
	const result = cancelCustomerBooking.run(bookingId, cancellationToken);
	if (!result.changes) {
		return response.status(404).json({ error: "No encontramos ese turno activo con esos datos." });
	}
	return response.json({ message: "Turno cancelado correctamente." });
});

app.listen(port, () => {
	console.log(`API de turnos disponible en http://localhost:${port}`);
});
