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
 * SECURITY NOTE FOR PAGE AUTHORS: collection item data is DATA, never HTML.
 * Anything you render into the page from list()/get() MUST go through
 * MatrxData.escapeHtml (or textContent assignment). Interpolating raw item
 * values into innerHTML is a stored-XSS bug.
 */
(function () {
  'use strict'

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

  function parseJson(response) {
    return response.json().then(function (body) {
      body = body || {}
      body._status = response.status
      return body
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
     * @returns {Promise<Object>} {success, id, warnings, _status} on success;
     *   {success:false, error|errors, _status} on failure. Never throws on
     *   HTTP errors — check .success.
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
     * back). @returns {Promise<Object>} {success, items, page, per_page, _status}
     */
    list: function (collection, opts) {
      opts = opts || {}
      var params = []
      if (opts.page) params.push('page=' + encodeURIComponent(opts.page))
      if (opts.perPage) params.push('per_page=' + encodeURIComponent(opts.perPage))
      var qs = params.length ? '?' + params.join('&') : ''
      return fetch(itemsUrl(collection) + qs).then(parseJson)
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
