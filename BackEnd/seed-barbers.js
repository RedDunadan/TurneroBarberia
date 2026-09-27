import { initializeDatabase, pool, query } from "./database.js";

await initializeDatabase();

const addBarber = `
	INSERT INTO barbers (name, email, phone, location, days, start_time, end_time)
	VALUES ($1, $2, $3, $4, $5, $6, $7)
	ON CONFLICT (email) DO NOTHING
`;

const testBarbers = [
	{ name: "Lucía Benítez", email: "lucia.benitez@norte.test", phone: "11 4000 1001", location: "palermo", days: ["lunes", "miércoles", "viernes"], start: "10:00", end: "18:00" },
	{ name: "Tomás Sosa", email: "tomas.sosa@norte.test", phone: "11 4000 1002", location: "belgrano", days: ["martes", "jueves", "sábado"], start: "11:00", end: "20:00" },
	{ name: "Valentina Díaz", email: "valentina.diaz@norte.test", phone: "11 4000 1003", location: "palermo", days: ["martes", "jueves", "sábado"], start: "12:00", end: "20:00" }
];

try {
	for (const barber of testBarbers) {
		await query(addBarber, [barber.name, barber.email, barber.phone, barber.location, JSON.stringify(barber.days), barber.start, barber.end]);
	}
	console.log(`${testBarbers.length} barberos de prueba disponibles en la base.`);
} finally {
	await pool.end();
}