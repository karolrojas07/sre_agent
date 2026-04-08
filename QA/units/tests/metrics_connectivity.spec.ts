import { test, expect } from '@playwright/test';
import axios from 'axios';

test.describe('Observability Unit 1: Collector -> Prometheus Connectivity', () => {

  const PROMETHEUS_QUERY_URL = 'http://localhost:39090/api/v1/query';

  test('Prometheus should see the OTel Collector itself as a scrape target', async () => {
    // We expect the 'up' metric for the 'otel-collector' job to be 1
    const response = await axios.get(PROMETHEUS_QUERY_URL, {
      params: { query: 'up{job="otel-collector"}' }
    });
    expect(response.status).toBe(200);
    const result = response.data.data.result;
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].value[1]).toBe('1'); // 1 means 'up'
  });

  test('OTel Collector should be exporting its own process metrics', async () => {
    // otelcol_process_memory_rss_bytes is a standard metric
    const response = await axios.get(PROMETHEUS_QUERY_URL, {
      params: { query: 'otelcol_process_memory_rss_bytes' }
    });
    expect(response.status).toBe(200);
    expect(response.data.data.result.length).toBeGreaterThan(0);
  });
});
