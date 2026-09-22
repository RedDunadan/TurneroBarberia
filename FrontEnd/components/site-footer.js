class SiteFooter extends HTMLElement {
	connectedCallback() {
		this.innerHTML = `
			<footer>
				<strong>Norte Barber Studio</strong>
				<span>Palermo · Belgrano &nbsp; | &nbsp; Lun a Sáb, 10 a 20 hs</span>
				<span>© 2026 Norte</span>
			</footer>
		`;
	}
}

customElements.define("site-footer", SiteFooter);
