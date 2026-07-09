import Head from 'next/head'
import { useEffect, useState } from 'react'

export default function AccessDeniedPage() {
  const [email, setEmail] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setEmail(params.get('email') || '')
  }, [])

  return (
    <>
      <Head>
        <title>Access Denied - MyMatrx</title>
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
        <div style={{ textAlign: 'center', maxWidth: '480px' }}>
          <h1>🔒 Access Denied</h1>
          <p style={{ color: '#666' }}>
            {email ? `${email} is` : 'Your account is'} signed in to AI Matrx, but isn&apos;t
            authorized as an admin for this tool.
          </p>
          <p style={{ color: '#666' }}>
            Ask an existing admin to add you to <code>public.admins</code>, then try again.
          </p>
          <a href="/" style={{ color: '#007bff' }}>
            ← Back to homepage
          </a>
        </div>
      </div>
    </>
  )
}
