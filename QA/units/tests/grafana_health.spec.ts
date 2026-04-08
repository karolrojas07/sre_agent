import { test, expect } from '@playwright/test';
import axios from 'axios';

test.describe('Observability Unit 3: Grafana Datasource Health', () => {

  const GRAFANA_API_URL = 'http://localhost:33000/api/datasources';

  test('Prometheus datasource should be present and healthy', async () => {
    const dsResponse = await axios.get(GRAFANA_API_URL);
    const prometheusDs = dsResponse.data.find(ds => ds.name === 'Prometheus');
    expect(prometheusDs).toBeDefined();

    const healthResponse = await axios.get(`${GRAFANA_API_URL}/uid/${prometheusDs.uid}/health`);
    expect(healthResponse.status).toBe(200);
    expect(healthResponse.data.status).toBe('OK');
  });

  test('Jaeger datasource should be present and healthy', async () => {
    const dsResponse = await axios.get(GRAFANA_API_URL);
    const jaegerDs = dsResponse.data.find(ds => ds.name === 'Jaeger');
    expect(jaegerDs).toBeDefined();

    const healthResponse = await axios.get(`${GRAFANA_API_URL}/uid/${jaegerDs.uid}/health`);
    expect(healthResponse.status).toBe(200);
    expect(healthResponse.data.status).toBe('OK');
  });
});
