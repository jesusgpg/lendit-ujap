# LendIt UJAP — Design System

> Source of truth for UI work. Page-specific files in `design-system/lendit-ujap/pages/` may add rules for that page, but must not contradict the existing product identity without an explicit redesign request.

**Product:** Campus peer-to-peer lending and rental marketplace for UJAP students and professors.
**Stack:** Vue 3, TypeScript, Vue Router, Pinia, vanilla CSS.
**Design dials:** Balanced visual variety (6/10), subtle motion (3/10), standard density (5/10).

## Product experience

Help campus members quickly find useful objects, understand who can borrow them and when, request a loan or rental, and manage the handoff and return. Core screens include landing, catalog, publishing, publications, requests/loans, account settings, and administrative management.

- Make catalog search and category filtering clear. Each listing should make availability, owner, loan/rental mode, dates/terms, and price (when applicable) easy to scan.
- In request and loan flows, keep the item, parties, date range, status, and next action together. Give clear loading, empty, success, and error feedback.
- Use visible form labels and field-level validation. Preserve entered values after recoverable errors.
- Clearly describe payment as simulated; there is no real payment processing currently.
- Never invent inventory counts, users, reviews, ratings, testimonials, or other social proof.
- Keep catalog and account workflows easy to use on mobile. Preserve working routes, deep links, and back navigation.
- Admin screens can be compact and information-dense, with clear permissions and confirmation for destructive actions.

## Existing visual identity — preserve it

The implemented tokens in `src/style.css` are authoritative. Do not introduce a parallel palette or replace these fonts as part of ordinary feature work.

- **Display:** `--display` → Fraunces, with system serif fallbacks, for headings.
- **Interface:** `--sans` → Archivo, with system sans-serif fallbacks.
- **Metadata:** `--mono` → IBM Plex Mono for compact technical labels only.
- **Brand colors:** `--crimson`, `--gold`, and `--navy`, including their dark-theme and color-vision variants.
- **Surfaces/text:** `--paper`, `--paper-2`, `--paper-3`, `--ink`, `--ink-soft`, and `--ink-faint`.
- Preserve the existing light mode, dark mode (`data-theme="dark"`), and color-vision mode (`data-colorblind`). Use the semantic variables rather than raw colors in components.

Do not apply generic academic journal, newsletter, publication archive, or subscriber-signup patterns. LendIt is a transactional campus marketplace; the actual app screens and their workflows determine layout.

## Interaction and accessibility

- Use semantic buttons, links, headings, forms, and landmarks; all interactions must work with a keyboard and show a visible focus state.
- Keep labels visible, errors near the relevant fields, and success/error/loading feedback understandable.
- Meet WCAG AA contrast for text where possible and never rely on color alone to communicate status.
- Respect `prefers-reduced-motion`. Use motion to confirm state or support spatial continuity, not as decoration.
- Check layouts at narrow phone, tablet, and desktop widths; avoid horizontal overflow and controls hidden by fixed navigation.
- Keep touch targets comfortable, especially for primary actions and item-card controls.

## Skill workflow

1. Read this file and the existing component/view before making visual changes.
2. Use `ui-ux-pro-max` for UX/accessibility and Vue-specific decisions. Search the smallest relevant domain or stack query; validate the recommendation against the existing product and tokens.
3. Use `design-taste-frontend` for new or redesigned public pages and app screens. Follow its matching page/app workflow and inspect the actual rendered result where possible.
4. Use `emil-design-eng` for interaction and motion polish when relevant.
5. Keep the current brand unless the user explicitly requests a rebrand. Do not install dependencies unless needed and requested by the implementation task.
