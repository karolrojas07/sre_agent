import { test, expect } from '@playwright/test';
import axios from 'axios';

test.describe('Validation Agent & UI Scaffolding Regression Suite', () => {

  const UI_URL = 'http://localhost:5173';
  const JAEGER_URL = 'http://localhost:46686';

  test.beforeEach(async ({ page }) => {
    page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
    // Navigate to the Vite UI
    await page.goto(UI_URL, { waitUntil: 'networkidle' });
  });

  test('UI should have skeletal validation management components', async ({ page }) => {
    // These elements are defined in @requirements/validation_agent_scaffolding.md
    console.log('Page URL:', page.url());
    const content = await page.content();
    console.log('Page Content Length:', content.length);
    
    const htmlCheck = await page.locator('#html-check').isVisible();
    console.log('HTML Check (#html-check) Visible:', htmlCheck);

    const btn = page.locator('button');
    try {
      await btn.waitFor({ state: 'attached', timeout: 10000 });
      console.log('Button Attached');
    } catch (e) {
      await page.screenshot({ path: 'failure-screenshot.png' });
      const body = await page.evaluate(() => document.body.innerHTML);
      console.log('Body InnerHTML:', body);
      throw e;
    }
    await expect(page.getByTestId('report-incident-btn')).toBeVisible();
    await expect(page.getByTestId('thinking-view')).toBeVisible();
    await expect(page.getByTestId('slo-dashboard')).toBeVisible();
  });

  test('UI should be instrumented with OpenTelemetry Web SDK', async ({ page }) => {
    // Check for the presence of the OTel global or trace registration in Jaeger
    // This assumes the UI registers itself in Jaeger on startup or after first interaction.
    const response = await axios.get(`${JAEGER_URL}/api/services`);
    expect(response.status).toBe(200);
    expect(response.data.data).toContain('ui-vite');
  });

  test('Incident report should propagate trace context to Interpreter Gateway', async ({ page }) => {
    // Intercept the outgoing POST to verify the traceparent header is present
    const [request] = await Promise.all([
      page.waitForRequest(req => req.url().includes('/report-incident') && req.method() === 'POST', { timeout: 1000 }),
      page.getByTestId('report-incident-btn').click()
    ]);

    const headers = request.headers();
    expect(headers['traceparent']).toBeDefined();
    expect(headers['traceparent']).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);
  });

  test('Trace should show end-to-end visibility from UI to Validation Agent', async () => {
    // Verify that a trace starting from 'ui-vite' reaches 'validation-agent'
    // This is a complex check that requires actual spans to be produced.
    // In the Red Phase, we'll check if a trace with both services exists.
    const response = await axios.get(`${JAEGER_URL}/api/traces`, {
      params: { service: 'ui-vite' }
    });
    
    expect(response.status).toBe(200);
    const traces = response.data.data;
    if (traces.length > 0) {
      const trace = traces[0];
      const serviceNames = new Set(trace.spans.map((s: any) => {
        const process = trace.processes[s.processID];
        return process.serviceName;
      }));
      expect(serviceNames).toContain('ui-vite');
      expect(serviceNames).toContain('interpreter-gateway');
      expect(serviceNames).toContain('validation-agent');
    } else {
      throw new Error('No traces found for ui-vite in Jaeger.');
    }
  });
});
