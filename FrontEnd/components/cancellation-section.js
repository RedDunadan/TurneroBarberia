import { cancelBooking, getCustomerBookings } from "../data/booking-api.js";

class CancellationSection extends HTMLElement {
	connectedCallback() {
		this.innerHTML = `
			<section class="cancellation section" id="cancelar" aria-labelledby="cancellation-title">
				<div class="section-heading">
					<h2 id="cancellation-title">¿Necesitás<br>cancelar?</h2>
					<p>Ingresá los mismos datos de tu reserva para consultar tus turnos activos.</p>
				</div>
				<form class="cancellation-form" novalidate>
					<div class="field">
						<label for="cancellation-email">Email</label>
						<input id="cancellation-email" name="email" type="email" autocomplete="email" required placeholder="tu@email.com">
					</div>
					<div class="field">
						<label for="cancellation-phone">Teléfono</label>
						<input id="cancellation-phone" name="phone" type="tel" autocomplete="tel" required placeholder="11 5555 5555">
					</div>
					<button class="button button-primary" type="submit">Ver mis turnos <span class="arrow">→</span></button>
					<p class="cancellation-feedback" role="status" aria-live="polite"></p>
				</form>
				<div class="customer-bookings" hidden></div>
			</section>
		`;

		this.form = this.querySelector(".cancellation-form");
		this.list = this.querySelector(".customer-bookings");
		this.emailInput = this.querySelector("[name=email]");
		this.phoneInput = this.querySelector("[name=phone]");
		this.form.addEventListener("submit", (event) => this.findBookings(event));
	}

	async findBookings(event) {
		event.preventDefault();
		this.setFeedback("Buscando tus turnos...", "is-loading");
		try {
			const bookings = await getCustomerBookings(this.emailInput.value, this.phoneInput.value);
			this.renderBookings(bookings);
			this.setFeedback(bookings.length ? "Seleccioná el turno que querés cancelar." : "No encontramos turnos activos con esos datos.", bookings.length ? "" : "is-error");
		} catch (error) {
			this.list.hidden = true;
			this.setFeedback(error.message, "is-error");
		}
	}

	renderBookings(bookings) {
		this.list.replaceChildren();
		if (!bookings.length) {
			this.list.hidden = true;
			return;
		}
		bookings.forEach((booking) => {
			const item = document.createElement("article");
			item.className = "customer-booking";
			const date = new Date(`${booking.date}T12:00:00`).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });
			const serviceLabels = { corte: "Corte clásico", "corte-barba": "Corte + barba", barba: "Arreglo de barba" };
			item.innerHTML = `<div><strong>${date}</strong><span>${serviceLabels[booking.service]} · ${booking.location} · ${booking.barberName || "Barbero asignado"}</span></div>`;
			const button = document.createElement("button");
			button.className = "button cancellation-button";
			button.type = "button";
			button.textContent = "Cancelar";
			button.addEventListener("click", () => this.cancelCustomerBooking(booking.id, item, button));
			item.append(button);
			this.list.append(item);
		});
		this.list.hidden = false;
	}

	async cancelCustomerBooking(id, item, button) {
		if (!window.confirm("¿Querés cancelar este turno?")) return;
		button.disabled = true;
		try {
			await cancelBooking(id, this.emailInput.value, this.phoneInput.value);
			item.remove();
			this.setFeedback("El turno fue cancelado correctamente.", "is-success");
			if (!this.list.children.length) this.list.hidden = true;
		} catch (error) {
			button.disabled = false;
			this.setFeedback(error.message, "is-error");
		}
	}

	setFeedback(message, state) {
		const feedback = this.querySelector(".cancellation-feedback");
		feedback.textContent = message;
		feedback.className = `cancellation-feedback ${state}`;
	}
}

customElements.define("cancellation-section", CancellationSection);