import "./admin-login.js";
import "../barbers/barber-management.js";
import { isAdminAuthenticated, logoutAdmin } from "../../data/admin-auth.js";

class AdminPage extends HTMLElement {
	connectedCallback() {
		this.render();
		this.addEventListener("admin-login", () => this.render());
	}

	render() {
		if (!isAdminAuthenticated()) {
			this.innerHTML = "<admin-login></admin-login>";
			return;
		}

		this.innerHTML = `
			<header class="admin-header">
				<a class="brand admin-brand" href="Index.html"><span class="brand-mark">N</span> Norte Barber</a>
				<div class="admin-header-actions">
					<span class="admin-status">Administrador</span>
					<button class="button admin-logout" type="button">Cerrar sesión</button>
				</div>
			</header>
			<main class="admin-main">
				<barber-management></barber-management>
			</main>
		`;
		this.querySelector(".admin-logout").addEventListener("click", () => {
			logoutAdmin();
			this.render();
		});
	}
}

customElements.define("admin-page", AdminPage);
