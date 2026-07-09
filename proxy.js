import { NextResponse } from 'next/server'
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/adminSession'

// Admin login goes through aidream's OAuth broker (the same mechanism
// apps/dashboard uses): a redirect to /auth/aimatrx, which does the Supabase
// PKCE exchange + a public.admins lookup server-side, then bounces back here
// with ?access_token=... (handled by pages/oauth/callback.js, which mints
// our own short-lived signed session cookie via /api/auth/session).
const ADMIN_PATHS = ['/admin']
const ADMIN_API_EXACT = ['/api/create-page', '/api/list-pages']

function requiresAdminAuth(pathname) {
  if (ADMIN_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) return true
  if (ADMIN_API_EXACT.includes(pathname)) return true
  // form_submissions reads (by id / latest / list / test) can contain user-submitted PII
  if (pathname.startsWith('/api/form-submissions/')) return true
  return false
}

// Dead CMS-write surface: matrx-frontend's /api/cms/pages already owns create/update/
// publish/discard/rollback for client_pages. Nothing in the platform calls these routes,
// so they're blocked outright rather than gated behind a login nobody will ever use.
function isBlockedClientWrite(pathname, method) {
  if (/^\/api\/clients\/[^/]+\/pages\/[^/]+\/(publish|discard)$/.test(pathname)) return true
  if (method === 'PUT' && /^\/api\/clients\/[^/]+\/pages\/[^/]+$/.test(pathname)) return true
  return false
}

function isBlockedDebug(pathname) {
  return pathname.startsWith('/api/debug/')
}

function isApiPath(pathname) {
  return pathname.startsWith('/api/')
}

function loginUrl(request) {
  const aidreamUrl = process.env.AIDREAM_API_URL
  const callback = `${request.nextUrl.origin}/oauth/callback`
  return `${aidreamUrl}/auth/aimatrx?app_redirect=${encodeURIComponent(callback)}&admin_required=true`
}

export async function proxy(request) {
  const { pathname } = request.nextUrl
  const { method } = request

  if (isBlockedDebug(pathname) || isBlockedClientWrite(pathname, method)) {
    return new NextResponse('Not found', { status: 404 })
  }

  if (requiresAdminAuth(pathname)) {
    const sessionSecret = process.env.SESSION_SECRET
    const aidreamUrl = process.env.AIDREAM_API_URL

    // Fail closed: if login isn't configured in this environment, deny
    // rather than silently letting the request through.
    if (!sessionSecret || !aidreamUrl) {
      return new NextResponse('Admin access is not configured', { status: 503 })
    }

    const token = request.cookies.get(SESSION_COOKIE_NAME)?.value
    const session = token ? await verifySessionToken(token, sessionSecret) : null

    if (!session) {
      if (isApiPath(pathname)) {
        return NextResponse.json(
          { error: 'unauthorized', loginUrl: loginUrl(request) },
          { status: 401 }
        )
      }
      return NextResponse.redirect(loginUrl(request))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/api/create-page',
    '/api/list-pages',
    '/api/form-submissions/:path*',
    '/api/clients/:path*',
    '/api/debug/:path*',
  ],
}
