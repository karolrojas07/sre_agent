import React, { useState } from 'react';
import axios from 'axios';

const App: React.FC = () => {
  console.log('--- App Component Execution Start ---');
  const [status, setStatus] = useState<string>('idle');

  const reportIncident = async () => {
    setStatus('reporting');
    try {
      await axios.post('http://localhost:48000/report-incident', {
        incident_details: 'Manual incident report from UI'
      });
      setStatus('success');
    } catch (e) {
      console.error(e);
      setStatus('error');
    }
  };

  console.log('--- App Component Rendering Return ---');
  return (
    <div style={{ padding: '20px' }}>
      <h1>SRE Agent Validation Management</h1>
      
      <button 
        data-testid="report-incident-btn" 
        onClick={reportIncident}
        disabled={status === 'reporting'}
      >
        {status === 'reporting' ? 'Reporting...' : 'Report Incident'}
      </button>

      <div data-testid="thinking-view" style={{ marginTop: '20px', border: '1px solid #ccc', padding: '10px' }}>
        <h3>Thinking View</h3>
        <p>Current Status: {status}</p>
      </div>

      <div data-testid="slo-dashboard" style={{ marginTop: '20px', border: '1px solid #999', padding: '10px' }}>
        <h3>SLO Dashboard</h3>
        <ul>
          <li>Availability: 99.9%</li>
          <li>Latency P99: 150ms</li>
        </ul>
      </div>
    </div>
  );
};

export default App;
