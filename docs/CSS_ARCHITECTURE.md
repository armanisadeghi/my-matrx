# 🎨 CSS Architecture for Client Sites

## Overview

CSS is organized in a cascading hierarchy to maximize reusability and minimize duplication.

## 📊 CSS Hierarchy (Order of Application)

```
1. Theme variables (client_sites.theme_config → a generated :root{} block)
   ↓
2. Global CSS (client_sites.global_css)
   ↓
3. Component CSS (client_components.css_content)
   ↓
4. Page CSS (client_pages.css_content)
   ↓
5. Inline Styles (highest priority)
```

CSS loads in this order, so later styles can override earlier ones.

Assembled by `buildCombinedCss` in `lib/render/cascade.js` (the renderer just calls it).
**Mirrored server-side** in aidream (`aidream/services/cms_introspect/cascade.py` `resolve_cascade`,
which powers `cms_inspect css_cascade`) — change one and you must change the other or the tool lies
about what the site serves.

### A page that opts out of a component does not carry its CSS

`client_pages.use_client_header` / `use_client_footer` gate the component's **stylesheet** exactly as
they gate its markup. A headerless page shipping header CSS is dead bytes at best, and at worst live
rules (resets, `body` declarations) styling a header that isn't on the page.

`buildCombinedCss` owns this decision on this side, and `resolve_cascade` owns it on aidream's;
neither caller pre-gates, so each side has exactly one home for the rule. Until 2026-07-27 the
renderer gated only the markup and emitted the CSS unconditionally, so `cms_inspect css_cascade`
(which always gated) reported a cascade the live site did not serve. Enabling the gate changed only
the two `dev-website` `verify-*` fixtures — verified by diffing all 31 published pages before and
after; all 19 iopbm pages came back byte-identical, because iopbm's header/footer rows have
`css_content = NULL`. Covered by `pnpm test:render`.

---

## 🎛 Theme variables — `client_sites.theme_config` (the data IS the theme)

**Location:** `client_sites.theme_config` (JSONB) · **Code:** `lib/render/themeCss.js`

The renderer generates a `:root{}` block from this column and puts it FIRST in the cascade. Set a
color once in the database and every page gets the variable — no CSS to write, no duplication.

**Naming contract** — `theme_config.{group}.{key}` → `--{group minus a trailing "s"}-{key with `_`→`-`}`:

| `theme_config`                     | CSS custom property        |
|------------------------------------|----------------------------|
| `colors.primary_teal`              | `--color-primary-teal`     |
| `fonts.primary`                    | `--font-primary`           |
| `spacing.section`                  | `--spacing-section`        |
| `radii.card`                       | `--radii-card`             |
| a top-level scalar, e.g. `tracking`| `--tracking`               |

```json
{
  "colors": { "primary_teal": "#3BA5A5", "text_dark": "#333333" },
  "fonts":  { "primary": "-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" }
}
```
→
```css
:root {
  --color-primary-teal: #3BA5A5;
  --color-text-dark: #333333;
  --font-primary: -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif;
}
```

**Rules:**
- Only string/number values are emitted. Nested objects, `null` and empty strings are skipped.
- Values must clear a conservative allowlist: hex colors, `rgb()`/`rgba()`/`hsl()`/`hsla()`,
  `var()`/`calc()`/`min()`/`max()`/`clamp()`, numbers with units, keyword and font-family lists.
  Anything else — `url()`, gradients, `@import`, a stray `;` or `}` — is **dropped** and logged
  (`[theme_config] rejected unsafe value…`). Put those in `global_css`.
- **A hand-written `:root` in `global_css` still wins**, because it is declared later. That is why
  turning this column on changed nothing visually on any existing site — but it also means the
  duplication is now removable: delete the hand-written variables and let the data drive them.

---

## 🦶 Footer — `client_sites.footer_config` (layout) + `contact_info` / `social_links` (content)

**Location:** `client_sites.footer_config` (JSONB) · **Code:** `lib/render/siteFooter.js`

Same contract as the nav menu: **opt-in via a token**. The generated footer replaces the literal
`<!--matrx:footer-->` in a header or footer component's `html_content`. **No token → nothing is
emitted and the page is byte-identical** to before this feature existed — which is why iopbm's
hand-written `<footer>` is completely unaffected.

`footer_config` is **layout only**. The content of the contact and social blocks comes from the
columns that already own it — `contact_info` and `social_links` — so nothing is duplicated:

```json
{
  "columns": [
    { "heading": "Locations", "links": [{ "label": "Austin", "href": "/locations/austin" }] }
  ],
  "show_contact": true,  "contact_heading": "Contact",
  "show_social":  true,  "social_heading":  "Follow Us",
  "order": ["columns", "contact", "social"],
  "copyright": "© 2025 Acme, Inc.",
  "legal_links": [{ "label": "Privacy", "href": "/privacy" }]
}
```
→
```html
<!-- emitted AT the token, i.e. inside the site's own <footer> element -->
<div class="matrx-footer-cols">
  <div class="matrx-footer-col"><h3>Locations</h3><ul><li><a href="/c/acme/locations/austin">Austin</a></li></ul></div>
  <div class="matrx-footer-col"><h3>Contact</h3><ul><li>1 Main St</li><li><a href="tel:+15550102030">(555) 010-2030</a></li></ul></div>
  <div class="matrx-footer-col"><h3>Follow Us</h3><ul><li><a href="https://x.test/acme">Twitter</a></li></ul></div>
</div>
<div class="matrx-footer-bottom"><p>© 2025 Acme, Inc.</p><ul class="matrx-footer-legal">…</ul></div>
```

**Rules:**
- `{}` — the value on every site today — renders **nothing**. Populating the column is what turns it on.
- **Hrefs starting with `/` are site-relative** and get the serving surface's base path, so one
  config is correct on `/c/{slug}/…` *and* on a custom domain. Anchors, `mailto:`, `tel:` and
  absolute URLs pass through verbatim. (Contrast `navigation`, whose explicit override is used
  verbatim. iopbm's hand-written footer hard-codes `/c/iopbm/…` and would break the day it gets a
  domain — authoring `/services` and letting the renderer prefix it is the fix.)
- `show_contact` / `show_social` only *place* a block; if `contact_info` / `social_links` is empty
  the block does not appear. `contact_info` understands `{phone, phone_raw, email, address:{street,
  city, state, zip}}` — `phone_raw` supplies the `tel:` href, `phone` the display text.
  `social_links` accepts a `{platform: url}` map or a `[{platform, url}]` list.
- `copyright` omitted → `© {current year} {site name}`. Omit both name and value and no bottom bar
  is emitted at all.
- `order` sequences the column blocks. A block left out of `order` still renders (appended in the
  default order) — a typo must never silently delete a footer column.
- Every heading, label and href is **escaped server-side** and non-navigating href schemes are
  neutralized to `#`. `footer_config` is agent-authored and API-writable.
- **No inline styles, and no outer wrapper.** The blocks are emitted at the token, inside the site's
  own `<footer>`. `.matrx-footer` is deliberately NOT used — that class belongs to the `<footer>`
  element itself (aidream's starter kit emits `<footer class="matrx-footer">` and ships CSS for it),
  so a second one would double its border/padding/background. Sites style `.matrx-footer-cols`,
  `.matrx-footer-col`, `.matrx-footer-bottom` and `.matrx-footer-legal` — those names are the contract.

Covered by `pnpm test:render`; the live fixture is `dev-website` (its footer component carries the
token).

---

## 🌍 Global CSS

**Location:** `client_sites.global_css`

**What goes here:**
- CSS variables (colors, fonts, spacing)
- Reset styles
- Body and base typography
- **Header/navigation styles** (applied to all pages)
- **Footer styles** (applied to all pages)
- Utility classes (buttons, containers, grids)
- Responsive breakpoints for global elements

**Example:**
```css
:root {
  --color-primary-teal: #3BA5A5;
  --color-primary-green: #8DB85C;
  /* ... */
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto;
  color: var(--color-text-primary);
}

/* Navigation styles */
.nav-wrapper { /* ... */ }
nav { /* ... */ }
.nav-links { /* ... */ }

/* Footer styles */
footer { /* ... */ }
.footer-container { /* ... */ }

/* Utility classes */
.btn-primary { /* ... */ }
.container { /* ... */ }
```

**Benefits:**
- ✅ Write once, use everywhere
- ✅ Consistent branding across all pages
- ✅ Easy theme updates (change once, affects all pages)
- ✅ Header/footer always styled correctly

---

## 🧩 Component CSS (Optional)

**Location:** `client_components.css_content`

**What goes here:**
- Component-specific styles that override global
- Special variations of components
- Component animations/interactions

**In practice:** Keep this minimal or empty since global CSS handles most component styling.

**Example (if needed):**
```css
/* Special header variant for landing pages */
.nav-wrapper.transparent {
  background: transparent;
  box-shadow: none;
}

/* Animated footer wave effect */
footer::before {
  content: '';
  /* wave animation */
}
```

---

## 📄 Page-Specific CSS

**Location:** `client_pages.css_content`

**What goes here:**
- Styles unique to THIS page only
- Section-specific layouts (hero, about, services)
- Page-specific animations
- One-off design elements

**Example:**
```css
/* Home page hero section */
.hero {
  background: linear-gradient(135deg, var(--color-primary-teal), var(--color-primary-olive));
  padding: 5rem 2rem;
  text-align: center;
}

.hero-buttons {
  display: flex;
  gap: 1rem;
  justify-content: center;
}

/* About section (only on home page) */
.about {
  padding: 5rem 2rem;
  background: var(--color-background-subtle);
}

.about-container {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4rem;
}
```

**Benefits:**
- ✅ Keep page CSS focused and maintainable
- ✅ Easy to understand what styles affect this page
- ✅ Can override global styles if needed

---

## 🎯 Best Practices

### 1. Use CSS Variables for Consistency
Declare them in `theme_config` (above) and always reference them instead of hardcoding colors:

✅ **Good:**
```css
.my-section {
  background: var(--color-primary-teal);
  color: var(--color-text-primary);
}
```

❌ **Bad:**
```css
.my-section {
  background: #3BA5A5;
  color: #333333;
}
```

### 2. Avoid Duplicating Styles
If a style is used on multiple pages, move it to global CSS.

### 3. Use Specific Class Names
Prevent conflicts by using descriptive, unique class names:

✅ **Good:**
```css
.services-grid { }
.testimonials-container { }
.contact-form-wrapper { }
```

❌ **Bad:**
```css
.grid { }
.container { }
.wrapper { }
```

### 4. Mobile-First Responsive Design
Put mobile styles first, then use media queries for larger screens:

```css
/* Mobile styles (default) */
.hero h1 {
  font-size: 1.75rem;
}

/* Tablet and up */
@media (min-width: 768px) {
  .hero h1 {
    font-size: 2.5rem;
  }
}

/* Desktop */
@media (min-width: 1200px) {
  .hero h1 {
    font-size: 3rem;
  }
}
```

---

## 📋 Organizing CSS for IOPBM

### Current Setup:

**Global CSS** (client_sites.global_css):
- Lines 8-559 from home.html
- Variables, reset, nav, footer, utilities

**Home Page CSS** (client_pages.css_content for 'home'):
- Currently empty or minimal
- Could extract hero, about, services sections here if you want
- Or keep in global CSS if they're reusable

**Header Component CSS**:
- Empty (styled by global CSS)

**Footer Component CSS**:
- Empty (styled by global CSS)

---

## 🔄 Migration Strategy

### For Existing Pages:
1. **Identify reusable styles** → Move to global CSS
2. **Keep unique styles** → Leave in page CSS
3. **Test** → Verify all pages still look correct

### For New Pages:
1. **Start with global CSS only** → See what you already have
2. **Add page-specific styles** → Only what's unique to that page
3. **If reusable** → Consider moving to global CSS

---

## 🚀 Example: Creating a New "Services" Page

### Step 1: Create page with NO CSS
```sql
INSERT INTO client_pages (client_id, slug, title, html_content)
VALUES ('iopbm-id', 'services', 'Our Services', '<div class="services-page">...</div>');
```

### Step 2: Test with global CSS
Visit `/c/iopbm/services` - Header, footer, colors all work! ✅

### Step 3: Add page-specific CSS (if needed)
```css
/* Only the unique services page layout */
.services-page {
  padding: 4rem 2rem;
}

.service-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
}
```

---

## 🐛 Troubleshooting

### Styles not applying?
1. Check CSS cascade order (later CSS overrides earlier)
2. Verify global_css is populated in client_sites table
3. Check browser DevTools → Elements → `<style>` tag
4. Use debug endpoint: `/api/debug/page-content?client=iopbm&page=home`

### Styles conflicting?
1. Use more specific selectors
2. Use CSS variables for consistency
3. Check for duplicate class names
4. Use browser DevTools to see which rule is winning

### Need to update theme colors?
1. Update CSS variables in global_css
2. All pages update automatically
3. No need to touch individual pages

---

## 📚 Summary

| CSS Type | Location | Purpose | Examples |
|----------|----------|---------|----------|
| **Theme** | `client_sites.theme_config` | Generated `:root{}` variables (first layer) | `--color-primary-teal`, `--font-primary` |
| **Footer** | `client_sites.footer_config` | Footer *markup* at `<!--matrx:footer-->` (style `.matrx-footer*` in global CSS) | Link columns, contact, social, copyright |
| **Global** | `client_sites.global_css` | Theme-wide, header, footer | Colors, nav, footer, buttons |
| **Component** | `client_components.css_content` | Component variations | Special header states |
| **Page** | `client_pages.css_content` | Page-unique styles | Hero section, about section |

**Golden Rule:** If it's used on multiple pages → Global CSS. If it's unique to one page → Page CSS.

---

Need help organizing CSS for a specific page? Ask! 🎨

