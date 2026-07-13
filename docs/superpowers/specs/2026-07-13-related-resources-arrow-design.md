# Related Resources Arrow Design

## Goal

Make the arrow beside `Explore` in every resource detail page's Related Resources cards match the arrow used beside `Read more` on `public/resources.html`.

## Scope

- Update all seven resource detail pages under `public/resources/`.
- Keep the Related Resources card layout, destinations, title styling, and `Explore` typography unchanged.
- Replace the current generated `Explore ->` cue with an explicit, reusable CTA element.
- Do not change unrelated resource-library or site-wide link styles.

## Chosen Design

Each Related Resources link will contain this presentational CTA after its resource title:

```html
<span class="resource-related-cta" aria-hidden="true">Explore</span>
```

The CTA will remain aligned to the lower-right corner of the card. Its `Explore` label will retain the existing uppercase size and weight. The CTA pseudo-element will render only the arrow, allowing it to reuse the `Read more` arrow behavior independently from the label:

- Unicode arrow: `→`
- Gap from label: `8px`
- Default arrow color: `rgba(66, 215, 223, 0.72)`
- Transition duration: `160ms`
- Hover color: `var(--color-cyan)`
- Hover movement: `translateX(4px)`

The `aria-hidden` attribute keeps the card's accessible name focused on the destination title rather than appending the decorative `Explore` cue.

## CSS Structure

- Remove the current `.resource-related-grid a::after` rule that generates `Explore ->`.
- Add `.resource-related-cta` for CTA placement and existing label typography.
- Group `.resource-related-cta::after` with `.resource-read-more::after` for the shared arrow glyph, color, and transition.
- Update the Related Resources hover selector so the CTA label changes color while only the arrow moves horizontally.
- Preserve the existing full-card hover, focus-visible, grid, and responsive behavior.

## Verification

- Update `tools/check-related-resources-affordance.js` first and confirm it fails against the current implementation.
- Verify all seven resource detail pages contain four `.resource-related-cta` elements with `aria-hidden="true"`.
- Verify the obsolete `Explore ->` generated content is absent.
- Verify the CTA arrow shares the `Read more` glyph, gap, color, transition, and hover movement rules.
- Run the repository check after implementation and confirm it passes.
- Inspect at desktop and mobile widths to confirm alignment, wrapping, focus indication, and stable card dimensions.

## Acceptance Criteria

- Every Related Resources card displays `Explore →`.
- The arrow visually and behaviorally matches the `Read more` arrow.
- Hover moves only the arrow, not the `Explore` label.
- Link targets, keyboard focus, card layout, and responsive breakpoints remain unchanged.
