# Resource Library Unlock Design

## Goal

Turn the resource detail experience into a lead-generation flow: visitors can preview useful content, submit their business contact details once, and then read all gated WEI LAN resources in the same browser without submitting another form.

The first implementation is a production-quality sample on `Project Inquiry Checklist`. It establishes the shared unlock behavior for the whole resource library without inventing unverified content for the other six resources.

## Confirmed Scope

In scope:

- Expand `Project Inquiry Checklist` from a summary page into a useful preview and full checklist.
- Gate part of that checklist behind a compact business-contact form.
- Require `Name`, `Work Email`, and `Company`.
- Send the resource lead to the existing sales inbox through a dedicated Cloudflare Pages Function.
- Unlock only after the API confirms successful delivery.
- Store one versioned, library-wide unlock flag in the browser.
- Make the shared unlock state reusable by every resource detail page.
- Add a `More Resources` button to the `/resources` hub.
- Send that button to `/contact?source=resources&request=more-resources`.
- Prefill the contact form's project-details field from those query parameters without overriding product interest.
- Update source content, generated pages, shared styles and scripts, and focused automated tests.

Out of scope for this sample:

- Writing complete content for the other six resource detail pages.
- Creating or downloading PDF, Word, or presentation files. None currently exist in the repository.
- User accounts, passwords, server-side sessions, or strong content access control.
- Saving name, email, or company in local storage.
- Changing the general project inquiry form's existing required-field rules.

## Source Of Truth

The editable page content lives in `src/content/en/*.json` and is rendered through the Nunjucks build system. Implementation must update those source files and run the site build; generated files under `public/` must not be treated as the only source of truth.

The initial content change belongs in:

- `src/content/en/resource-inquiry-checklist.json`
- `src/content/en/resources.json`
- `src/content/en/contact.json` only if static markup is required for the query-driven state

Shared behavior belongs in `public/script.js` unless the implementation plan identifies an existing build-managed asset source. Shared visual rules belong in `public/styles.css`.

## User Experience

### Resource Detail Page

The existing hero remains unchanged in structure and tone:

- Resource eyebrow and title
- Buyer-oriented summary
- Type, updated date, buyer fit, and review-time metadata

Below the hero, the page uses the existing two-column resource layout.

The main column contains:

- A short introduction explaining how to use the inquiry checklist.
- The first two checklist topics as the free preview.
- A clear transition into gated content.
- The remaining checklist topics and practical submission guidance.

When locked, the content after the preview is height-limited and visually fades into the site background. The fade communicates that more content exists without displaying a decorative modal or blocking the rest of the page.

The secondary column contains a gated-resource panel using the site's existing dark panel, border, typography, field, and primary-button language. It contains:

- Heading: `Unlock all resources`
- Supporting copy stating that one submission unlocks the whole resource library in this browser.
- Required `Name` field.
- Required `Work Email` field.
- Required `Company` field.
- Submit button: `Unlock all resources`.
- A short privacy/contact notice.
- Inline status text for validation, sending, success, and failure.

After successful submission:

- The complete checklist expands in place.
- The fade and locked presentation are removed.
- The form is replaced by a compact `All resources unlocked` confirmation.
- The related-resources section remains in its current position below the content.

On mobile, content and form become one column. The form appears immediately after the free preview and before the gated continuation, so users do not scroll through inaccessible content.

### Resource Hub

The existing resource library remains the primary content. A `More Resources` button is added in the existing resource-library action area using the site's established secondary action style. It links to:

`/contact?source=resources&request=more-resources`

The wording must be concise and must not imply that a download is already available.

### Contact Page

When both expected query parameters are present, the contact page pre-populates `Project Details` with a short request such as:

`I would like to receive more WEI LAN resource materials.`

The visitor still selects the relevant product interest and may edit the message. Normal visits to `/contact` are unchanged.

## Complete Checklist Content

The sample may expand only information already requested or described elsewhere on the site. It must not invent product performance claims, model parameters, project results, certifications, or support commitments.

The full checklist should organize the known inquiry inputs into these sections:

1. Waste type and material composition
2. Target capacity and operating schedule
3. Site footprint, country, voltage, and installation restrictions
4. Expected output products and quality targets
5. Material photos, videos, and current process
6. Project stage, timeline, and required documents

Each section should explain what information to prepare and why it helps the first engineering review. The final section should direct visitors to the normal project inquiry form for an engineering proposal.

## Unlock State

Use this single versioned local-storage key for the entire library:

`weilan_resources_unlocked_v1`

The stored value contains only the unlock version or a boolean-equivalent value. It must not contain the visitor's name, email address, company, submitted page, or other personal information.

On page initialization:

1. Read the shared key defensively.
2. If the key indicates the current version, render the resource as unlocked immediately.
3. If storage is unavailable or malformed, keep the default locked state without breaking the page.

After a successful API response:

1. Apply the unlocked UI state immediately.
2. Attempt to store the shared unlock key.
3. If storage fails, keep the current page unlocked for the session and do not turn a successful submission into a visible error.

All future gated resource pages use the same key and state helper. Incrementing the key version is the explicit mechanism for invalidating old unlocks after a material change to the lead flow.

## Resource Lead API

Add the dedicated endpoint `POST /api/resource-unlock`, rather than weakening or overloading `/api/contact`.

Request body:

```json
{
  "name": "Required visitor name",
  "email": "Required work email",
  "company": "Required company name",
  "resource": "Project Inquiry Checklist",
  "sourcePath": "/resources/project-inquiry-checklist"
}
```

Validation rules:

- Content type must be JSON.
- `name`, `email`, and `company` are trimmed, non-empty strings with bounded lengths.
- `email` must pass the same practical email validation used by the contact endpoint.
- `resource` and `sourcePath` are required, bounded strings used for sales context.
- HTML output must escape all submitted values.

Delivery:

- Reuse `RESEND_API_KEY`, `CONTACT_TO_EMAIL`, and `CONTACT_FROM_EMAIL`.
- Use the visitor's email as `reply_to`.
- Use a subject that clearly identifies a resource unlock lead.
- Include all submitted fields in HTML and plain-text email bodies.

Response behavior:

- `200` with `{ "ok": true }` only after Resend accepts the email.
- `400` for malformed or invalid visitor input.
- `500` for missing server configuration or delivery failure.
- Do not expose API keys, provider response bodies, or internal stack details to the browser.

No database is introduced. The sales email is the lead record, matching the current site's operating model.

## Client Behavior

Resource unlock logic is progressively enhanced:

- The full checklist remains present in semantic HTML for the approved soft-gate approach.
- A root locked class is applied early enough to avoid a visible flash of gated content.
- JavaScript handles shared-state detection, form validation, submission, and UI state changes.
- Submitting disables the button and shows a sending message.
- Client validation focuses the first invalid field and provides concise inline feedback.
- API failure preserves entered values, re-enables submission, displays a retryable error, and does not create the unlock key.
- Repeated submit clicks cannot issue parallel requests.
- The unlock form and the existing contact form use separate data attributes and handlers.

This is a marketing soft gate, not a security boundary. A technically capable visitor can inspect content already present in HTML. That trade-off is intentional and keeps the static site simple.

## Accessibility

- All form controls have visible labels.
- All three fields use native required semantics.
- Email uses `type="email"` and appropriate autocomplete values.
- Status messages use `role="status"` and `aria-live="polite"`.
- Locked visual treatment must not put keyboard-focusable controls inside hidden or blurred content.
- Unlocking returns focus to the confirmation heading or the start of newly available content without forcing unexpected page movement.
- Color is not the sole signal for locked, sending, failed, or unlocked states.
- The layout retains the existing visible focus treatment and mobile breakpoints.

## Search And Privacy Behavior

The soft gate should not remove the page's title, introduction, headings, or buyer-focused summary from the HTML. The sample remains an indexable resource page.

Because the full text is also present in HTML, search crawlers may index it. This matches the chosen soft-gate approach and should be treated as an SEO benefit rather than access protection.

The page must clearly state that submitted business details may be used by WEI LAN to follow up about resources. No visitor contact fields are persisted in the browser.

## Testing And Verification

### Automated tests

Add focused coverage for:

- The checklist source contains the preview, unlock form, and all six confirmed checklist topics.
- The generated English checklist page retains its canonical URL, hero metadata, related resources, and new gated structure.
- Name, work email, and company are required.
- The resource hub includes `More Resources` with the approved query-string destination.
- Contact query handling pre-fills only the expected resource request.
- The lead endpoint rejects missing fields and invalid email.
- The lead endpoint escapes submitted content and produces both email formats.
- The lead endpoint returns failure when delivery fails.
- The shared unlock helper uses one versioned library key and stores no personal fields.
- Successful submission unlocks and persists the state.
- Failed submission does not unlock or persist the state.
- A reload with the key already present starts unlocked.
- A storage exception does not break page rendering.

### Repository verification

- Run the site build.
- Run the generated-site check.
- Run the Node test suite.
- Run focused browser tests for locked, error, successful, persisted, and query-prefill states.
- Inspect the checklist and resource hub at desktop and mobile viewports.
- Confirm there is no overlapping content, clipped form text, layout shift, or inaccessible gated control.

## Acceptance Criteria

- `Project Inquiry Checklist` provides a meaningful free preview and a complete, site-aligned checklist after unlock.
- The unlock form requires name, valid work email, and company.
- A successful resource lead email is required before unlocking.
- One successful submission unlocks the current page and establishes the reusable library-wide state for the browser.
- The browser stores no submitted personal information.
- Refreshing the page preserves the unlocked state.
- Delivery or validation failure never unlocks the resource.
- The visual design uses the existing WEI LAN typography, palette, spacing, panels, buttons, field treatments, and responsive behavior.
- `/resources` includes a `More Resources` button that opens the contact page with the approved source parameters.
- The contact form recognizes the resource request without changing unrelated contact-page behavior.
- Other resource pages receive no invented full content in this sample.
