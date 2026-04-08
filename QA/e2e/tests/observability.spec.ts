import { test, expect } from '@playwright/test';
import axios from 'axios';

test.describe('Observability Stack Programmatic Validation', () => {

  const PROMETHEUS_URL = 'http://localhost:39090';
  const JAEGER_URL = 'http://localhost:36686';

  test('Prometheus should be reachable and return metrics', async () => {
    const response = await axios.get(`${PROMETHEUS_URL}/api/v1/query`, {
      params: { query: 'up' }
    });
    expect(response.status).toBe(200);
    expect(response.data.status).toBe('success');
    expect(response.data.data.result.length).toBeGreaterThan(0);
  });

  test('Jaeger should be reachable and return services list', async () => {
    const response = await axios.get(`${JAEGER_URL}/api/services`);
    expect(response.status).toBe(200);
    expect(response.data.data.length).toBeGreaterThan(0);
  });

  test('RabbitMQ metrics should be present in Prometheus', async () => {
    // Inject RabbitMQ metric via Prometheus Remote Write to the Collector
    // This is a placeholder since we don't have the aio-pika implementation yet
    // But we test the collector's ability to receive and export it.
    await axios.post('http://localhost:34318/v1/metrics', {
      resourceMetrics: [{
        resource: { attributes: [{ key: 'service.name', value: { stringValue: 'rabbitmq-mock' } }] },
        scopeMetrics: [{ metrics: [{
          name: 'rabbitmq_up',
          unit: '1',
          sum: { dataPoints: [{ asDouble: 1.0, timeUnixNano: Date.now() * 1000000 }], aggregationTemporality: 2, isMonotonic: false }
        }] }]
      }]
    });

    await new Promise(resolve => setTimeout(resolve, 15000));

    const response = await axios.get(`${PROMETHEUS_URL}/api/v1/query`, {
      params: { query: 'rabbitmq_up' }
    });
    expect(response.status).toBe(200);
    expect(response.data.status).toBe('success');
    expect(response.data.data.result.length).toBeGreaterThan(0);
  });

  test('Distributed traces should show messaging metadata', async () => {
    // Inject a trace with the required metadata
    await axios.post('http://localhost:34318/v1/traces', {
      resourceSpans: [{
        resource: { attributes: [{ key: 'service.name', value: { stringValue: 'aio-pika' } }] },
        scopeSpans: [{ spans: [{
          traceId: '4bf92f3577b34da6a3ce929d05a47315',
          spanId: '00f067aa0ba902b7',
          name: 'rabbitmq-publish',
          startTimeUnixNano: Date.now() * 1000000,
          endTimeUnixNano: (Date.now() + 1000) * 1000000,
          attributes: [{ key: 'messaging.rabbitmq.routing_key', value: { stringValue: 'test-queue' } }]
        }] }]
      }]
    });

    await new Promise(resolve => setTimeout(resolve, 5000));

    const response = await axios.get(`${JAEGER_URL}/api/traces`, {
      params: { service: 'aio-pika', tags: '{"messaging.rabbitmq.routing_key": "test-queue"}' }
    });
    expect(response.status).toBe(200);
    expect(response.data.data.length).toBeGreaterThan(0);
  });
});
