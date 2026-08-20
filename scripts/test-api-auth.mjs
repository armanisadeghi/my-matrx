#!/usr/bin/env node
/**
 * Tests for lib/apiAuth.js — the handler-level gate on every service-role route.
 *
 *   pnpm test:api-auth
 *
 * These routes hold the Supabase SERVICE ROLE key, which bypasses RLS, so the
 * cases below are weighted toward the three things that must never regress:
 *  1. ANONYMOUS IS REFUSED — no cookie, a forged cookie, an expired cookie, and
 *     a wrong/absent shared secret all resolve to no identity.
 *  2. FAIL CLOSED WHEN UNCONFIGURED — a missing SESSION_SECRET or
 *     MYMATRX_ADMIN_API_SECRET disables that path, it never opens it.
 *  3. USER_ID COMES FROM THE IDENTITY — never from anything the caller sent.
 *
 * Exit 1 on any failure.
 */
import { createSessionToken, SESSION_COOKIE_NAME } from '../lib/adminSession.js'
import { resolveIdentity, rateLimit, clientIp, __resetRateLimits } from '../lib/apiAuth.js'

let failures = 0
function check(name, condition) {
  if (condition) {
    console.log(`  ✓ ${name}`)
  } else {
    console.error(`  ✗ ${name}`)
    failures++
  }
}

const SECRET = 'test-session-secret'
const SERVICE_SECRET = 'test-service-secret'

function makeReq({ cookies = {}, headers = {} } = {}) {
  return { cookies, headers, socket: { remoteAddress: '203.0.113.7' } }
}

function makeRes() {
  const res = {
    statusCode: null,
    body: null,
    headers: {},
    status(code) { res.statusCode = code; return res },
    json(payload) { res.body = payload; return res },
    setHeader(k, v) { res.headers[k.toLowerCase()] = v },
  }
  return res
}

async function sessionCookie(payload) {
  return { [SESSION_COOKIE_NAME]: await createSessionToken(payload, SECRET) }
}

function withEnv(vars, fn) {
  const previous = {}
  for (const [k, v] of Object.entries(vars)) {
    previous[k] = process.env[k]
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
  return (async () => {
    try {
      return await fn()
    } finally {
      for (const [k, v] of Object.entries(previous)) {
        if (v === undefined) delete process.env[k]
        else process.env[k] = v
      }
    }
  })()
}

const CONFIGURED = {
  SESSION_SECRET: SECRET,
  MYMATRX_ADMIN_API_SECRET: SERVICE_SECRET,
  MYMATRX_SERVICE_USER_ID: undefined,
}

console.log('\nresolveIdentity — refusal')
await withEnv(CONFIGURED, async () => {
  check('no cookie, no secret → null', (await resolveIdentity(makeReq())) === null)

  check(
    'garbage cookie → null',
    (await resolveIdentity(makeReq({ cookies: { [SESSION_COOKIE_NAME]: 'not.a.token' } }))) === null
  )

  const forged = await createSessionToken({ sub: 'u1', exp: Date.now() + 60_000 }, 'a-different-secret')
  check(
    'cookie signed with another secret → null',
    (await resolveIdentity(makeReq({ cookies: { [SESSION_COOKIE_NAME]: forged } }))) === null
  )

  const expired = await sessionCookie({ sub: 'u1', email: 'a@b.c', exp: Date.now() - 1000 })
  check('expired cookie → null', (await resolveIdentity(makeReq({ cookies: expired }))) === null)

  check(
    'wrong shared secret → null',
    (await resolveIdentity(makeReq({ headers: { 'x-matrx-admin-secret': 'nope' } }))) === null
  )
  check(
    'empty shared secret header → null',
    (await resolveIdentity(makeReq({ headers: { 'x-matrx-admin-secret': '' } }))) === null
  )
})

console.log('\nresolveIdentity — acceptance')
await withEnv(CONFIGURED, async () => {
  const cookies = await sessionCookie({ sub: 'user-123', email: 'admin@aimatrx.com', exp: Date.now() + 60_000 })
  const identity = await resolveIdentity(makeReq({ cookies }))
  check('valid cookie → session identity', identity?.kind === 'session')
  check('user_id comes from the token subject', identity?.userId === 'user-123')

  const service = await resolveIdentity(makeReq({ headers: { 'x-matrx-admin-secret': SERVICE_SECRET } }))
  check('matching shared secret → service identity', service?.kind === 'service')
  check('service userId is null when unconfigured', service?.userId === null)
})

await withEnv({ ...CONFIGURED, MYMATRX_SERVICE_USER_ID: 'svc-user' }, async () => {
  const service = await resolveIdentity(makeReq({ headers: { 'x-matrx-admin-secret': SERVICE_SECRET } }))
  check('service userId comes from env, not the request', service?.userId === 'svc-user')
})

console.log('\nresolveIdentity — fails closed when unconfigured')
await withEnv({ ...CONFIGURED, SESSION_SECRET: undefined }, async () => {
  // The token itself is well-formed; there is simply no secret to verify it with.
  const token = await createSessionToken({ sub: 'u1', exp: Date.now() + 60_000 }, SECRET)
  check(
    'no SESSION_SECRET → a real cookie is still refused',
    (await resolveIdentity(makeReq({ cookies: { [SESSION_COOKIE_NAME]: token } }))) === null
  )
})
await withEnv({ ...CONFIGURED, MYMATRX_ADMIN_API_SECRET: undefined }, async () => {
  check(
    'no MYMATRX_ADMIN_API_SECRET → an empty header does not match',
    (await resolveIdentity(makeReq({ headers: { 'x-matrx-admin-secret': '' } }))) === null
  )
})

console.log('\nrateLimit')
__resetRateLimits()
{
  const req = makeReq()
  let allowed = 0
  let res = makeRes()
  for (let i = 0; i < 3; i++) {
    res = makeRes()
    if (rateLimit(req, res, { name: 't', limit: 3, windowMs: 60_000 })) allowed++
  }
  check('allows up to the limit', allowed === 3)

  res = makeRes()
  const fourth = rateLimit(req, res, { name: 't', limit: 3, windowMs: 60_000 })
  check('refuses past the limit', fourth === false)
  check('writes 429', res.statusCode === 429)
  check('sets Retry-After', typeof res.headers['retry-after'] === 'string')

  const other = { ...makeReq(), socket: { remoteAddress: '198.51.100.9' } }
  check(
    'a different IP has its own bucket',
    rateLimit(other, makeRes(), { name: 't', limit: 3, windowMs: 60_000 }) === true
  )
  check(
    'a different route has its own bucket',
    rateLimit(req, makeRes(), { name: 'other', limit: 3, windowMs: 60_000 }) === true
  )
}

console.log('\nclientIp')
check(
  'prefers x-real-ip (trusted proxy) over the socket',
  clientIp({ headers: { 'x-real-ip': '192.0.2.1' }, socket: { remoteAddress: '203.0.113.7' } }) === '192.0.2.1'
)
check(
  'IGNORES client-supplied x-forwarded-for',
  clientIp({ headers: { 'x-forwarded-for': '1.2.3.4' }, socket: { remoteAddress: '203.0.113.7' } }) === '203.0.113.7'
)
check('rejects a non-IP header value', clientIp({ headers: { 'x-real-ip': 'evil' }, socket: {} }) === 'unknown')

if (failures > 0) {
  console.error(`\n${failures} failure(s)\n`)
  process.exit(1)
}
console.log('\nAll api-auth tests passed\n')
