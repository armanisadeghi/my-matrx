import { useState } from 'react';
import Link from 'next/link';
import Head from 'next/head';

export default function ImageConverter() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [converting, setConverting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [quality, setQuality] = useState(85);

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setResult(null);
    setError(null);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target.result);
    reader.readAsDataURL(selectedFile);
  };

  const handleConvert = async () => {
    if (!file) return;

    setConverting(true);
    setResult(null);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('quality', quality.toString());

      const response = await fetch('/api/convert-to-webp', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Conversion failed');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      
      const originalSize = parseInt(response.headers.get('X-Original-Size'));
      const webpSize = parseInt(response.headers.get('X-WebP-Size'));
      const savings = response.headers.get('X-Savings-Percent');
      
      setResult({
        url,
        blob,
        filename: file.name.replace(/\.[^/.]+$/, '.webp'),
        originalSize: (originalSize / 1024).toFixed(2),
        webpSize: (webpSize / 1024).toFixed(2),
        savings
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setConverting(false);
    }
  };

  const handleDownload = () => {
    if (!result) return;
    
    const a = document.createElement('a');
    a.href = result.url;
    a.download = result.filename;
    a.click();
  };

  const handleReset = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    setQuality(85);
  };

  return (
    <>
      <Head>
        <title>Image to WebP Converter | Utilities</title>
        <meta name="description" content="Convert images to optimized WebP format" />
      </Head>

      <div style={{ 
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '2rem'
      }}>
        <div style={{
          maxWidth: '800px',
          margin: '0 auto'
        }}>
          {/* Header */}
          <div style={{
            textAlign: 'center',
            marginBottom: '2rem'
          }}>
            <h1 style={{
              fontSize: '2.5rem',
              fontWeight: '700',
              color: 'white',
              marginBottom: '0.5rem',
              textShadow: '0 2px 10px rgba(0,0,0,0.2)'
            }}>
              🖼️ Image to WebP Converter
            </h1>
            <p style={{
              fontSize: '1.1rem',
              color: 'rgba(255,255,255,0.9)'
            }}>
              Convert PNG, JPG, and other formats to optimized WebP
            </p>
          </div>

          {/* Main Card */}
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '2rem',
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)'
          }}>
            
            {/* File Upload */}
            {!file && (
              <div style={{
                border: '3px dashed #ddd',
                borderRadius: '12px',
                padding: '3rem',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.3s'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.borderColor = '#667eea';
                e.currentTarget.style.background = '#f8f9ff';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.borderColor = '#ddd';
                e.currentTarget.style.background = 'transparent';
              }}
              onClick={() => document.getElementById('fileInput').click()}
              >
                <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>📁</div>
                <p style={{ fontSize: '1.2rem', color: '#333', marginBottom: '0.5rem' }}>
                  Click to select an image
                </p>
                <p style={{ fontSize: '0.9rem', color: '#999' }}>
                  Supports PNG, JPG, JPEG, GIF, and more
                </p>
                <input
                  id="fileInput"
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                />
              </div>
            )}

            {/* Preview & Controls */}
            {file && !result && (
              <div>
                <div style={{
                  marginBottom: '2rem',
                  textAlign: 'center'
                }}>
                  <img 
                    src={preview} 
                    alt="Preview" 
                    style={{
                      maxWidth: '100%',
                      maxHeight: '300px',
                      borderRadius: '8px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                    }}
                  />
                  <p style={{
                    marginTop: '1rem',
                    fontSize: '0.9rem',
                    color: '#666'
                  }}>
                    {file.name} • {(file.size / 1024).toFixed(2)} KB
                  </p>
                </div>

                {/* Quality Slider */}
                <div style={{ marginBottom: '2rem' }}>
                  <label style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontWeight: '600',
                    color: '#333'
                  }}>
                    Quality: {quality}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={quality}
                    onChange={(e) => setQuality(parseInt(e.target.value))}
                    style={{
                      width: '100%',
                      height: '8px',
                      borderRadius: '4px',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  />
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginTop: '0.5rem',
                    fontSize: '0.85rem',
                    color: '#999'
                  }}>
                    <span>Smaller file</span>
                    <span>Better quality</span>
                  </div>
                </div>

                {/* Error Message */}
                {error && (
                  <div style={{
                    padding: '1rem',
                    background: '#fee',
                    border: '1px solid #fcc',
                    borderRadius: '8px',
                    marginBottom: '1rem',
                    color: '#c33'
                  }}>
                    <strong>Error:</strong> {error}
                  </div>
                )}

                {/* Action Buttons */}
                <div style={{
                  display: 'flex',
                  gap: '1rem'
                }}>
                  <button
                    onClick={handleConvert}
                    disabled={converting}
                    style={{
                      flex: 1,
                      padding: '1rem 2rem',
                      background: converting ? '#ccc' : '#667eea',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '1rem',
                      fontWeight: '600',
                      cursor: converting ? 'not-allowed' : 'pointer',
                      transition: 'all 0.3s',
                      boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
                    }}
                    onMouseOver={(e) => {
                      if (!converting) e.currentTarget.style.background = '#5568d3';
                    }}
                    onMouseOut={(e) => {
                      if (!converting) e.currentTarget.style.background = '#667eea';
                    }}
                  >
                    {converting ? '⏳ Converting...' : '✨ Convert to WebP'}
                  </button>
                  
                  <button
                    onClick={handleReset}
                    disabled={converting}
                    style={{
                      padding: '1rem 2rem',
                      background: 'white',
                      color: '#666',
                      border: '2px solid #ddd',
                      borderRadius: '8px',
                      fontSize: '1rem',
                      fontWeight: '600',
                      cursor: converting ? 'not-allowed' : 'pointer',
                      transition: 'all 0.3s'
                    }}
                    onMouseOver={(e) => {
                      if (!converting) e.currentTarget.style.borderColor = '#bbb';
                    }}
                    onMouseOut={(e) => {
                      if (!converting) e.currentTarget.style.borderColor = '#ddd';
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Results */}
            {result && (
              <div>
                <div style={{
                  textAlign: 'center',
                  marginBottom: '2rem'
                }}>
                  <div style={{
                    fontSize: '4rem',
                    marginBottom: '1rem'
                  }}>
                    ✅
                  </div>
                  <h2 style={{
                    fontSize: '1.8rem',
                    color: '#333',
                    marginBottom: '1rem'
                  }}>
                    Conversion Successful!
                  </h2>
                </div>

                {/* Stats */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '1rem',
                  marginBottom: '2rem'
                }}>
                  <div style={{
                    padding: '1rem',
                    background: '#f8f9fa',
                    borderRadius: '8px',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: '0.85rem', color: '#999', marginBottom: '0.25rem' }}>
                      Original
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#333' }}>
                      {result.originalSize} KB
                    </div>
                  </div>
                  
                  <div style={{
                    padding: '1rem',
                    background: '#f8f9fa',
                    borderRadius: '8px',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: '0.85rem', color: '#999', marginBottom: '0.25rem' }}>
                      WebP
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#22c55e' }}>
                      {result.webpSize} KB
                    </div>
                  </div>
                  
                  <div style={{
                    padding: '1rem',
                    background: '#f8f9fa',
                    borderRadius: '8px',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: '0.85rem', color: '#999', marginBottom: '0.25rem' }}>
                      Savings
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#667eea' }}>
                      {result.savings}%
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div style={{
                  display: 'flex',
                  gap: '1rem'
                }}>
                  <button
                    onClick={handleDownload}
                    style={{
                      flex: 1,
                      padding: '1rem 2rem',
                      background: '#22c55e',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '1rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.3s',
                      boxShadow: '0 4px 12px rgba(34, 197, 94, 0.3)'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.background = '#16a34a'}
                    onMouseOut={(e) => e.currentTarget.style.background = '#22c55e'}
                  >
                    ⬇️ Download WebP
                  </button>
                  
                  <button
                    onClick={handleReset}
                    style={{
                      padding: '1rem 2rem',
                      background: 'white',
                      color: '#666',
                      border: '2px solid #ddd',
                      borderRadius: '8px',
                      fontSize: '1rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.3s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.borderColor = '#bbb'}
                    onMouseOut={(e) => e.currentTarget.style.borderColor = '#ddd'}
                  >
                    Convert Another
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Back Link */}
          <div style={{
            textAlign: 'center',
            marginTop: '2rem'
          }}>
            <Link 
              href="/utilities"
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
              ← Back to Utilities
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}


