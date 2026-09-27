import pg from "pg";

const { Pool } = pg;
const connectionOptions = process.env.DATABASE_URL
	? { connectionString: process.env.DATABASE_URL }
	: {
		host: process.env.DB_HOST || "localhost",
		port: Number(process.env.DB_PORT || 5432),
		database: process.env.DB_NAME || "turnero",
		user: process.env.DB_USER || "turnero",
		password: process.env.DB_PASSWORD
	};

if (process.env.DB_SSL === "true") {
	connectionOptions.ssl = { rejectUnauthorized: true };
}

export const pool = new Pool({
	...connectionOptions,
	max: Number(process.env.DB_POOL_MAX || 5),
	idleTimeoutMillis: 30_000,
	connectionTimeoutMillis: 10_000
});

pool.on("error", (error) => {
	console.error("Unexpected PostgreSQL pool error:", error);
});

export function query(text, parameters = []) {
	return pool.query(text, parameters);
}

export async function initializeDatabase() {
	await query(`
		CREATE TABLE IF NOT EXISTS admin_sessions (
			token TEXT PRIMARY KEY,
			username TEXT NOT NULL,
			expires_at BIGINT NOT NULL
		)
	`);
	await query(`
		CREATE TABLE IF NOT EXISTS barbers (
			id SERIAL PRIMARY KEY,
			name TEXT NOT NULL,
			email TEXT NOT NULL UNIQUE,
			phone TEXT NOT NULL,
			location TEXT NOT NULL CHECK (location IN ('palermo', 'belgrano')),
			days TEXT NOT NULL,
			start_time TEXT NOT NULL,
			end_time TEXT NOT NULL,
			created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
		)
	`);
	await query(`
		CREATE TABLE IF NOT EXISTS bookings (
			id SERIAL PRIMARY KEY,
			customer_name TEXT NOT NULL,
			customer_email TEXT NOT NULL,
			customer_phone TEXT NOT NULL,
			service TEXT NOT NULL CHECK (service IN ('corte', 'corte-barba', 'barba')),
			booking_date DATE NOT NULL,
			location TEXT NOT NULL CHECK (location IN ('palermo', 'belgrano')),
			barber_id INTEGER REFERENCES barbers(id) ON DELETE SET NULL,
			cancellation_token TEXT UNIQUE,
			status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
			created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
		)
	`);
	await query("CREATE INDEX IF NOT EXISTS idx_bookings_cancellation_token ON bookings(cancellation_token) WHERE cancellation_token IS NOT NULL");
}
