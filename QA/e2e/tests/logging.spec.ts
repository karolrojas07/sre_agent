import { test, expect } from '@playwright/test';
import axios from 'axios';

/**
 * E2E Regression Suite for Centralized Logging (US 14)
 * Validates that logs from backend services and the Vite UI (proxied by the Interpreter Gateway)
 * are correctly ingested into Grafana Loki with appropriate metadata and labels.
 */
test.describe('Centralized Logging with Grafana Loki Validation', () => {

  const LOKI_URL = 'http://localhost:3100';
  const GATEWAY_URL = 'http://localhost:48000';
  const COLLECTOR_URL = 'http://localhost:44318';

  // Increase timeout for ingestion delay
  test.setTimeout(60000);

  test('Loki should be reachable and return status', async () => {
    const response = await axios.get(`${LOKI_URL}/ready`);
    expect(response.status).toBe(200);
  });

  test('Backend logs should be ingested into Loki via Collector', async () => {
    const logBody = "Backend log message from E2E test " + Math.random().toString(36).substring(7);
    const serviceName = "backend-service-test";

    // Inject OTLP log record to the collector
    await axios.post(`${COLLECTOR_URL}/v1/logs`, {
      resourceLogs: [{
        resource: { attributes: [
          { key: 'service.name', value: { stringValue: serviceName } },
          { key: 'deployment.environment', value: { stringValue: 'test' } }
        ] },
        scopeLogs: [{ logRecords: [{
          body: { stringValue: logBody },
          severityText: "INFO",
          timeUnixNano: Date.now() * 1000000
        }] }]
      }]
    });

    // Wait for ingestion (Loki ingestion is not instantaneous)
    await new Promise(resolve => setTimeout(resolve, 15000));

    // Query Loki via range query to find the log
    const query = `{job="${serviceName}"}`;
    const response = await axios.get(`${LOKI_URL}/loki/api/v1/query_range`, {
      params: { query, limit: 10 }
    });

    expect(response.status).toBe(200);
    expect(response.data.data.result.length).toBeGreaterThan(0);
    
    // Check if any log entry in the stream contains our unique message
    const results = response.data.data.result;
    let found = false;
    for (const res of results) {
        for (const val of res.values) {
            if (val[1].includes(logBody)) {
                found = true;
                break;
            }
        }
        if (found) break;
    }
    expect(found).toBe(true);
  });

  test('Frontend logs should be proxied and enriched by Interpreter Gateway', async () => {
    const logBody = "Frontend log message from UI simulation " + Math.random().toString(36).substring(7);
    const serviceName = "ui-vite-e2e";
    const userAgent = "Playwright-E2E-Simulator";

    // Inject OTLP log record to the gateway (simulating frontend)
    await axios.post(`${GATEWAY_URL}/v1/logs`, {
      resourceLogs: [{
        resource: { attributes: [
          { key: 'service.name', value: { stringValue: serviceName } }
        ] },
        scopeLogs: [{ logRecords: [{
          body: { stringValue: logBody },
          severityText: "WARN",
          timeUnixNano: Date.now() * 1000000
        }] }]
      }]
    }, {
      headers: { 'user-agent': userAgent }
    });

    // Wait for ingestion and enrichment
    await new Promise(resolve => setTimeout(resolve, 15000));

    // Query Loki - verify it has the enriched metadata
    const query = `{job="${serviceName}"}`;
    const response = await axios.get(`${LOKI_URL}/loki/api/v1/query_range`, {
      params: { query, limit: 10 }
    });

    expect(response.status).toBe(200);
    expect(response.data.data.result.length).toBeGreaterThan(0);
    
    // Verify stream labels include the enriched metadata from the gateway
    const results = response.data.data.result;
    let enrichedFound = false;
    for (const res of results) {
        if (res.stream.browser_user_agent === userAgent) {
            enrichedFound = true;
            break;
        }
    }
    expect(enrichedFound).toBe(true);
  });

  test('Code Investigator logs should be ingested into Loki', async () => {
    const intent = "Investigate recursion in payment service " + Math.random().toString(36).substring(7);
    
    // Trigger investigation via Interpreter Gateway
    const gatewayResponse = await axios.post(`${GATEWAY_URL}/intent`, {
      intent: intent
    });
    expect(gatewayResponse.status).toBe(202);
    const taskId = gatewayResponse.data.task_id;

    // Wait for processing and ingestion
    await new Promise(resolve => setTimeout(resolve, 20000));

    // Query Loki for code-investigator logs related to this task
    const query = `{job="code-investigator"}`;
    const response = await axios.get(`${LOKI_URL}/loki/api/v1/query_range`, {
      params: { query, limit: 50 }
    });

    expect(response.status).toBe(200);
    const results = response.data.data.result;
    expect(results.length).toBeGreaterThan(0);
    
    // Verify specific log messages from code_investigator main.py
    let foundStart = false;
    let foundTurn = false;
    let foundEnd = false;
    
    for (const res of results) {
        for (const val of res.values) {
            const logLine = val[1];
            if (logLine.includes(`Triaging codebase for task ${taskId}`)) foundStart = true;
            if (logLine.includes(`Task ${taskId}: Starting turn 1` || logLine.includes(`Task ${taskId}: Starting turn 5`))) foundTurn = true;
            if (logLine.includes(`Triage context returned for task ${taskId}`)) foundEnd = true;
        }
    }
    
    expect(foundStart).toBe(true);
    expect(foundTurn).toBe(true);
    expect(foundEnd).toBe(true);
  });
});
