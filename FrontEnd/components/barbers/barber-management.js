import "./barber-form.js";
import "./barber-list.js";
import { addBarber, getBarbers, removeBarber } from "../../data/barber-api.js";

class BarberManagement extends HTMLElement {
	connectedCallback() {
		this.innerHTML = `
			<section class="section barber-management" id="barberos" aria-labelledby="barbers-title">
				<div class="section-heading">
					<div>
						<span class="section-kicker">Administración</span>
						<h2 id="barbers-title">Sumá tu<br>equipo.</h2>
					</div>
					<p>Definí cuándo trabaja cada barbero para que sus horarios queden listos para las reservas.</p>
				</div>
				<div class="barber-admin-grid">
					<barber-form></barber-form>
					<div class="barber-list-panel">
						<barber-list></barber-list>
					</div>
				</div>
			</section>
		`;

		this.form = this.querySelector("barber-form");
		this.list = this.querySelector("barber-list");
		this.addEventListener("barber-submit", (event) => this.handleBarberSubmit(event));
		this.addEventListener("barber-remove", (event) => this.handleBarberRemove(event));
		this.renderBarbers();
	}

	async handleBarberSubmit(event) {
		try {
			const barber = await addBarber(event.detail);
			this.form.showSuccess(event.detail.name);
			await this.renderBarbers();
		} catch (error) {
			this.form.showFeedback(error.message);
		}
	}

	async handleBarberRemove(event) {
		try {
			await removeBarber(event.detail.id);
			await this.renderBarbers();
		} catch (error) {
			this.form.showFeedback(error.message);
		}
	}

	async renderBarbers() {
		try {
			this.list.render(await getBarbers());
		} catch (error) {
			this.list.showError(error.message);
		}
	}
}

customElements.define("barber-management", BarberManagement);
