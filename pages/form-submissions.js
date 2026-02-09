import { useState, useEffect } from 'react';
import Head from 'next/head';

/**
 * Form Submissions Viewer
 * Simple admin page to view and export form submissions
 */
export default function FormSubmissions() {
  const [submissions, setSubmissions] = useState([]);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [formTypes, setFormTypes] = useState([]);
  const [selectedFormType, setSelectedFormType] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadSubmissions();
  }, [selectedFormType]);

  const loadSubmissions = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const url = selectedFormType 
        ? `/api/form-submissions/list?form_type=${selectedFormType}&limit=100`
        : '/api/form-submissions/list?limit=100';
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('Failed to load submissions');
      }
      
      const data = await response.json();
      setSubmissions(data.submissions || []);
      
      // Extract unique form types
      const types = [...new Set(data.submissions.map(s => s.form_type))];
      setFormTypes(types);
      
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadFullSubmission = async (id) => {
    try {
      const response = await fetch(`/api/form-submissions/${id}`);
      
      if (!response.ok) {
        throw new Error('Failed to load submission details');
      }
      
      const data = await response.json();
      setSelectedSubmission(data);
      
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const exportAsJSON = (submission) => {
    const blob = new Blob(
      [JSON.stringify(submission, null, 2)], 
      { type: 'application/json' }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `submission_${submission.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportAsText = (submission) => {
    const lines = [];
    lines.push('═══════════════════════════════════════════════');
    lines.push(`Form Type: ${submission.form_type}`);
    lines.push(`Submitted: ${new Date(submission.submitted_at).toLocaleString()}`);
    lines.push(`ID: ${submission.id}`);
    lines.push('═══════════════════════════════════════════════');
    lines.push('');
    
    Object.entries(submission.data).forEach(([key, value]) => {
      if (typeof value === 'object') {
        lines.push(`${key}:`);
        lines.push(JSON.stringify(value, null, 2));
      } else {
        lines.push(`${key}: ${value}`);
      }
    });
    
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `submission_${submission.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <Head>
        <title>Form Submissions | Matrx</title>
      </Head>
      
      <div style={{ 
        fontFamily: 'system-ui, -apple-system, sans-serif',
        maxWidth: '1400px',
        margin: '0 auto',
        padding: '40px 20px'
      }}>
        <h1 style={{ marginBottom: '10px' }}>Form Submissions</h1>
        <p style={{ color: '#666', marginBottom: '30px' }}>
          View and export form submission data
        </p>

        {/* Filter */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ marginRight: '10px' }}>Filter by Form Type:</label>
          <select 
            value={selectedFormType}
            onChange={(e) => setSelectedFormType(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #ddd',
              fontSize: '14px'
            }}
          >
            <option value="">All Forms</option>
            {formTypes.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
          
          <button
            onClick={loadSubmissions}
            style={{
              marginLeft: '10px',
              padding: '8px 16px',
              borderRadius: '6px',
              border: '1px solid #ddd',
              background: '#fff',
              cursor: 'pointer'
            }}
          >
            Refresh
          </button>
        </div>

        {error && (
          <div style={{
            padding: '16px',
            background: '#fee',
            border: '1px solid #fcc',
            borderRadius: '8px',
            color: '#c00',
            marginBottom: '20px'
          }}>
            Error: {error}
          </div>
        )}

        {loading ? (
          <p>Loading submissions...</p>
        ) : (
          <div style={{ display: 'flex', gap: '20px' }}>
            {/* List */}
            <div style={{ flex: '1', minWidth: '300px' }}>
              <h2 style={{ fontSize: '18px', marginBottom: '15px' }}>
                Submissions ({submissions.length})
              </h2>
              
              <div style={{
                border: '1px solid #ddd',
                borderRadius: '8px',
                overflow: 'hidden'
              }}>
                {submissions.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
                    No submissions found
                  </div>
                ) : (
                  submissions.map(submission => (
                    <div
                      key={submission.id}
                      onClick={() => loadFullSubmission(submission.id)}
                      style={{
                        padding: '16px',
                        borderBottom: '1px solid #eee',
                        cursor: 'pointer',
                        background: selectedSubmission?.id === submission.id ? '#f0f7ff' : '#fff',
                        transition: 'background 0.15s'
                      }}
                      onMouseEnter={(e) => {
                        if (selectedSubmission?.id !== submission.id) {
                          e.currentTarget.style.background = '#f9f9f9';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (selectedSubmission?.id !== submission.id) {
                          e.currentTarget.style.background = '#fff';
                        }
                      }}
                    >
                      <div style={{ 
                        fontSize: '12px', 
                        color: '#666',
                        fontFamily: 'monospace',
                        marginBottom: '4px'
                      }}>
                        {submission.id.substring(0, 8)}...
                      </div>
                      <div style={{ fontWeight: '500', marginBottom: '4px' }}>
                        {submission.form_type}
                      </div>
                      <div style={{ fontSize: '13px', color: '#888' }}>
                        {new Date(submission.submitted_at).toLocaleString()}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Detail View */}
            <div style={{ flex: '2', minWidth: '500px' }}>
              {selectedSubmission ? (
                <>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '15px'
                  }}>
                    <h2 style={{ fontSize: '18px' }}>Submission Details</h2>
                    <div>
                      <button
                        onClick={() => exportAsJSON(selectedSubmission)}
                        style={{
                          padding: '8px 16px',
                          borderRadius: '6px',
                          border: '1px solid #ddd',
                          background: '#fff',
                          cursor: 'pointer',
                          marginRight: '8px'
                        }}
                      >
                        Export JSON
                      </button>
                      <button
                        onClick={() => exportAsText(selectedSubmission)}
                        style={{
                          padding: '8px 16px',
                          borderRadius: '6px',
                          border: '1px solid #ddd',
                          background: '#fff',
                          cursor: 'pointer'
                        }}
                      >
                        Export TXT
                      </button>
                    </div>
                  </div>

                  <div style={{
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    padding: '20px',
                    background: '#f9f9f9'
                  }}>
                    <div style={{ marginBottom: '20px' }}>
                      <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                        Form Type
                      </div>
                      <div style={{ fontWeight: '500' }}>
                        {selectedSubmission.form_type}
                      </div>
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                      <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                        Submitted
                      </div>
                      <div>
                        {new Date(selectedSubmission.submitted_at).toLocaleString()}
                      </div>
                    </div>

                    {selectedSubmission.source_url && (
                      <div style={{ marginBottom: '20px' }}>
                        <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                          Source URL
                        </div>
                        <div style={{ 
                          fontSize: '13px', 
                          wordBreak: 'break-all',
                          color: '#0066cc'
                        }}>
                          {selectedSubmission.source_url}
                        </div>
                      </div>
                    )}

                    {selectedSubmission.ip_address && (
                      <div style={{ marginBottom: '20px' }}>
                        <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                          IP Address
                        </div>
                        <div style={{ fontSize: '13px', fontFamily: 'monospace' }}>
                          {selectedSubmission.ip_address}
                        </div>
                      </div>
                    )}

                    <div style={{ marginTop: '30px' }}>
                      <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
                        Form Data
                      </div>
                      <pre style={{
                        background: '#fff',
                        border: '1px solid #ddd',
                        borderRadius: '6px',
                        padding: '16px',
                        overflow: 'auto',
                        fontSize: '13px',
                        lineHeight: '1.5',
                        maxHeight: '600px'
                      }}>
                        {JSON.stringify(selectedSubmission.data, null, 2)}
                      </pre>
                    </div>
                  </div>
                </>
              ) : (
                <div style={{
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  padding: '60px 20px',
                  textAlign: 'center',
                  color: '#999'
                }}>
                  Select a submission to view details
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
