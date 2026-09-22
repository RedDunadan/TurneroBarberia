class BookingSection extends HTMLElement {
	connectedCallback() {
		this.innerHTML = `
			<section class="booking-wrap" id="reservar" aria-labelledby="booking-title">
				<div class="booking-card">
					<div class="booking-intro">
						<h2 id="booking-title">Empezá<br>tu reserva</h2>
						<p>Completá estos datos y te mostramos los barberos disponibles para tu visita.</p>
					</div>
					<form class="booking-form" action="barberos.html" method="get">
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
						<button class="button button-primary form-button" type="submit">Ver horarios <span class="arrow">→</span></button>
					</form>
				</div>
			</section>
		`;

		this.setMinimumDate();
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
