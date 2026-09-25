import { loginAdmin } from "../../data/admin-auth.js";

class AdminLogin extends HTMLElement {
	connectedCallback() {
		this.innerHTML = `
			<section class="admin-login" aria-labelledby="admin-login-title">
				<div class="admin-login-mark">N</div>
				<span class="section-kicker">Acceso privado</span>
				<h1 id="admin-login-title">Panel de<br>administración.</h1>
				<p>Ingresá para gestionar los barberos, sus locales y sus horarios de trabajo.</p>
				<form class="login-form" id="login-form">
					<div class="field">
						<label for="admin-username">Usuario</label>
						<input id="admin-username" name="usuario" type="text" autocomplete="username" required>
					</div>
					<div class="field">
						<label for="admin-password">Contraseña</label>
						<input id="admin-password" name="clave" type="password" autocomplete="current-password" required>
					</div>
					<button class="button button-primary" type="submit">Ingresar <span class="arrow">→</span></button>
					<p class="login-feedback" role="alert" aria-live="polite"></p>
				</form>
				<a class="back-link" href="./Index.html">← Volver al sitio</a>
			</section>
		`;

		this.form = this.querySelector("#login-form");
		this.form.addEventListener("submit", (event) => this.handleSubmit(event));
	}

	async handleSubmit(event) {
		event.preventDefault();
		const formData = new FormData(this.form);
		const isValid = await loginAdmin(formData.get("usuario"), formData.get("clave"));

		if (!isValid) {
			this.querySelector(".login-feedback").textContent = "Usuario o contraseña incorrectos.";
			return;
		}

		this.dispatchEvent(new CustomEvent("admin-login", { bubbles: true }));
	}
}

customElements.define("admin-login", AdminLogin);
