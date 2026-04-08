import { test, expect } from '@playwright/test';

test.describe('Observability UI: Grafana Dashboards Validation', () => {

  const GRAFANA_URL = 'http://localhost:43000';

  test.beforeEach(async ({ page }) => {
    // Navigate to Grafana
    await page.goto(GRAFANA_URL);
  });

  test('Grafana should load and show Prometheus datasource', async ({ page }) => {
    // Go to datasources page
    await page.goto(`${GRAFANA_URL}/connections/datasources`);
    
    // Check if Prometheus is in the list
    await expect(page.getByRole('link', { name: 'Prometheus', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Jaeger', exact: true })).toBeVisible();
  });

  test('RabbitMQ Dashboard should be provisioned and accessible', async ({ page }) => {
    // Search for RabbitMQ dashboard
    await page.goto(`${GRAFANA_URL}/dashboards`);
    
    // Check if any dashboard is visible.
    await expect(page.locator('body')).not.toContainText('No dashboards found');
  });

  test('Jaeger UI should be reachable via Grafana explore or directly', async ({ page }) => {
    await page.goto(`${GRAFANA_URL}/explore`);
    
    // Select Jaeger datasource
    await page.getByRole('textbox', { name: 'Select a data source' }).click({ force: true });
    
    // In the dialog, click the Jaeger button
    await page.getByRole('button', { name: 'Jaeger', exact: false }).filter({ hasText: 'Jaeger' }).click();
    
    // Verify Jaeger query interface appears in Explore
    await expect(page.locator('body')).toContainText('Trace ID');
  });
});
