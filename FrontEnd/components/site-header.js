class SiteHeader extends HTMLElement {
	connectedCallback() {
		this.innerHTML = `
			<header class="site-header">
				<nav class="nav" aria-label="Navegación principal">
					<a class="brand" href="Index.html">
						<span class="brand-mark">N</span> Norte Barber
					</a>
					<div class="nav-links">
						<a href="#servicios">Servicios</a>
						<a href="#proceso">Cómo funciona</a>
						<a class="nav-cta" href="#reservar">Reservar turno</a>
					</div>
				</nav>
			</header>
		`;
	}
}

customElements.define("site-header", SiteHeader);
