import { useEffect, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'

// aidream's /auth/callback already ran the admin check (public.admins) before
// redirecting here with ?access_token=... — but that redirect is a
// client-visible, replayable URL, so we still independently re-verify the
// token server-side (see /api/auth/session) before trusting it.
//
// Read the URL exactly once, not reactively — Next's router query updates
// after history.replaceState() strips the token, which would otherwise
// re-fire this into the "no token" branch even after a successful sign-in.
export default function OAuthCallbackPage() {
  const [status, setStatus] = useState('processing')
  const [errorMessage, setErrorMessage] = useState('')
  const router = useRouter()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const accessToken = params.get('access_token')
    const errorParam = params.get('error')

    if (errorParam) {
      setErrorMessage(decodeURIComponent(errorParam))
      setStatus('error')
      return
    }

    if (!accessToken) {
      setErrorMessage('No access token received.')
      setStatus('error')
      return
    }

    window.history.replaceState({}, '', window.location.pathname)

    fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_token: accessToken }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error || 'Failed to establish session')
        }
        setStatus('success')
        setTimeout(() => {
          router.replace('/admin')
        }, 600)
      })
      .catch((err) => {
        setErrorMessage(err.message)
        setStatus('error')
      })
    // Intentionally empty deps — this must run exactly once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      <Head>
        <title>Signing in… - MyMatrx</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <div
        style={{
          fontFamily: 'Arial, sans-serif',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          {status === 'processing' && <p>Completing sign in…</p>}
          {status === 'success' && <p>✅ Signed in. Redirecting…</p>}
          {status === 'error' && (
            <>
              <p style={{ color: '#dc3545', fontWeight: 'bold' }}>Sign in failed</p>
              <p style={{ color: '#666', maxWidth: '360px' }}>{errorMessage}</p>
              <a href="/admin" style={{ color: '#007bff' }}>
                Try again
              </a>
            </>
          )}
        </div>
      </div>
    </>
  )
}
