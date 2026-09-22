class ProcessSection extends HTMLElement {
	connectedCallback() {
		this.innerHTML = `
			<section class="process" id="proceso" aria-labelledby="process-title">
				<div class="process-inner">
					<div class="section-heading">
						<h2 id="process-title">Reservar es<br>así de simple.</h2>
						<p>Tu próximo turno empieza con tres decisiones. Sin llamados, sin esperas.</p>
					</div>
					<div class="steps">
						<article class="step">
							<strong>01</strong>
							<h3>Elegí el servicio</h3>
							<p>Contanos qué necesitás y en qué local preferís atenderte.</p>
						</article>
						<article class="step">
							<strong>02</strong>
							<h3>Elegí tu horario</h3>
							<p>Compará los horarios disponibles de nuestros barberos.</p>
						</article>
						<article class="step">
							<strong>03</strong>
							<h3>Confirmá tu turno</h3>
							<p>Completá tus datos y asegurá tu lugar en pocos minutos.</p>
						</article>
					</div>
				</div>
			</section>
		`;
	}
}

customElements.define("process-section", ProcessSection);
