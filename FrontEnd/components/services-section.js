class ServicesSection extends HTMLElement {
	connectedCallback() {
		this.innerHTML = `
			<section class="section" id="servicios" aria-labelledby="services-title">
				<div class="section-heading">
					<h2 id="services-title">Hecho para<br>sentirte bien.</h2>
					<p>Un servicio directo, detallista y sin vueltas. Vos elegís cómo querés salir; nosotros nos ocupamos del resto.</p>
				</div>
				<div class="service-grid">
					<article class="service">
						<span class="service-number">01</span>
						<h3>Corte clásico</h3>
						<p>Degradado, tijera o máquina. Una consulta breve y un corte pensado para tu día a día.</p>
					</article>
					<article class="service">
						<span class="service-number">02</span>
						<h3>Corte + barba</h3>
						<p>El combo completo para salir renovado, con una terminación que se nota en los detalles.</p>
					</article>
					<article class="service">
						<span class="service-number">03</span>
						<h3>Arreglo de barba</h3>
						<p>Perfilado, toalla caliente y el balance justo entre definición y naturalidad.</p>
					</article>
				</div>
			</section>
		`;
	}
}

customElements.define("services-section", ServicesSection);
