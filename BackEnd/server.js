import express from "express";
import cors from "cors";
import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const database = new Database(path.join(__dirname, "turnero.db"));
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

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
		status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
		created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
	)
`);

const bookingColumns = database.prepare("PRAGMA table_info(bookings)").all();
if (!bookingColumns.some((column) => column.name === "barber_id")) {
	database.exec("ALTER TABLE bookings ADD COLUMN barber_id INTEGER REFERENCES barbers(id) ON DELETE SET NULL");
}

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
		barber_id
	) VALUES (@name, @email, @phone, @service, @date, @location, @barberId)
`);
const listCustomerBookings = database.prepare(`
	SELECT
		bookings.id,
		bookings.customer_name AS customerName,
		bookings.service,
		bookings.booking_date AS date,
		bookings.location,
		barbers.name AS barberName
	FROM bookings
	LEFT JOIN barbers ON barbers.id = bookings.barber_id
	WHERE bookings.customer_email = ? AND bookings.customer_phone = ? AND bookings.status != 'cancelled'
	ORDER BY bookings.booking_date ASC, bookings.id ASC
`);
const cancelCustomerBooking = database.prepare(`
	UPDATE bookings
	SET status = 'cancelled'
	WHERE id = ? AND customer_email = ? AND customer_phone = ? AND status != 'cancelled'
`);

app.get("/api/health", (_request, response) => {
	response.json({ status: "ok" });
});

app.get("/api/barbers", (_request, response) => {
	const barbers = listBarbers.all().map((barber) => ({
		...barber,
		days: JSON.parse(barber.days),
		bookingCount: Number(barber.bookingCount)
	}));
	response.json(barbers);
});

app.post("/api/barbers", (request, response) => {
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
	if (!["palermo", "belgrano"].includes(location) || !Array.isArray(days) || !days.length) {
		return response.status(400).json({ error: "El local y al menos un día son obligatorios." });
	}
	if (typeof start !== "string" || typeof end !== "string" || start >= end) {
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

app.delete("/api/barbers/:id", (request, response) => {
	const result = deleteBarber.run(request.params.id);
	if (!result.changes) {
		return response.status(404).json({ error: "Barbero no encontrado." });
	}
	return response.status(204).send();
});

app.get("/api/bookings/pending", (_request, response) => {
	response.json(listPendingBookings.all());
});

app.post("/api/bookings", (request, response) => {
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
	if (!["palermo", "belgrano"].includes(location) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
		return response.status(400).json({ error: "La fecha o el local no son válidos." });
	}
	if (date < new Date().toISOString().slice(0, 10)) {
		return response.status(400).json({ error: "La fecha del turno no puede ser anterior a hoy." });
	}
	if (barberId === undefined || barberId === null || !Number.isInteger(Number(barberId))) {
		return response.status(400).json({ error: "El barbero seleccionado no es válido." });
	}
	const selectedBarber = findBarber.get(Number(barberId));
	const selectedDay = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"][new Date(`${date}T12:00:00`).getDay()];
	if (!selectedBarber || selectedBarber.location !== location || !JSON.parse(selectedBarber.days).includes(selectedDay)) {
		return response.status(400).json({ error: "El barbero no está disponible para ese local y día." });
	}

	try {
		const result = createBooking.run({
			name: normalizedName,
			email: normalizedEmail,
			phone: normalizedPhone,
			service,
			date,
			location,
			barberId: barberId || null
		});
		return response.status(201).json({ id: result.lastInsertRowid, message: "Turno registrado correctamente." });
	} catch (error) {
		console.error("Error al guardar el turno:", error);
		return response.status(500).json({ error: "No se pudo guardar el turno." });
	}
});

app.get("/api/bookings/customer", (request, response) => {
	const email = typeof request.query.email === "string" ? request.query.email.trim().toLowerCase() : "";
	const phone = typeof request.query.phone === "string" ? request.query.phone.trim() : "";

	if (!/^\S+@\S+\.\S+$/.test(email) || !/^[-+()\s\d]{7,25}$/.test(phone)) {
		return response.status(400).json({ error: "Ingresá el email y teléfono usados en la reserva." });
	}
	return response.json(listCustomerBookings.all(email, phone));
});

app.patch("/api/bookings/:id/cancel", (request, response) => {
	const email = typeof request.body.email === "string" ? request.body.email.trim().toLowerCase() : "";
	const phone = typeof request.body.phone === "string" ? request.body.phone.trim() : "";
	const bookingId = Number(request.params.id);

	if (!Number.isInteger(bookingId) || !/^\S+@\S+\.\S+$/.test(email) || !/^[-+()\s\d]{7,25}$/.test(phone)) {
		return response.status(400).json({ error: "Los datos para cancelar el turno no son válidos." });
	}
	const result = cancelCustomerBooking.run(bookingId, email, phone);
	if (!result.changes) {
		return response.status(404).json({ error: "No encontramos ese turno activo con esos datos." });
	}
	return response.json({ message: "Turno cancelado correctamente." });
});

app.listen(port, () => {
	console.log(`API de turnos disponible en http://localhost:${port}`);
});
