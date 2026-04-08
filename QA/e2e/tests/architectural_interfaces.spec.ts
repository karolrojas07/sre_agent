import { test, expect } from '@playwright/test';
import axios from 'axios';

test.describe('Architectural Interfaces E2E Validation', () => {

  const GATEWAY_URL = 'http://localhost:38000';
  const JAEGER_URL = 'http://localhost:36686';

  test('User intent should flow from Interpreter Gateway to Validation Agent', async () => {
    // 1. Submit intent to Gateway
    const intent = "Check SLO compliance for Payment Service";
    const response = await axios.post(`${GATEWAY_URL}/intent`, {
      intent: intent
    });
    
    expect(response.status).toBe(202);
    const taskId = response.data.task_id;
    expect(taskId).toBeDefined();

    // 2. Wait for traces to be processed
    await new Promise(resolve => setTimeout(resolve, 10000));

    // 3. Validate traces in Jaeger
    // We expect spans from all 4 services: gateway, validation-agent, mock-jira-agent, mock-code-agent
    const servicesToValidate = ['validation-agent', 'mock-jira-agent', 'mock-code-agent'];
    
    for (const service of servicesToValidate) {
        const tracesResponse = await axios.get(`${JAEGER_URL}/api/traces`, {
            params: { 
                service: service,
                tags: `{"task_id": "${taskId}"}`
            }
        });

        expect(tracesResponse.status).toBe(200);
        expect(tracesResponse.data.data.length).toBeGreaterThan(0);
        
        if (service === 'mock-code-agent') {
            const span = tracesResponse.data.data[0].spans.find(s => s.operationName === 'code_triage_incident');
            expect(span).toBeDefined();
            console.log("Verified 'code_triage_incident' span in Code Agent");
        }
        
        console.log(`Verified trace for service: ${service}`);
    }
  });
});
