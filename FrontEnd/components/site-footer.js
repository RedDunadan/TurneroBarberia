class SiteFooter extends HTMLElement {
	connectedCallback() {
		this.innerHTML = `
			<footer>
				<strong>Norte Barber Studio</strong>
				<span>Palermo · Belgrano &nbsp; | &nbsp; Lun a Sáb, 10 a 20 hs</span>
				<a class="admin-access-link" href="./admin.html">Acceso administrador</a>
				<span>© 2026 Norte</span>
			</footer>
		`;
	}
}

customElements.define("site-footer", SiteFooter);
