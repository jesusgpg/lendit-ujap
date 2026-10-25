<!-- postman-cli:installation:start -->
Postman CLI is installed on this device, and can be used for API Engineering work.
<!-- postman-cli:installation:end -->

## UI/UX and frontend design

- For UI design or implementation tasks, read `design-system/lendit-ujap/MASTER.md` first and preserve the visual tokens and product conventions in `src/style.css`.
- Use the project skill `ui-ux-pro-max` for product UX decisions, accessibility checks, responsive behavior, and Vue-specific guidance. Its search script is `.agents/skills/ui-ux-pro-max/scripts/search.py`; use the narrowest relevant query and never persist unverified suggestions.
- Use `design-taste-frontend` for building or redesigning public pages and app screens. Follow the applicable workflow in its `SKILL.md` and app-screen reference. For an existing screen, audit the current UI first and preserve working product flows.
- Use `emil-design-eng` for final interaction and visual polish when the task involves interface craft or animation. Respect reduced-motion preferences.
- Treat the existing brand system as authoritative: Fraunces headings, Archivo interface text, IBM Plex Mono for compact metadata; crimson/gold/navy semantic tokens; light, dark, and color-vision palettes.
- LendIt is a campus lending/rental marketplace. Do not add newsletter/journal patterns or fabricate inventory metrics, users, reviews, testimonials, or payment completion. Payments are simulated unless the implementation changes.
- Do not add dependencies or modify design system tokens unless the task calls for it. Keep controls keyboard accessible, labels visible, feedback clear, and layouts usable on mobile.
