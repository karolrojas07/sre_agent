import { WebTracerProvider } from '@opentelemetry/sdk-trace-web';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { XMLHttpRequestInstrumentation } from '@opentelemetry/instrumentation-xml-http-request';
import { ZoneContextManager } from '@opentelemetry/context-zone';
import { Resource } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import axios from 'axios';

const init = () => {
  console.log('--- UI VITE STARTING (VANILLA) ---');

  const provider = new WebTracerProvider({
    resource: new Resource({
      [ATTR_SERVICE_NAME]: 'ui-vite',
    }),
  });

  provider.add_span_processor(new BatchSpanProcessor(new OTLPTraceExporter({
    url: 'http://localhost:44318/v1/traces',
  })));

  provider.register({
    contextManager: new ZoneContextManager(),
  });

  registerInstrumentations({
    instrumentations: [
      new XMLHttpRequestInstrumentation(),
    ],
  });

  const root = document.getElementById('root');
  if (root) {
    console.log('Root element found, injecting HTML');
    root.innerHTML = `
      <div style="padding: 20px;">
        <h1>SRE Agent Validation Management</h1>
        <button data-testid="report-incident-btn" id="report-btn">Report Incident</button>
        <div data-testid="thinking-view" style="margin-top: 20px; border: 1px solid #ccc; padding: 10px;">
          <h3>Thinking View</h3>
          <p id="status-text">Status: idle</p>
        </div>
        <div data-testid="slo-dashboard" style="margin-top: 20px; border: 1px solid #999; padding: 10px;">
          <h3>SLO Dashboard</h3>
          <ul>
            <li>Availability: 99.9%</li>
            <li>Latency P99: 150ms</li>
          </ul>
        </div>
      </div>
    `;

    document.getElementById('report-btn')?.addEventListener('click', async () => {
      const statusText = document.getElementById('status-text');
      if (statusText) statusText.innerText = 'Status: reporting';
      try {
        await axios.post('http://localhost:48000/report-incident', {
          incident_details: 'Manual incident report from Vanilla UI'
        });
        if (statusText) statusText.innerText = 'Status: success';
      } catch (e) {
        console.error(e);
        if (statusText) statusText.innerText = 'Status: error';
      }
    });
  } else {
    console.error('Root element NOT found');
  }

  console.log('--- UI VITE LOADED (VANILLA) ---');
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
