# Frontend redesign

## Direction

Reference: https://consilio-template.webflow.io/ (the public site behind the supplied Webflow preview).

Full visual overhaul, preserving route slugs, form actions, field order, authentication, and data access. Existing uncommitted application changes were retained.

The reference uses photographic full-width heroes, a floating pale navigation bar, editorial serif headings, light green surfaces, and lime actions. Qayam adapts these to existing licensed Hunza photography. The seal and wordmark shapes remain intact; their colors follow the new palette.

Design variance: 6/10. Motion intensity: 3/10. Visual density: 3/10. Native CSS and the existing Tailwind foundation; no additional runtime dependencies. Marketing/account display type uses Libre Caslon Display through next/font. Product forms retain Geist and existing Urdu support. The application's existing light-only decision D-16 remains in force.

## Shared rules

- Dark green text and accessible text links; lime buttons with dark labels.
- Pill actions, 16px panels/media, 8px fields.
- Restrained entry motion, focus indicators, and reduced-motion support.
- Account pages share the editorial shell. Photos are omitted on narrow screens so forms remain prominent.
- Dashboard navigation is light, summary panels use a two-column desktop grid, and status badges are unrotated.
- No changes to booking, payment, upload, authentication, or organization logic.

## Review

Desktop and mobile browser review covers landing, account pages, onboarding, dashboard, properties, photos, knowledge base, and settings. Temporary local fixtures are removed after review. Build, lint, existing tests, and Lighthouse are used for validation; final run outcomes are reported in the handoff.

Validation on 2026-09-25:
- Production build, TypeScript, ESLint and whitespace checks passed.
- All 102 existing tests passed across the full run and targeted rerun. Four local Supabase tests initially encountered timeouts/clock timing; all 36 tests in those files passed sequentially with a 120-second timeout. The final 29 affected component/token tests also passed.
- Browser checks found no horizontal overflow at 1440px and 390px across the implemented routes. Password reveal and actual login were exercised; test accounts were deleted.
- Text contrast: primary action 10.04:1, body secondary 5.49:1, text links 7.65:1, secondary text on pale green 4.80:1.
- Hidden account photography is intentionally omitted on mobile.
- Lighthouse landing-page scores: accessibility 100/100 and best practices 100/100. The audit generated its report successfully; its Windows temporary-directory cleanup reported EPERM afterward. An unscored experimental label check flags the decorative Urdu logo glyph, which is intentionally aria-hidden while the link is named Qayam home.
- Removed unsupported component re-exports from Next.js route modules; tests import the component files directly. This fixes the generated route-type checks without changing route behavior.

## Dashboard workspace follow-up

The dashboard now uses a full-width workspace with 28px desktop gutters, a 236px collapsible sidebar (80px collapsed), and a shared top bar. Collapse preference persists locally. Mobile navigation links directly to implemented pages; Inbox and Calendar are marked as upcoming rather than linking to missing routes.

Overview includes property and 7/30/90-day filters, confirmed booking value, request counts, occupied property nights, published properties, an interactive activity chart, a status breakdown, recent bookings, upcoming stays, attention counts, and property performance. Figures come from authenticated, organization-scoped reads with pagination; read failures surface through the error boundary instead of displaying false zeros.

Definitions: value uses confirmed bookings created in the selected period, not money received. Occupancy uses unique confirmed property nights, excludes checkout day, and divides by the current selected property inventory. All reporting dates use Asia/Karachi. No fake trends or sample bookings are added to user accounts. Unread tracking remains explicitly unavailable.

Property management includes name search, status filters, portfolio totals, and empty-filter recovery. Organization settings use a two-column explanatory/form layout. Workspace CSS is scoped separately from the accepted landing and account designs.
- Validation: analytics/navigation/property tests passed (10 tests), lint and production build passed. Browser review covers empty and populated data, 1536px desktop, 390px mobile and 768px tablet, period/property filtering, chart inspection, directory search/status filters, and persisted sidebar collapse. Temporary local users and their data are deleted after review.
