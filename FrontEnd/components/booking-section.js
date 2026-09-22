import { createBooking, getAvailableBarbers } from "../data/booking-api.js";

const DAY_VALUES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

class BookingSection extends HTMLElement {
	connectedCallback() {
		this.innerHTML = `
			<section class="booking-wrap" id="reservar" aria-labelledby="booking-title">
				<div class="booking-card">
					<div class="booking-intro">
						<h2 id="booking-title">Empezá<br>tu reserva</h2>
						<p>Completá estos datos y te mostramos los barberos disponibles para tu visita.</p>
					</div>
					<form class="booking-form" id="booking-form">
						<div class="field field-wide">
							<label for="customer-name">Nombre completo</label>
							<input id="customer-name" name="nombre" type="text" autocomplete="name" required maxlength="100" placeholder="Ej. Martín Gómez">
						</div>
						<div class="field">
							<label for="customer-email">Email</label>
							<input id="customer-email" name="email" type="email" autocomplete="email" required placeholder="tu@email.com">
						</div>
						<div class="field">
							<label for="customer-phone">Teléfono</label>
							<input id="customer-phone" name="telefono" type="tel" autocomplete="tel" required placeholder="11 5555 5555">
						</div>
						<div class="field">
							<label for="service">Servicio</label>
							<select id="service" name="servicio" required>
								<option value="corte">Corte clásico</option>
								<option value="corte-barba">Corte + barba</option>
								<option value="barba">Arreglo de barba</option>
							</select>
						</div>
						<div class="field">
							<label for="date">Fecha</label>
							<input id="date" name="fecha" type="date" required>
						</div>
						<div class="field">
							<label for="location">Local</label>
							<select id="location" name="local" required>
								<option value="palermo">Palermo</option>
								<option value="belgrano">Belgrano</option>
							</select>
						</div>
						<div class="field field-wide">
							<label for="barber">Barbero</label>
							<select id="barber" name="barbero" required disabled>
								<option value="">Cargando barberos...</option>
							</select>
						</div>
						<button class="button button-primary form-button" type="submit">Ver horarios <span class="arrow">→</span></button>
						<p class="booking-feedback" role="status" aria-live="polite"></p>
					</form>
				</div>
			</section>
		`;

		this.setMinimumDate();
		this.form = this.querySelector("#booking-form");
		this.barbers = [];
		this.locationInput = this.querySelector("#location");
		this.dateInput = this.querySelector("#date");
		this.barberInput = this.querySelector("#barber");
		this.locationInput.addEventListener("change", () => this.renderBarberOptions());
		this.dateInput.addEventListener("change", () => this.renderBarberOptions());
		this.form.addEventListener("submit", (event) => this.submitBooking(event));
		this.loadBarbers();
	}

	async loadBarbers() {
		try {
			this.barbers = await getAvailableBarbers();
			this.renderBarberOptions();
		} catch {
			this.barberInput.replaceChildren(new Option("No se pudieron cargar los barberos", ""));
		}
	}

	renderBarberOptions() {
		const selectedLocation = this.locationInput.value;
		const selectedDate = this.dateInput.value;
		const selectedDay = selectedDate ? DAY_VALUES[new Date(`${selectedDate}T12:00:00`).getDay()] : "";
		const availableBarbers = this.barbers.filter((barber) => barber.location === selectedLocation && barber.days.includes(selectedDay));

		this.barberInput.replaceChildren();
		if (!availableBarbers.length) {
			this.barberInput.append(new Option("No hay barberos disponibles", ""));
			this.barberInput.disabled = true;
			return;
		}

		this.barberInput.append(new Option("Elegí un barbero", ""));
		availableBarbers.forEach((barber) => {
			this.barberInput.append(new Option(`${barber.name} · ${barber.start} a ${barber.end}`, barber.id));
		});
		this.barberInput.disabled = false;
	}

	async submitBooking(event) {
		event.preventDefault();
		const formData = new FormData(this.form);
		const feedback = this.querySelector(".booking-feedback");
		const submitButton = this.form.querySelector("button[type=submit]");
		const booking = {
			name: formData.get("nombre"),
			email: formData.get("email"),
			phone: formData.get("telefono"),
			service: formData.get("servicio"),
			date: formData.get("fecha"),
			location: formData.get("local"),
			barberId: Number(formData.get("barbero"))
		};

		feedback.textContent = "Guardando tu turno...";
		feedback.className = "booking-feedback is-loading";
		submitButton.disabled = true;

		try {
			await createBooking(booking);
			feedback.textContent = "Tu turno fue registrado. Te contactaremos para confirmarlo.";
			feedback.className = "booking-feedback is-success";
			this.form.reset();
			this.setMinimumDate();
			this.renderBarberOptions();
		} catch (error) {
			feedback.textContent = error.message;
			feedback.className = "booking-feedback is-error";
		} finally {
			submitButton.disabled = false;
		}
	}

	setMinimumDate() {
		const dateInput = this.querySelector("#date");
		const today = new Date();
		const localDate = new Date(today.getTime() - today.getTimezoneOffset() * 60000)
			.toISOString()
			.split("T")[0];

		dateInput.min = localDate;
		dateInput.value = localDate;
	}
}

customElements.define("booking-section", BookingSection);
