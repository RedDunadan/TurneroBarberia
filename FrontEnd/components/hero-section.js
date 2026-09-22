class HeroSection extends HTMLElement {
	connectedCallback() {
		this.innerHTML = `
			<section class="hero" aria-labelledby="hero-title">
				<div class="hero-content">
					<div class="eyebrow">Barbería contemporánea · Buenos Aires</div>
					<h1 id="hero-title">Tu estilo.<br>Tu momento.</h1>
					<p class="hero-copy">Cortes precisos, barba prolija y una pausa que se disfruta. Elegí tu servicio y encontrá el horario que mejor va con vos.</p>
					<a class="button button-primary" href="#reservar">Encontrar un horario <span class="arrow">↗</span></a>
				</div>
			</section>
		`;
	}
}

customElements.define("hero-section", HeroSection);
