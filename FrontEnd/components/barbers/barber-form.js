import { BARBER_LOCATIONS, DEFAULT_WORKING_HOURS, WEEK_DAYS } from "../../data/barber-config.js";

class BarberForm extends HTMLElement {
	connectedCallback() {
		this.innerHTML = `
			<form class="barber-form" id="barber-form">
				<div class="field">
					<label for="barber-name">Nombre del barbero</label>
					<input id="barber-name" name="nombre" type="text" placeholder="Ej. Martín Gómez" required maxlength="60">
				</div>
				<div class="field">
					<label for="barber-location">Local</label>
					<select id="barber-location" name="local" required>
						${BARBER_LOCATIONS.map((location) => `<option value="${location.value}">${location.label}</option>`).join("")}
					</select>
				</div>
				<fieldset class="days-field">
					<legend>Días disponibles</legend>
					<div class="days-picker">
						${WEEK_DAYS.map((day) => `
							<label class="day-option">
								<input type="checkbox" name="dias" value="${day.value}">
								<span>${day.label}</span>
							</label>
						`).join("")}
					</div>
				</fieldset>
				<div class="time-fields">
					<div class="field">
						<label for="barber-start">Desde</label>
						<input id="barber-start" name="desde" type="time" value="${DEFAULT_WORKING_HOURS.start}" required>
					</div>
					<div class="field">
						<label for="barber-end">Hasta</label>
						<input id="barber-end" name="hasta" type="time" value="${DEFAULT_WORKING_HOURS.end}" required>
					</div>
				</div>
				<button class="button button-primary" type="submit">Agregar barbero <span class="arrow">+</span></button>
				<p class="form-feedback" role="status" aria-live="polite"></p>
			</form>
		`;

		this.form = this.querySelector("#barber-form");
		this.form.addEventListener("submit", (event) => this.handleSubmit(event));
	}

	handleSubmit(event) {
		event.preventDefault();
		const formData = new FormData(this.form);
		const data = {
			name: formData.get("nombre"),
			location: formData.get("local"),
			days: formData.getAll("dias"),
			start: formData.get("desde"),
			end: formData.get("hasta")
		};

		if (!data.days.length) {
			this.showFeedback("Elegí al menos un día de trabajo.");
			return;
		}
		if (data.start >= data.end) {
			this.showFeedback("La hora de cierre debe ser posterior a la de inicio.");
			return;
		}

		this.dispatchEvent(new CustomEvent("barber-submit", { bubbles: true, detail: data }));
		this.form.reset();
		this.querySelector("#barber-start").value = DEFAULT_WORKING_HOURS.start;
		this.querySelector("#barber-end").value = DEFAULT_WORKING_HOURS.end;
	}

	showFeedback(message) {
		this.querySelector(".form-feedback").textContent = message;
	}

	showSuccess(name) {
		this.showFeedback(`${name} fue agregado correctamente.`);
	}
}

customElements.define("barber-form", BarberForm);
