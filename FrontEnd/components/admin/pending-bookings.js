import { getPendingBookings } from "../../data/booking-api.js";

const SERVICE_LABELS = {
	corte: "Corte clásico",
	"corte-barba": "Corte + barba",
	barba: "Arreglo de barba"
};

const LOCATION_LABELS = {
	palermo: "Palermo",
	belgrano: "Belgrano"
};

class PendingBookings extends HTMLElement {
	connectedCallback() {
		this.innerHTML = `
			<section class="pending-bookings section" aria-labelledby="pending-bookings-title">
				<div class="section-heading">
					<div>
						<span class="section-kicker">Agenda</span>
						<h2 id="pending-bookings-title">Turnos<br>pendientes.</h2>
					</div>
					<p>Reservas agendadas que todavía necesitan confirmación o atención del equipo.</p>
				</div>
				<div class="pending-bookings-panel">
					<div class="pending-bookings-header">
						<h3>Por cumplir</h3>
						<span class="pending-bookings-count">0</span>
					</div>
					<div class="pending-bookings-list" aria-live="polite">
						<p class="pending-bookings-empty">Cargando turnos...</p>
					</div>
				</div>
			</section>
		`;
		this.list = this.querySelector(".pending-bookings-list");
		this.loadBookings();
	}

	async loadBookings() {
		try {
			this.render(await getPendingBookings());
		} catch (error) {
			this.renderError(error.message);
		}
	}

	render(bookings) {
		this.querySelector(".pending-bookings-count").textContent = bookings.length;
		this.list.replaceChildren();

		if (!bookings.length) {
			const emptyState = document.createElement("p");
			emptyState.className = "pending-bookings-empty";
			emptyState.textContent = "No hay turnos pendientes.";
			this.list.append(emptyState);
			return;
		}

		bookings.forEach((booking) => this.list.append(this.createBookingItem(booking)));
	}

	renderError(message) {
		this.querySelector(".pending-bookings-count").textContent = "-";
		this.list.replaceChildren();
		const errorState = document.createElement("p");
		errorState.className = "pending-bookings-empty pending-bookings-error";
		errorState.textContent = message;
		this.list.append(errorState);
	}

	createBookingItem(booking) {
		const item = document.createElement("article");
		item.className = "pending-booking-item";
		item.innerHTML = `
			<div class="pending-booking-date">
				<strong></strong>
				<span></span>
			</div>
			<div class="pending-booking-details">
				<h4></h4>
				<p class="pending-booking-service"></p>
				<p class="pending-booking-contact"></p>
			</div>
			<div class="pending-booking-assignment">
				<strong></strong>
				<span></span>
			</div>
		`;

		const date = new Date(`${booking.date}T12:00:00`);
		item.querySelector(".pending-booking-date strong").textContent = date.toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
		item.querySelector(".pending-booking-date span").textContent = date.toLocaleDateString("es-AR", { weekday: "long" });
		item.querySelector(".pending-booking-details h4").textContent = booking.customerName;
		item.querySelector(".pending-booking-service").textContent = `${SERVICE_LABELS[booking.service] || booking.service} · ${LOCATION_LABELS[booking.location] || booking.location}`;
		item.querySelector(".pending-booking-contact").textContent = `${booking.customerEmail} · ${booking.customerPhone}`;
		item.querySelector(".pending-booking-assignment strong").textContent = booking.barberName || "Barbero no asignado";
		item.querySelector(".pending-booking-assignment span").textContent = "Pendiente";
		return item;
	}
}

customElements.define("pending-bookings", PendingBookings);
