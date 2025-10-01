import Link from 'next/link';
import Head from 'next/head';

export default function UtilitiesPage() {
  const utilities = [
    {
      name: 'Image to WebP Converter',
      description: 'Convert PNG, JPG, and other image formats to optimized WebP format',
      icon: '🖼️',
      href: '/utilities/image-converter',
      tags: ['Images', 'Optimization', 'WebP']
    },
    // Add more utilities here in the future
    // {
    //   name: 'Image Resizer',
    //   description: 'Batch resize images to multiple sizes',
    //   icon: '📏',
    //   href: '/utilities/image-resizer',
    //   tags: ['Images', 'Resize']
    // },
  ];

  return (
    <>
      <Head>
        <title>Utilities | AI Matrx</title>
        <meta name="description" content="Developer utilities and tools for image optimization and more" />
      </Head>

      <div style={{ 
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '2rem'
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto'
        }}>
          {/* Header */}
          <div style={{
            textAlign: 'center',
            marginBottom: '3rem'
          }}>
            <h1 style={{
              fontSize: '3rem',
              fontWeight: '700',
              color: 'white',
              marginBottom: '0.5rem',
              textShadow: '0 2px 10px rgba(0,0,0,0.2)'
            }}>
              ⚡ Utilities
            </h1>
            <p style={{
              fontSize: '1.2rem',
              color: 'rgba(255,255,255,0.9)',
              maxWidth: '600px',
              margin: '0 auto'
            }}>
              Developer tools for optimization and productivity
            </p>
          </div>

          {/* Utilities Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '2rem'
          }}>
            {utilities.map((utility) => (
              <Link 
                key={utility.href} 
                href={utility.href}
                style={{ textDecoration: 'none' }}
              >
                <div style={{
                  background: 'white',
                  borderRadius: '12px',
                  padding: '2rem',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
                  transition: 'all 0.3s ease',
                  cursor: 'pointer',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = 'translateY(-5px)';
                  e.currentTarget.style.boxShadow = '0 15px 40px rgba(0,0,0,0.15)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 10px 30px rgba(0,0,0,0.1)';
                }}
                >
                  <div style={{
                    fontSize: '3rem',
                    marginBottom: '1rem'
                  }}>
                    {utility.icon}
                  </div>

                  <h2 style={{
                    fontSize: '1.5rem',
                    fontWeight: '600',
                    color: '#333',
                    marginBottom: '0.5rem'
                  }}>
                    {utility.name}
                  </h2>

                  <p style={{
                    color: '#666',
                    lineHeight: '1.6',
                    marginBottom: '1rem',
                    flex: 1
                  }}>
                    {utility.description}
                  </p>

                  <div style={{
                    display: 'flex',
                    gap: '0.5rem',
                    flexWrap: 'wrap'
                  }}>
                    {utility.tags.map((tag) => (
                      <span
                        key={tag}
                        style={{
                          fontSize: '0.85rem',
                          padding: '0.25rem 0.75rem',
                          background: '#f0f0f0',
                          borderRadius: '20px',
                          color: '#666'
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div style={{
                    marginTop: '1.5rem',
                    color: '#667eea',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    Open Tool →
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Back Link */}
          <div style={{
            textAlign: 'center',
            marginTop: '3rem'
          }}>
            <Link 
              href="/"
              style={{
                color: 'white',
                textDecoration: 'none',
                fontSize: '1rem',
                opacity: 0.8,
                transition: 'opacity 0.3s'
              }}
              onMouseOver={(e) => e.target.style.opacity = 1}
              onMouseOut={(e) => e.target.style.opacity = 0.8}
            >
              ← Back to Home
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}


