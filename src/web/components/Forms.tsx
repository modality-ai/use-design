import { useState } from 'react'

export function Forms() {
  const [selected, setSelected] = useState('option1')

  return (
    <section id="forms" class="section">
      <div class="section-inner">
        <h2 class="section-heading">Forms</h2>
        <p class="section-description">
          Input components designed for clarity and ease of use.
          Every interaction provides clear feedback.
        </p>

        <div class="form-showcase">
          <div class="form-group">
            <label class="form-label" for="input-text">Text Input</label>
            <input id="input-text" class="form-input" type="text" placeholder="Enter your name" />
          </div>

          <div class="form-group">
            <label class="form-label" for="input-email">Email</label>
            <input id="input-email" class="form-input" type="email" placeholder="name@example.com" />
          </div>

          <div class="form-group">
            <label class="form-label" for="input-disabled">Disabled</label>
            <input id="input-disabled" class="form-input" type="text" placeholder="Cannot edit" disabled />
          </div>

          <div class="form-group">
            <label class="form-label" for="input-search">Search</label>
            <input id="input-search" class="form-search" type="search" placeholder="Search..." />
          </div>

          <div class="form-group">
            <label class="form-label" for="input-select">Select</label>
            <select id="input-select" class="form-select">
              <option>Choose an option</option>
              <option>Option A</option>
              <option>Option B</option>
              <option>Option C</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label" for="input-textarea">Textarea</label>
            <textarea id="input-textarea" class="form-textarea" rows={3} placeholder="Write something..." />
          </div>

          <div class="form-group">
            <span class="form-label">Radio Group</span>
            <div class="form-radio-group">
              {['option1', 'option2', 'option3'].map((opt, i) => (
                <label class="form-radio-label" key={opt}>
                  <input
                    type="radio"
                    name="radio-demo"
                    class="form-radio"
                    value={opt}
                    checked={selected === opt}
                    onChange={() => setSelected(opt)}
                  />
                  <span class="form-radio-text">Option {i + 1}</span>
                </label>
              ))}
            </div>
          </div>

          <div class="form-group">
            <label class="form-checkbox-label">
              <input type="checkbox" class="form-checkbox" />
              <span class="form-checkbox-text">I agree to the terms and conditions</span>
            </label>
          </div>

          <div class="form-group">
            <button class="btn-primary" type="button">Submit</button>
          </div>
        </div>
      </div>
    </section>
  )
}
