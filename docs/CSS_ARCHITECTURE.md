# 🎨 CSS Architecture for Client Sites

## Overview

CSS is organized in a cascading hierarchy to maximize reusability and minimize duplication.

## 📊 CSS Hierarchy (Order of Application)

```
1. Global CSS (client_sites.global_css)
   ↓
2. Component CSS (client_components.css_content) 
   ↓
3. Page CSS (client_pages.css_content)
   ↓
4. Inline Styles (highest priority)
```

CSS loads in this order, so later styles can override earlier ones.

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
Always reference global CSS variables instead of hardcoding colors:

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
| **Global** | `client_sites.global_css` | Theme-wide, header, footer | Colors, nav, footer, buttons |
| **Component** | `client_components.css_content` | Component variations | Special header states |
| **Page** | `client_pages.css_content` | Page-unique styles | Hero section, about section |

**Golden Rule:** If it's used on multiple pages → Global CSS. If it's unique to one page → Page CSS.

---

Need help organizing CSS for a specific page? Ask! 🎨

