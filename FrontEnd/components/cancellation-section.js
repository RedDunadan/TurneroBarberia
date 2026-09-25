import { cancelBooking, getCustomerBookings } from "../data/booking-api.js";

class CancellationSection extends HTMLElement {
	connectedCallback() {
		this.innerHTML = `
			<section class="cancellation section" id="cancelar" aria-labelledby="cancellation-title">
				<div class="section-heading">
					<h2 id="cancellation-title">¿Necesitás<br>cancelar?</h2>
					<p>Ingresá el código de cancelación que recibiste al reservar.</p>
				</div>
				<form class="cancellation-form" novalidate>
					<div class="field">
						<label for="cancellation-token">Código de cancelación</label>
						<input id="cancellation-token" name="token" type="text" inputmode="text" autocomplete="off" required pattern="[a-fA-F0-9]{48}" placeholder="Pegá tu código de 48 caracteres">
					</div>
					<button class="button button-primary" type="submit">Ver mis turnos <span class="arrow">→</span></button>
					<p class="cancellation-feedback" role="status" aria-live="polite"></p>
				</form>
				<div class="customer-bookings" hidden></div>
			</section>
		`;

		this.form = this.querySelector(".cancellation-form");
		this.list = this.querySelector(".customer-bookings");
		this.tokenInput = this.querySelector("[name=token]");
		this.form.addEventListener("submit", (event) => this.findBookings(event));
	}

	async findBookings(event) {
		event.preventDefault();
		this.setFeedback("Buscando tus turnos...", "is-loading");
		try {
			const bookings = await getCustomerBookings(this.tokenInput.value);
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
			const details = document.createElement("div");
			const dateElement = document.createElement("strong");
			dateElement.textContent = date;
			const detailsElement = document.createElement("span");
			detailsElement.textContent = `${serviceLabels[booking.service]} · ${booking.location} · ${booking.barberName || "Barbero asignado"}`;
			details.append(dateElement, detailsElement);
			item.append(details);
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
			await cancelBooking(id, this.tokenInput.value);
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