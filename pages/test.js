export default function TestPage() {
  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>🧪 Simple Test Page</h1>
      <p>If you can see this, Next.js routing is working!</p>
      <p>Current time: {new Date().toISOString()}</p>
      
      <h2>Environment Test</h2>
      <ul>
        <li>NEXT_PUBLIC_SUPABASE_URL: {process.env.NEXT_PUBLIC_SUPABASE_URL || 'NOT SET'}</li>
        <li>User Agent: {typeof window !== 'undefined' ? navigator.userAgent : 'Server-side'}</li>
      </ul>
      
      <h2>Links to Test</h2>
      <ul>
        <li><a href="/debug">Debug Page</a></li>
        <li><a href="/api/test-db">Test DB API</a></li>
        <li><a href="/api/list-pages">List Pages API</a></li>
        <li><a href="/p/3484a7eb-1fbe-421c-bcde-6f146436f9f1">Dynamic Page</a></li>
      </ul>
    </div>
  )
}
