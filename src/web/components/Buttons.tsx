export function Buttons() {
  return (
    <section id="buttons" class="section section-dark">
      <div class="section-inner">
        <h2 class="section-heading section-heading-on-dark">Buttons</h2>
        <p class="section-description section-description-on-dark">
          Interactive elements with clear hierarchy. Primary actions stand out,
          secondary actions complement, and links invite exploration.
        </p>

        <div class="button-showcase">
          <div class="button-group">
            <h3 class="button-group-title">Primary</h3>
            <div class="button-row">
              <button class="btn-primary">Get started</button>
              <button class="btn-primary" disabled>Disabled</button>
            </div>
          </div>

          <div class="button-group">
            <h3 class="button-group-title">Secondary</h3>
            <div class="button-row">
              <button class="btn-secondary">Learn more</button>
              <button class="btn-secondary" disabled>Disabled</button>
            </div>
          </div>

          <div class="button-group">
            <h3 class="button-group-title">Pill Outline</h3>
            <div class="button-row">
              <a href="#" class="btn-pill-outline">Learn more</a>
              <a href="#" class="btn-pill-outline-dark">Shop</a>
            </div>
          </div>

          <div class="button-group">
            <h3 class="button-group-title">Text Links</h3>
            <div class="button-row">
              <a href="#" class="link-primary">Primary link &rsaquo;</a>
              <a href="#" class="link-on-dark">Link on dark &rsaquo;</a>
            </div>
          </div>

          <div class="button-group">
            <h3 class="button-group-title">Sizes</h3>
            <div class="button-row">
              <button class="btn-primary btn-sm">Small</button>
              <button class="btn-primary">Default</button>
              <button class="btn-primary btn-lg">Large</button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
