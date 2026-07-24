# DATA_API.md — Public Collections Wire Contract (CW4)

The visitor-facing data API for client-site collections (W2-C). Served by this repo
(my-matrx) same-origin with the rendered site — aidream is never on this request path.
Definitions/admin live elsewhere (aidream services + matrx-frontend `/cms`); this file is the
contract for **page JS talking to these routes** and for the agents that author such pages.

System-of-record for the whole CMS platform: `/Users/armanisadeghi/code/common-docs/cms-system/FEATURE.md`.
Design of record: `aidream/docs/cms_agent_authoring/W2C-design.md`.

---

## Routes

Base path (identical on `mymatrx.com/c/{site}` pages and on custom domains — both same-origin):

```
POST /api/sites/{site}/collections/{slug}/items         visitor submit
GET  /api/sites/{site}/collections/{slug}/items         public list (paginated)
GET  /api/sites/{site}/collections/{slug}/items/{id}    public single item
```

`{site}` = the site slug (`window.__MATRX_SITE__.slug`), `{slug}` = the collection slug.
There are **no other collection routes here** — no search, no filters, no admin ops (DoS
surface / kept thin by design). Everything else 404s.

### POST — visitor submit

Requires the collection to have `public_write=true` **and** the header:

```
X-Matrx-Site-Key: <site data key>       (window.__MATRX_SITE__.dataKey)
Content-Type: application/json
```

Body:

```json
{
  "data": { "...": "field values — plain object, required" },
  "source_url": "optional string (matrx-data.js sends location.href)",
  "idempotency_key": "optional UUID — allow_upsert collections only"
}
```

Responses:

| Status | Body | Meaning |
|---|---|---|
| 201 | `{"success":true,"id":"<uuid>","warnings":[...]}` | stored (created OR updated-by-idempotency-key OR quarantined — indistinguishable on purpose) |
| 400 | `{"success":false,"errors":[{key,code,message},...]}` | validation reject (strict-mode mismatch/unknown key, or required-missing in any mode) |
| 400 | `{"success":false,"error":"invalid_request"\|"invalid_data"\|"invalid_source_url"\|"invalid_idempotency_key"}` | malformed body / non-UUID idempotency key on an allow_upsert collection |
| 404 | `{"success":false,"error":"not_found"}` | uniform — see Abuse posture |
| 413 | `{"success":false,"error":"payload_too_large"\|"too_many_fields"}` | size caps |
| 429 | `{"success":false,"error":"rate_limited"}` + `Retry-After: 3600` | rate window exceeded (IP or site) |
| 405 | `{"success":false,"error":"method_not_allowed"}` | |
| 500 | `{"success":false,"error":"internal_error"}` | no detail leak; logged server-side |

`warnings` on 201 = advisory-mode validation notes (`type_mismatch`, `max_length`,
`out_of_range`, `invalid_option`); the row is stored as submitted.

**Idempotency key (autosave pattern):** on a collection with `allow_upsert=true`, repeat POSTs
with the same UUID key update ONE row instead of minting new ones (`matrx-data.js`
`{idempotencyKey:'auto'}` persists a key per site+collection in localStorage). On non-upsert
collections the key is silently ignored. **Residual risk (accepted, design §8-A4):** the key is
`uuid`-typed so guessable/semantic keys are impossible, but an attacker who *steals* a live key
(client-side compromise) can overwrite that one draft row — drafts are low-stakes; never derive
keys from PII.

### GET list / GET item — public reads

No site key. The collection must have `public_read=true`; each returned item is **only**
`{id, created_at, data}` where `data` contains just the `public_read_fields` allowlist
(empty allowlist ⇒ `data` is `{}`). Spam, soft-deleted, and archived rows never appear.

List: `?page=1&per_page=20` (per_page capped at 100), ordered `created_at desc` (stable
tiebreak on id). Response `{"success":true,"page":N,"per_page":N,"items":[...]}`.
Item: `{"success":true,"item":{...}}`. Missing/not-public/invalid id ⇒ the uniform 404.

---

## Abuse posture

Layered gate on writes (each layer alone survivable; W2C-design §5):

1. **Site data key** — required header on every write. Ships inside published page HTML by
   design: it is *not a secret*; its value is **revocation + attribution** (rotate once and
   key-less bot spray dies). Never treat possession as authentication.
2. **Size caps** — request body hard-capped at 512 KB (route `bodyParser.sizeLimit`); per-item
   default 64 KiB UTF-8 (`settings.max_item_bytes`, ceiling 512 KiB); ≤ 200 keys after flatten.
3. **Rate limits** — sliding 1-hour windows, default 30/IP/collection and 500/site, counted and
   enforced **atomically inside the DB function** `submit_collection_item()` (count-then-insert
   from the route would race). Windows count *inserts*; idempotency-key *updates* of an existing
   draft are deliberately uncounted (bounded to one row per key; autosave is the dominant
   legitimate workload).
4. **Honeypot** — `settings.honeypot_field` names a decoy key; a non-empty value flags
   `is_spam=true` and returns a **byte-shape-identical 201** (spam rows are unreadable on every
   public surface).
5. **Field validation** — advisory/strict per collection (see the validator section).
6. **Spam heuristics** — ≥ 4 http(s) URLs across string values ⇒ `is_spam=true`; flags, never
   rejects.
7. **Quota-quarantine** — `settings.max_items` counts only non-spam/non-deleted/active rows;
   past the ceiling, plausible-legit writes land with `status='archived'` (triage) and still
   return 201 — a quota attack degrades to triage noise, never a dead form.

**Uniform 404:** unknown site, wrong/missing key, unknown collection, and non-public collection
all return the identical `404 {"success":false,"error":"not_found"}` — no enumeration oracle.
**Owned residual oracle:** 429/413 (and the write-succeeds-but-absent-from-public-read
differential) DO leak existence and limit calibration to a patient attacker; that is the
accepted price of usable error semantics (design §8-A6). Turnstile/CAPTCHA: **cut from v1**
(ruling 2026-07-23) — honeypot + rate limits are the v1 posture.

**IP trust:** the per-IP window keys on `x-real-ip`, which is set by Vercel (trusted proxy) and
not attacker-supplied there. The leftmost `x-forwarded-for` entry is attacker-supplied and is
deliberately NOT used. Outside a trusted proxy (bare `next dev`) the socket address is the
fallback. An unparseable IP skips the per-IP window only; the per-site window always applies.

---

## Escaping discipline (page authors — this means you)

Collection item data is **data, never HTML**. The runtime never renders it; any page JS that
does MUST escape every value: `MatrxData.escapeHtml(value)` (from `/matrx-data.js`) or
`element.textContent = value`. Interpolating raw item values into `innerHTML` is a stored-XSS
defect. `richtext` fields never occur on public-write collections (forbidden at the definition
layer), so nothing arriving through these routes is ever legitimately HTML.

## matrx-data.js

`window.MatrxData` gives `submit(collection, data, {idempotencyKey, sourceUrl})`,
`list(collection, {page, perPage})`, `get(collection, id)`, `escapeHtml(s)`. It reads
`window.__MATRX_SITE__` (slug + data key), which the platform injects on **published
normal-page renders only** — never on previews, never on listing pages, never for sites without
a data key.

**The helper is auto-included.** The renderer emits `<script src="/matrx-data.js">` before your
`js_content` whenever that JS mentions `MatrxData`, so you do not add the tag yourself. (It used
to be a manual include; a page that forgot it died on a `ReferenceError` at the first line of the
IIFE — no events, no form handler, no visible error. The platform includes it now.)

**Error contract: every method REJECTS on failure** — deliberately unlike bare `fetch`, which
resolves on a 4xx. The rejection carries `.status` and `.response` (the parsed body, with
`.error` / `.errors` / `._status`), and is logged to the console. Write:

```js
MatrxData.submit('bookings', data)
  .then(function () { status.textContent = 'Thanks — we will be in touch.' })
  .catch(function (err) { status.textContent = 'Sorry, that did not go through.' })
```

This contract exists because the opposite one bit immediately: with resolve-on-failure, a
rate-limited (429) booking ran the `.then` branch and told a visitor "we'll be in touch" while no
row existed. **A write that did not land must never be reported to a visitor as a success.**

## Validator fixture-twin contract (CW3)

Canonical validation semantics live in aidream (Python). This repo's JS twin is
`lib/collections/validateItem.js`, pinned by the shared language-neutral fixture:

- Source of truth: `aidream/aidream/services/cms/collection-validation-rules.json`
- Committed copy here: `lib/collections/collection-validation-rules.json` — **copied verbatim,
  never hand-edited**. When the aidream fixture changes, re-copy and re-run.
- Runner: `pnpm test:collections` (`scripts/test-validate-item.mjs`) — every fixture case must
  pass. Drift between the twins is the one genuinely dangerous seam in this system; the route
  (not the validator) is the authority for byte-size caps.

Normative pins: `max_length` counts Unicode **code points**; byte caps are UTF-8 bytes of
`JSON.stringify(data)`; `datetime` is strict ISO-8601 only; numbers must be JSON numbers
(`"5"` ≠ `5`, NaN/Infinity rejected).
