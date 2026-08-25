/**
 * MatrxData — dependency-free helper for agent-authored client-site pages to
 * talk to this site's collections (W2-C). Wire contract: DATA_API.md at the
 * my-matrx repo root.
 *
 * Include on a page with:  <script src="/matrx-data.js"></script>
 * Requires window.__MATRX_SITE__ ({slug, dataKey}), which the platform injects
 * automatically on PUBLISHED normal-page renders. It is absent on previews and
 * on sites with no data key — every method throws a clear error then, so a
 * broken form fails loudly instead of silently posting nowhere.
 *
 * ERROR CONTRACT: every method REJECTS on failure (unlike bare fetch, which
 * resolves on a 4xx). Write `.then(onSuccess).catch(onFailure)` — the error
 * carries `.status` and `.response`. A rejected write must never be shown to a
 * visitor as a success.
 *
 * SECURITY NOTE FOR PAGE AUTHORS: collection item data is DATA, never HTML.
 * Anything you render into the page from list()/get() MUST go through
 * MatrxData.escapeHtml (or textContent assignment). Interpolating raw item
 * values into innerHTML is a stored-XSS bug.
 */
(function () {
  'use strict'

  /**
   * `template` may be raw HTML, a `<template>`/element, or a selector for one.
   * A selector that matches an element uses its innerHTML; anything else is
   * treated as the markup itself, so the common case (a literal string) needs
   * no ceremony.
   */
  function resolveTemplate(template) {
    if (!template) return null
    if (typeof template !== 'string') {
      return typeof template.innerHTML === 'string' ? template.innerHTML : null
    }
    // Only try a selector lookup for something that cannot be markup — a
    // querySelector on `<li>{{title}}</li>` throws.
    if (template.indexOf('<') === -1) {
      var found = null
      try {
        found = document.querySelector(template)
      } catch (e) {
        found = null
      }
      if (found) return found.innerHTML
    }
    return template
  }

  /**
   * Expand `{{field}}` against one public item row. The server twin is
   * `lib/render/collectionBindings.js` renderTemplate() — same placeholder
   * grammar, same escaping, same "unknown name renders empty" rule. Keep them
   * in step: a page that renders one way server-side and another way after
   * hydration is worse than either alone.
   */
  function renderTemplate(templateHtml, item, escape) {
    var data = item && typeof item.data === 'object' && item.data !== null ? item.data : {}
    return templateHtml.replace(/\{\{\s*([A-Za-z0-9_-]{1,64})\s*\}\}/g, function (_m, key) {
      if (key === 'id') return escape(item && item.id)
      if (key === 'created_at') return escape(item && item.created_at)
      return Object.prototype.hasOwnProperty.call(data, key) ? escape(data[key]) : ''
    })
  }

  function site() {
    var s = window.__MATRX_SITE__
    if (!s || !s.slug || !s.dataKey) {
      throw new Error(
        'MatrxData: window.__MATRX_SITE__ is not set. It is only injected on ' +
        'published pages of sites with a data key — not on previews.'
      )
    }
    return s
  }

  function itemsUrl(collection) {
    return (
      '/api/sites/' + encodeURIComponent(site().slug) +
      '/collections/' + encodeURIComponent(collection) + '/items'
    )
  }

  /**
   * Resolve on success, REJECT on failure — deliberately unlike bare fetch().
   *
   * fetch() resolving on a 4xx is a famous footgun, and here it is worse than
   * usual: the natural pattern a page author writes is
   *   MatrxData.submit(...).then(showThanks).catch(showError)
   * With a resolve-on-failure contract, a rate-limited (429) or rejected (400)
   * booking runs `showThanks` — the visitor is told "we'll be in touch" and the
   * row does not exist. Observed live during W2-C convergence, on the first
   * page ever written against this helper. A client silently losing bookings is
   * the worst failure this system can have, so the API makes the safe pattern
   * the default one: failures reject, `.catch` is the error path.
   *
   * The parsed body is still available as `err.response` (with `.error` /
   * `.errors` / `._status`) for pages that want to show field-level messages,
   * and every failure is also logged to the console so a page with no `.catch`
   * is still diagnosable from the browser.
   */
  function parseJson(response) {
    return response.json().catch(function () { return {} }).then(function (body) {
      body = body || {}
      body._status = response.status
      if (response.ok && body.success !== false) return body
      var err = new Error(
        'MatrxData: request failed (HTTP ' + response.status + ')' +
        (body.error ? ' — ' + body.error : '')
      )
      err.response = body
      err.status = response.status
      // Loud by default: a swallowed failure here is a lost customer.
      if (window.console && console.error) console.error(err.message, body)
      throw err
    })
  }

  function uuid() {
    if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID()
    // Fallback for very old browsers (non-cryptographic, fine for a draft key).
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
    })
  }

  /**
   * A stable per-(site, collection) idempotency key, persisted in
   * localStorage — the autosave pattern: every submit with the same key
   * updates ONE draft row instead of minting new rows.
   */
  function autoIdempotencyKey(collection) {
    var storageKey = 'matrx-data:idem:' + site().slug + ':' + collection
    try {
      var existing = window.localStorage.getItem(storageKey)
      if (existing) return existing
      var fresh = uuid()
      window.localStorage.setItem(storageKey, fresh)
      return fresh
    } catch (e) {
      // localStorage unavailable (private mode etc.) — a session-scoped key
      // still dedupes within this page load.
      if (!autoIdempotencyKey._mem) autoIdempotencyKey._mem = {}
      if (!autoIdempotencyKey._mem[storageKey]) autoIdempotencyKey._mem[storageKey] = uuid()
      return autoIdempotencyKey._mem[storageKey]
    }
  }

  window.MatrxData = {
    /**
     * Submit an item to a public_write collection.
     * @param {string} collection - collection slug (e.g. 'contact')
     * @param {Object} data - plain object of field values
     * @param {Object} [opts]
     * @param {string} [opts.idempotencyKey] - a UUID for upsert-on-repeat
     *   (allow_upsert collections only), or the string 'auto' to generate and
     *   persist one per (site, collection) — the autosave pattern.
     * @param {string} [opts.sourceUrl] - defaults to the current page URL.
     * @returns {Promise<Object>} resolves {success, id, warnings, _status}.
     *   REJECTS on any failure (429 rate limit, 400 validation, 404) with an
     *   Error carrying `.status` and `.response` — so `.catch()` is the error
     *   path and a rejected submission can never be reported as a success.
     */
    submit: function (collection, data, opts) {
      opts = opts || {}
      var body = {
        data: data,
        source_url: opts.sourceUrl || window.location.href,
      }
      if (opts.idempotencyKey === 'auto') {
        body.idempotency_key = autoIdempotencyKey(collection)
      } else if (opts.idempotencyKey) {
        body.idempotency_key = opts.idempotencyKey
      }
      return fetch(itemsUrl(collection), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Matrx-Site-Key': site().dataKey,
        },
        body: JSON.stringify(body),
      }).then(parseJson)
    },

    /**
     * List items of a public_read collection (only allowlisted fields come
     * back).
     *
     * PREFER SSR FOR CONTENT. If the rows are page content (events,
     * testimonials, profiles), bind them with a
     * `<template data-matrx-collection="...">` instead — that markup is in the
     * HTML a crawler receives, and this fetch is not (DATA_API.md → "Rendering
     * collection content"). Use `list()` for genuinely interactive cases:
     * search-as-you-type, pagination, load-more.
     *
     * @param {Object} [opts]
     * @param {number} [opts.page] / @param {number} [opts.perPage]
     * @param {string} [opts.order] `field[:asc|desc]`, restricted to the
     *   collection's public_read_fields (+ created_at/id). Omit to get the
     *   collection's own declared order.
     * @param {string} [opts.filter] `field:op:value[,…]`, ops `eq gt gte lt lte`,
     *   plus the literal `now` — e.g. `starts_at:gte:now` for upcoming events.
     *   Same allowlist as `order`.
     * @returns {Promise<Object>} {success, items, page, per_page, _status}
     */
    list: function (collection, opts) {
      opts = opts || {}
      var params = []
      if (opts.page) params.push('page=' + encodeURIComponent(opts.page))
      if (opts.perPage) params.push('per_page=' + encodeURIComponent(opts.perPage))
      if (opts.order) params.push('order=' + encodeURIComponent(opts.order))
      if (opts.filter) params.push('filter=' + encodeURIComponent(opts.filter))
      var qs = params.length ? '?' + params.join('&') : ''
      return fetch(itemsUrl(collection) + qs).then(parseJson)
    },

    /**
     * Render a collection into the page using the SAME `{{field}}` template
     * syntax the SSR binding uses — so the client path and the server path are
     * one mental model instead of two (W2C-render-binding §C).
     *
     *   MatrxData.render('events', {
     *     into: '#events',
     *     template: '<li><strong>{{title}}</strong> — {{starts_at}}</li>',
     *     order: 'starts_at:asc',
     *     filter: 'starts_at:gte:now',
     *     empty: '<li>No events scheduled.</li>',
     *   })
     *
     * `template` may also be a SELECTOR for a `<template>` element, in which
     * case its innerHTML is used — the same element the SSR binder expands,
     * so a page can be written once and rendered either way.
     *
     * THE RENDERER ESCAPES, THE AUTHOR NEVER INTERPOLATES. Every `{{field}}`
     * goes through escapeHtml here, exactly as the server expander does. That
     * is the entire reason this method exists: `list()` hands back raw data and
     * every page author who builds their own innerHTML string is one forgotten
     * escapeHtml away from stored XSS.
     *
     * `{{id}}` and `{{created_at}}` address the row; every other name addresses
     * `data`. An unknown name renders EMPTY rather than printing `{{starts_at}}`
     * at a visitor.
     *
     * @param {string} collection
     * @param {Object} opts
     * @param {string|Element} opts.into container (selector or element) — its
     *   contents are REPLACED
     * @param {string|Element} opts.template row template, or a selector/element
     *   whose innerHTML is the row template
     * @param {string} [opts.empty] HTML rendered when there are zero rows
     * @param {string} [opts.order] / @param {string} [opts.filter] /
     *   @param {number} [opts.perPage] passed straight to list()
     * @returns {Promise<Object>} the list() response, so callers can still read
     *   `items` — and it REJECTS on failure like every other method here.
     */
    render: function (collection, opts) {
      opts = opts || {}
      var into = typeof opts.into === 'string' ? document.querySelector(opts.into) : opts.into
      if (!into) {
        return Promise.reject(new Error('MatrxData.render: `into` matched no element'))
      }
      var template = resolveTemplate(opts.template)
      if (template === null) {
        return Promise.reject(new Error('MatrxData.render: `template` is required'))
      }
      var self = this
      return this.list(collection, {
        order: opts.order,
        filter: opts.filter,
        perPage: opts.perPage,
      }).then(function (response) {
        var items = (response && response.items) || []
        if (items.length === 0) {
          into.innerHTML = opts.empty || ''
          return response
        }
        into.innerHTML = items
          .map(function (item) {
            return renderTemplate(template, item, self.escapeHtml)
          })
          .join('')
        return response
      })
    },

    /**
     * Fetch one item by id from a public_read collection.
     * @returns {Promise<Object>} {success, item, _status}
     */
    get: function (collection, id) {
      return fetch(itemsUrl(collection) + '/' + encodeURIComponent(id)).then(parseJson)
    },

    /**
     * Escape a value for safe interpolation into HTML. USE THIS on every item
     * value you render — item data is visitor-supplied and can contain markup.
     */
    escapeHtml: function (s) {
      return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
    },
  }
})()
