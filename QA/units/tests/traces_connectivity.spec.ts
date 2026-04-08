import { test, expect } from '@playwright/test';
import axios from 'axios';

test.describe('Observability Unit 2: OTel Collector -> Jaeger Connectivity', () => {

  const JAEGER_SERVICES_URL = 'http://localhost:36686/api/services';

  test('Jaeger should register the test-service after trace injection', async () => {
    // Inject a trace to register the service
    await axios.post('http://localhost:34318/v1/traces', {
      resourceSpans: [{
        resource: { attributes: [{ key: 'service.name', value: { stringValue: 'test-service-playwright' } }] },
        scopeSpans: [{ spans: [{
          traceId: '4bf92f3577b34da6a3ce929d05a47315',
          spanId: '00f067aa0ba902b7',
          name: 'playwright-span',
          startTimeUnixNano: Date.now() * 1000000,
          endTimeUnixNano: (Date.now() + 1000) * 1000000
        }] }]
      }]
    });

    // Wait for propagation
    await new Promise(resolve => setTimeout(resolve, 5000));

    const response = await axios.get(JAEGER_SERVICES_URL);
    expect(response.status).toBe(200);
    expect(response.data.data).toContain('test-service-playwright');
  });
});
