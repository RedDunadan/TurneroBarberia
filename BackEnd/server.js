import express from "express";
import cors from "cors";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { initializeDatabase, pool, query } from "./database.js";

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);
const port = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === "production";
const firebaseProjectId = process.env.FIREBASE_PROJECT_ID;
const frontendOrigin = process.env.FRONTEND_ORIGIN || (firebaseProjectId ? "" : "http://localhost:5500");
const defaultFrontendOrigins = [
	frontendOrigin,
	firebaseProjectId && `https://${firebaseProjectId}.web.app`,
	firebaseProjectId && `https://${firebaseProjectId}.firebaseapp.com`
].filter(Boolean).join(",");
const frontendAllowedOrigins = new Set((process.env.FRONTEND_ORIGINS || defaultFrontendOrigins)
	.split(",")
	.map((origin) => origin.trim())
	.filter(Boolean)
	.map((origin) => origin.replace(/\/+$/, "")));
const adminUsername = process.env.ADMIN_USERNAME?.trim();
const adminPassword = process.env.ADMIN_PASSWORD;
const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;
const rateLimitBuckets = new Map();
const sessionDuration = Number(process.env.SESSION_DURATION_MS || 8 * 60 * 60 * 1000);
const sessionCookieName = "admin_session";
const dayNames = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

if (!adminUsername || (!adminPassword && !adminPasswordHash)) {
	throw new Error("ADMIN_USERNAME y ADMIN_PASSWORD o ADMIN_PASSWORD_HASH son obligatorios.");
}

app.use(cors({
	origin: (requestOrigin, callback) => {
		if (!requestOrigin || frontendAllowedOrigins.has(requestOrigin.replace(/\/+$/, ""))) {
			return callback(null, true);
		}
		return callback(new Error("Origen de solicitud no permitido."));
	},
	credentials: true
}));
app.use((request, response, next) => {
	response.setHeader("X-Content-Type-Options", "nosniff");
	response.setHeader("X-Frame-Options", "SAMEORIGIN");
	response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
	response.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
	response.setHeader("X-XSS-Protection", "1; mode=block");
	if (isProduction) {
		response.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
	}
	next();
});
app.use(express.json({ limit: "16kb" }));

function rateLimit({ limit, windowMs, key: bucketKey }) {
	return (request, response, next) => {
		const key = `${request.ip || "unknown"}:${bucketKey || request.path}`;
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
	const origin = request.headers.origin?.replace(/\/+$/, "");
	if (origin && !frontendAllowedOrigins.has(origin)) {
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
	const secure = isProduction ? "; Secure" : "";
	response.setHeader("Set-Cookie", `${sessionCookieName}=${encodeURIComponent(token)}; HttpOnly; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`);
}

async function sessionStoreGet(token) {
	if (!token) {
		return null;
	}

	const { rows } = await query('SELECT username, expires_at AS "expiresAt" FROM admin_sessions WHERE token = $1', [token]);
	const row = rows[0];
	if (!row) {
		return null;
	}

	if (Number(row.expiresAt) <= Date.now()) {
		await query("DELETE FROM admin_sessions WHERE token = $1", [token]);
		return null;
	}

	return { username: row.username, expiresAt: Number(row.expiresAt) };
}

function sessionStoreSet(token, username, expiresAt) {
	return query(`
		INSERT INTO admin_sessions (token, username, expires_at)
		VALUES ($1, $2, $3)
		ON CONFLICT(token) DO UPDATE SET username = excluded.username, expires_at = excluded.expires_at
	`, [token, username, expiresAt]);
}

function sessionStoreDelete(token) {
	if (!token) {
		return Promise.resolve();
	}
	return query("DELETE FROM admin_sessions WHERE token = $1", [token]);
}

async function requireAdmin(request, response, next) {
	try {
		const token = parseCookies(request)[sessionCookieName];
		const session = await sessionStoreGet(token);
		if (!session) {
			if (token) {
				await sessionStoreDelete(token);
			}
			return response.status(401).json({ error: "Se requiere una sesión de administrador." });
		}

		request.adminSession = session;
		return next();
	} catch (error) {
		console.error("Error al validar la sesión:", error);
		return response.status(500).json({ error: "No se pudo validar la sesión." });
	}
}

app.post("/api/auth/login", requireSameOrigin, rateLimit({ limit: 5, windowMs: 15 * 60 * 1000 }), async (request, response) => {
	const { username, password } = request.body;
	if (username !== adminUsername || typeof password !== "string" || !passwordMatches(password)) {
		return response.status(401).json({ error: "Usuario o contraseña incorrectos." });
	}

	const token = randomBytes(32).toString("hex");
	const expiresAt = Date.now() + sessionDuration;
	await sessionStoreSet(token, username, expiresAt);
	setSessionCookie(response, token);
	return response.json({ username });
});

app.post("/api/auth/logout", requireSameOrigin, async (request, response) => {
	const token = parseCookies(request)[sessionCookieName];
	await sessionStoreDelete(token);
	setSessionCookie(response, "", 0);
	return response.status(204).send();
});

app.get("/api/auth/me", requireAdmin, (_request, response) => {
	response.json({ authenticated: true });
});

const listBarbers = `
	SELECT
		barbers.id,
		barbers.name,
		barbers.email,
		barbers.phone,
		barbers.location,
		barbers.days,
		barbers.start_time AS "start",
		barbers.end_time AS "end",
		COUNT(CASE WHEN bookings.status != 'cancelled' THEN bookings.id END) AS "bookingCount"
	FROM barbers
	LEFT JOIN bookings ON bookings.barber_id = barbers.id
	GROUP BY barbers.id
	ORDER BY LOWER(barbers.name)
`;

const insertBarber = `
	INSERT INTO barbers (name, email, phone, location, days, start_time, end_time)
	VALUES ($1, $2, $3, $4, $5, $6, $7)
	RETURNING id
`;

const listPendingBookings = `
	SELECT
		bookings.id,
		bookings.customer_name AS "customerName",
		bookings.customer_email AS "customerEmail",
		bookings.customer_phone AS "customerPhone",
		bookings.service,
		bookings.booking_date::TEXT AS "date",
		bookings.location,
		bookings.status,
		barbers.name AS "barberName"
	FROM bookings
	LEFT JOIN barbers ON barbers.id = bookings.barber_id
	WHERE bookings.status = 'pending'
	ORDER BY bookings.booking_date ASC, bookings.id ASC
`;

const createBooking = `
	INSERT INTO bookings (
		customer_name,
		customer_email,
		customer_phone,
		service,
		booking_date,
		location,
		barber_id,
		cancellation_token
	) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	RETURNING id
`;
const listCustomerBookings = `
	SELECT
		bookings.id,
		bookings.customer_name AS "customerName",
		bookings.service,
		bookings.booking_date::TEXT AS "date",
		bookings.location,
		bookings.cancellation_token AS "cancellationToken",
		barbers.name AS "barberName"
	FROM bookings
	LEFT JOIN barbers ON barbers.id = bookings.barber_id
	WHERE bookings.cancellation_token = $1 AND bookings.status != 'cancelled'
	ORDER BY bookings.booking_date ASC, bookings.id ASC
	`;
const cancelCustomerBooking = `
	UPDATE bookings
	SET status = 'cancelled'
	WHERE id = $1 AND cancellation_token = $2 AND status != 'cancelled'
`;

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

app.get("/api/health", async (_request, response) => {
	try {
		await query("SELECT 1");
		response.json({
			status: "ok",
			timestamp: new Date().toISOString(),
			uptimeSeconds: Math.floor(process.uptime()),
			env: process.env.NODE_ENV || "development"
		});
	} catch (error) {
		console.error("Health check failed:", error);
		response.status(500).json({ status: "error", error: "Database unavailable" });
	}
});

async function getMatchingBarbersByDate(location, date) {
	const selectedDay = dayNames[new Date(`${date}T12:00:00`).getDay()];
	const { rows } = await query(listBarbers);
	return rows
		.map(({ id, name, location: barberLocation, days, start, end, email, phone }) => ({
			id,
			name,
			location: barberLocation,
			days: JSON.parse(days),
			start,
			end,
			email,
			phone
		}))
		.filter((barber) => barber.location === location && barber.days.includes(selectedDay));
}

app.get("/api/barbers", async (_request, response) => {
	const { rows } = await query(listBarbers);
	const barbers = rows.map(({ id, name, location, days }) => ({ id, name, location, days: JSON.parse(days) }));
	response.json(barbers);
});

app.get("/api/barbers/available", async (request, response) => {
	const location = typeof request.query.location === "string" ? request.query.location.trim() : "";
	const date = typeof request.query.date === "string" ? request.query.date.trim() : "";

	if (!location || !["palermo", "belgrano"].includes(location) || !isValidDate(date)) {
		return response.status(400).json({ error: "La fecha y el local son obligatorios y deben ser válidos." });
	}

	response.json(await getMatchingBarbersByDate(location, date));
});

app.get("/api/admin/barbers", requireAdmin, async (_request, response) => {
	const { rows } = await query(listBarbers);
	const barbers = rows.map((barber) => ({
		...barber,
		days: JSON.parse(barber.days),
		bookingCount: Number(barber.bookingCount)
	}));
	response.json(barbers);
});

app.post("/api/admin/barbers", requireSameOrigin, requireAdmin, async (request, response) => {
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
		const result = await query(insertBarber, [normalizedName, normalizedEmail, normalizedPhone, location, JSON.stringify(days), start, end]);
		return response.status(201).json({ id: result.rows[0].id, bookingCount: 0, message: "Barbero guardado correctamente." });
	} catch (error) {
		if (error.code === "23505") {
			return response.status(409).json({ error: "Ya existe un barbero con ese email." });
		}
		console.error("Error al guardar el barbero:", error);
		return response.status(500).json({ error: "No se pudo guardar el barbero." });
	}
});

app.delete("/api/admin/barbers/:id", requireSameOrigin, requireAdmin, async (request, response) => {
	const result = await query("DELETE FROM barbers WHERE id = $1", [request.params.id]);
	if (!result.rowCount) {
		return response.status(404).json({ error: "Barbero no encontrado." });
	}
	return response.status(204).send();
});

app.get("/api/admin/bookings/pending", requireAdmin, async (_request, response) => {
	const { rows } = await query(listPendingBookings);
	response.json(rows);
});

app.delete("/api/admin/bookings/:id", requireSameOrigin, requireAdmin, async (request, response) => {
	const bookingId = Number(request.params.id);
	if (!Number.isInteger(bookingId) || bookingId < 1) {
		return response.status(400).json({ error: "El identificador del turno no es válido." });
	}

	const result = await query("DELETE FROM bookings WHERE id = $1", [bookingId]);
	if (!result.rowCount) {
		return response.status(404).json({ error: "Turno no encontrado." });
	}
	return response.status(204).send();
});

app.post("/api/bookings", rateLimit({ limit: 10, windowMs: 15 * 60 * 1000 }), async (request, response) => {
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
	const { rows: barberRows } = await query("SELECT id, location, days FROM barbers WHERE id = $1", [Number(barberId)]);
	const selectedBarber = barberRows[0];
	const selectedDay = dayNames[new Date(`${date}T12:00:00`).getDay()];
	const availableBarbers = await getMatchingBarbersByDate(location, date);
	const isAvailable = Boolean(selectedBarber && selectedBarber.location === location && JSON.parse(selectedBarber.days).includes(selectedDay) && availableBarbers.some((barber) => barber.id === Number(barberId)));
	if (!isAvailable) {
		return response.status(400).json({ error: "El barbero no está disponible para ese local y día." });
	}

	try {
		const cancellationToken = randomBytes(24).toString("hex");
		const result = await query(createBooking, [normalizedName, normalizedEmail, normalizedPhone, service, date, location, Number(barberId), cancellationToken]);
		return response.status(201).json({ id: result.rows[0].id, cancellationToken, message: "Turno registrado correctamente." });
	} catch (error) {
		console.error("Error al guardar el turno:", error);
		return response.status(500).json({ error: "No se pudo guardar el turno." });
	}
});

app.get("/api/bookings/customer", rateLimit({ limit: 10, windowMs: 15 * 60 * 1000 }), async (request, response) => {
	const cancellationToken = typeof request.query.token === "string" ? request.query.token.trim().toLowerCase() : "";

	if (!isValidCancellationToken(cancellationToken)) {
		return response.status(400).json({ error: "Ingresá el código de cancelación de tu reserva." });
	}
	const { rows } = await query(listCustomerBookings, [cancellationToken]);
	return response.json(rows);
});

app.patch("/api/bookings/:id/cancel", rateLimit({ limit: 10, windowMs: 15 * 60 * 1000, key: "booking-cancel" }), async (request, response) => {
	const cancellationToken = typeof request.body.token === "string" ? request.body.token.trim().toLowerCase() : "";
	const bookingId = Number(request.params.id);

	if (!Number.isInteger(bookingId) || !isValidCancellationToken(cancellationToken)) {
		return response.status(400).json({ error: "El código de cancelación no es válido." });
	}
	const result = await query(cancelCustomerBooking, [bookingId, cancellationToken]);
	if (!result.rowCount) {
		return response.status(404).json({ error: "No encontramos ese turno activo con esos datos." });
	}
	return response.json({ message: "Turno cancelado correctamente." });
});

app.use((error, _request, response, next) => {
	if (response.headersSent) {
		return next(error);
	}
	console.error("Error inesperado en la API:", error);
	return response.status(500).json({ error: "Ocurrió un error interno." });
});

try {
	await initializeDatabase();
	const server = app.listen(port, () => {
		console.log(`API de turnos disponible en el puerto ${port}`);
	});
	const shutdown = () => server.close(() => pool.end());
	process.once("SIGTERM", shutdown);
	process.once("SIGINT", shutdown);
} catch (error) {
	console.error("No se pudo iniciar la API:", error);
	await pool.end();
	process.exitCode = 1;
}
