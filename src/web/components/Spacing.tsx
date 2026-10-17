export function Spacing() {
  const spacingScale = [
    { name: '2xs', size: '2px' },
    { name: 'xs', size: '4px' },
    { name: 'sm', size: '8px' },
    { name: 'md', size: '16px' },
    { name: 'lg', size: '24px' },
    { name: 'xl', size: '32px' },
    { name: '2xl', size: '48px' },
    { name: '3xl', size: '64px' },
    { name: '4xl', size: '96px' },
  ]

  const radiusScale = [
    { name: 'Small', cssClass: 'radius-sm' },
    { name: 'Medium', cssClass: 'radius-md' },
    { name: 'Large', cssClass: 'radius-lg' },
    { name: 'Pill', cssClass: 'radius-pill' },
  ]

  return (
    <section id="spacing" class="section section-dark">
      <div class="section-inner">
        <h2 class="section-heading section-heading-on-dark">Spacing</h2>
        <p class="section-description section-description-on-dark">
          A consistent spacing scale creates visual rhythm and hierarchy.
          Border radius defines the softness of the interface.
        </p>

        <div class="spacing-showcase">
          <div class="spacing-group">
            <h3 class="spacing-group-title">Scale</h3>
            <div class="spacing-bars">
              {spacingScale.map((s) => (
                <div class="spacing-bar-row" key={s.name}>
                  <span class="spacing-bar-label">{s.name}</span>
                  <div class="spacing-bar" style={{ width: s.size }} />
                  <span class="spacing-bar-value">{s.size}</span>
                </div>
              ))}
            </div>
          </div>

          <div class="spacing-group">
            <h3 class="spacing-group-title">Border Radius</h3>
            <div class="radius-samples">
              {radiusScale.map((r) => (
                <div class="radius-sample" key={r.name}>
                  <div class={`radius-box ${r.cssClass}`} />
                  <span class="radius-label">{r.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
