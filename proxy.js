import { NextResponse } from 'next/server'

// Paths that require an admin login (Basic Auth against ADMIN_USER / ADMIN_PASSWORD).
// The bare POST /api/form-submissions endpoint is intentionally NOT included here —
// that one has to stay public so anonymous site visitors can submit forms.
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

function unauthorized() {
  return new NextResponse('Authentication required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="my-matrx admin"' },
  })
}

export function proxy(request) {
  const { pathname } = request.nextUrl
  const { method } = request

  if (isBlockedDebug(pathname) || isBlockedClientWrite(pathname, method)) {
    return new NextResponse('Not found', { status: 404 })
  }

  if (requiresAdminAuth(pathname)) {
    const user = process.env.ADMIN_USER
    const pass = process.env.ADMIN_PASSWORD

    // Fail closed: if credentials aren't configured in this environment, deny rather
    // than silently letting the request through.
    if (!user || !pass) {
      return new NextResponse('Admin access is not configured', { status: 503 })
    }

    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      return unauthorized()
    }

    const decoded = atob(authHeader.slice(6))
    const separatorIndex = decoded.indexOf(':')
    const suppliedUser = decoded.slice(0, separatorIndex)
    const suppliedPass = decoded.slice(separatorIndex + 1)

    if (suppliedUser !== user || suppliedPass !== pass) {
      return unauthorized()
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
