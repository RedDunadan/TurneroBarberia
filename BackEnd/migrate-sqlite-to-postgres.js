import Database from "better-sqlite3";
import { initializeDatabase, pool } from "./database.js";

const sqlitePath = process.argv[2];
if (!sqlitePath) {
	throw new Error("Indicá la ruta al archivo SQLite: node migrate-sqlite-to-postgres.js <archivo.db>");
}

const sqlite = new Database(sqlitePath, { readonly: true, fileMustExist: true });

try {
	await initializeDatabase();
	const barbers = sqlite.prepare("SELECT * FROM barbers ORDER BY id").all();
	const bookingColumns = new Set(sqlite.prepare("PRAGMA table_info(bookings)").all().map(({ name }) => name));
	const hasBarberId = bookingColumns.has("barber_id");
	const hasCancellationToken = bookingColumns.has("cancellation_token");
	const bookings = sqlite.prepare(`
		SELECT
			id, customer_name, customer_email, customer_phone, service, booking_date,
			location, ${hasBarberId ? "barber_id" : "NULL AS barber_id"},
			${hasCancellationToken ? "cancellation_token" : "NULL AS cancellation_token"},
			status, created_at
		FROM bookings
		ORDER BY id
	`).all();
	const client = await pool.connect();

	try {
		await client.query("BEGIN");
		for (const barber of barbers) {
			await client.query(`
				INSERT INTO barbers (id, name, email, phone, location, days, start_time, end_time, created_at)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9::timestamptz, CURRENT_TIMESTAMP))
				ON CONFLICT (id) DO NOTHING
			`, [barber.id, barber.name, barber.email, barber.phone, barber.location, barber.days, barber.start_time, barber.end_time, barber.created_at]);
		}
		for (const booking of bookings) {
			await client.query(`
				INSERT INTO bookings (
					id, customer_name, customer_email, customer_phone, service, booking_date,
					location, barber_id, cancellation_token, status, created_at
				)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, COALESCE($11::timestamptz, CURRENT_TIMESTAMP))
				ON CONFLICT (id) DO NOTHING
			`, [booking.id, booking.customer_name, booking.customer_email, booking.customer_phone, booking.service, booking.booking_date, booking.location, booking.barber_id, booking.cancellation_token, booking.status, booking.created_at]);
		}
		await client.query("SELECT setval(pg_get_serial_sequence('barbers', 'id'), GREATEST(COALESCE((SELECT MAX(id) FROM barbers), 1), 1), EXISTS (SELECT 1 FROM barbers))");
		await client.query("SELECT setval(pg_get_serial_sequence('bookings', 'id'), GREATEST(COALESCE((SELECT MAX(id) FROM bookings), 1), 1), EXISTS (SELECT 1 FROM bookings))");
		await client.query("COMMIT");
		console.log(`Migración completada: ${barbers.length} barberos y ${bookings.length} turnos.`);
	} catch (error) {
		await client.query("ROLLBACK");
		throw error;
	} finally {
		client.release();
	}
} finally {
	sqlite.close();
	await pool.end();
}
