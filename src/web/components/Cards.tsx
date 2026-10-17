export function Cards() {
  return (
    <section id="cards" class="section section-alt">
      <div class="section-inner">
        <h2 class="section-heading">Cards</h2>
        <p class="section-description">
          Content containers with clear visual hierarchy.
          From product showcases to informational tiles.
        </p>

        <div class="card-showcase">
          <div class="card-row-info">
            <div class="card card-product" style={{ boxShadow: '0 2px 12px var(--color-shadow)' }}>
              <div class="card-image" style={{ background: 'var(--color-accent)' }}>
                <span class="card-image-label" style={{ color: 'var(--color-text-on-dark)', opacity: '0.18' }}>A</span>
              </div>
              <div class="card-body">
                <h3 class="card-title">Aurora</h3>
                <p class="card-description">Light reimagined. A breakthrough in visual technology for the modern era.</p>
                <div class="card-links">
                  <a href="#" class="link-primary">Learn more &rsaquo;</a>
                  <a href="#" class="link-primary">Shop &rsaquo;</a>
                </div>
              </div>
            </div>

            <div class="card card-product" style={{ boxShadow: '0 2px 12px var(--color-shadow)' }}>
              <div class="card-image" style={{ background: 'var(--color-bg-secondary)' }}>
                <span class="card-image-label" style={{ color: 'var(--color-accent)', opacity: '0.25' }}>V</span>
              </div>
              <div class="card-body">
                <h3 class="card-title">Vertex</h3>
                <p class="card-description">Peak performance. Engineered for the impossible with precision components.</p>
                <div class="card-links">
                  <a href="#" class="link-primary">Learn more &rsaquo;</a>
                  <a href="#" class="link-primary">Shop &rsaquo;</a>
                </div>
              </div>
            </div>

            <div class="card card-product" style={{ boxShadow: '0 2px 12px var(--color-shadow)' }}>
              <div class="card-image" style={{ background: 'var(--color-bg-surface)' }}>
                <span class="card-image-label" style={{ color: 'var(--color-text-on-dark)', opacity: '0.18' }}>N</span>
              </div>
              <div class="card-body">
                <h3 class="card-title">Nova</h3>
                <p class="card-description">The next generation. Redefining what a design system can achieve.</p>
                <div class="card-links">
                  <a href="#" class="link-primary">Learn more &rsaquo;</a>
                  <a href="#" class="link-primary">Shop &rsaquo;</a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
