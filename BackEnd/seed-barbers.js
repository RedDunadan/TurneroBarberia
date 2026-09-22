import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const database = new Database(path.join(__dirname, "turnero.db"));

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
	)
`);

const addBarber = database.prepare(`
	INSERT OR IGNORE INTO barbers (name, email, phone, location, days, start_time, end_time)
	VALUES (@name, @email, @phone, @location, @days, @start, @end)
`);

const testBarbers = [
	{ name: "Lucía Benítez", email: "lucia.benitez@norte.test", phone: "11 4000 1001", location: "palermo", days: ["lunes", "miércoles", "viernes"], start: "10:00", end: "18:00" },
	{ name: "Tomás Sosa", email: "tomas.sosa@norte.test", phone: "11 4000 1002", location: "belgrano", days: ["martes", "jueves", "sábado"], start: "11:00", end: "20:00" },
	{ name: "Valentina Díaz", email: "valentina.diaz@norte.test", phone: "11 4000 1003", location: "palermo", days: ["martes", "jueves", "sábado"], start: "12:00", end: "20:00" }
];

testBarbers.forEach((barber) => addBarber.run({ ...barber, days: JSON.stringify(barber.days) }));
console.log(`${testBarbers.length} barberos de prueba disponibles en la base.`);
database.close();