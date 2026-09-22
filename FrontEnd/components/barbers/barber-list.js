import { WEEK_DAYS } from "../../data/barber-config.js";

class BarberList extends HTMLElement {
	connectedCallback() {
		this.innerHTML = `
			<div class="list-header">
				<h3>Barberos cargados</h3>
				<span class="barber-count">0</span>
			</div>
			<div class="barber-list" aria-live="polite"></div>
		`;
		this.list = this.querySelector(".barber-list");
	}

	render(barbers) {
		this.querySelector(".barber-count").textContent = barbers.length;
		this.list.replaceChildren();

		if (!barbers.length) {
			const emptyState = document.createElement("p");
			emptyState.className = "empty-barbers";
			emptyState.textContent = "Todavía no agregaste ningún barbero.";
			this.list.append(emptyState);
			return;
		}

		barbers.forEach((barber) => this.list.append(this.createBarberItem(barber)));
	}

	createBarberItem(barber) {
		const item = document.createElement("article");
		item.className = "barber-item";
		item.innerHTML = `
			<div>
				<h4></h4>
				<p class="barber-meta"></p>
				<p class="barber-schedule"></p>
			</div>
			<button class="remove-barber" type="button" aria-label="Eliminar barbero">×</button>
		`;
		item.querySelector("h4").textContent = barber.name;
		item.querySelector(".barber-meta").textContent = `${barber.location[0].toUpperCase()}${barber.location.slice(1)}`;
		item.querySelector(".barber-schedule").textContent = `${barber.days.map((day) => WEEK_DAYS.find((itemDay) => itemDay.value === day)?.label).join(" · ")}  |  ${barber.start} a ${barber.end}`;
		item.querySelector(".remove-barber").addEventListener("click", () => {
			this.dispatchEvent(new CustomEvent("barber-remove", { bubbles: true, detail: { id: barber.id } }));
		});
		return item;
	}
}

customElements.define("barber-list", BarberList);
