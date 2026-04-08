import { test, expect } from '@playwright/test';
import axios from 'axios';

test.describe('Architectural Interfaces E2E Validation', () => {

  const GATEWAY_URL = 'http://localhost:48000';
  const JAEGER_URL = 'http://localhost:46686';

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

    // 3. Validate traces in Jaeger and ensure Trace ID consistency
    const servicesToValidate = ['validation-agent', 'mock-jira-agent', 'code-investigator'];
    let sharedTraceId: string | null = null;
    
    for (const service of servicesToValidate) {
        const tracesResponse = await axios.get(`${JAEGER_URL}/api/traces`, {
            params: { 
                service: service,
                tags: `{"task_id": "${taskId}"}`
            }
        });

        expect(tracesResponse.status).toBe(200);
        expect(tracesResponse.data.data.length).toBeGreaterThan(0);
        
        const trace = tracesResponse.data.data[0];
        const currentTraceId = trace.traceID;
        
        if (sharedTraceId === null) {
            sharedTraceId = currentTraceId;
            console.log(`Initial Trace ID captured: ${sharedTraceId}`);
        } else {
            expect(currentTraceId).toBe(sharedTraceId);
            console.log(`Verified Trace ID consistency for service: ${service}`);
        }

        if (service === 'validation-agent') {
            const span = tracesResponse.data.data[0].spans.find(s => s.operationName === 'validate_intent');
            expect(span).toBeDefined();
            
            const tags = span.tags;
            const statusTag = tags.find(t => t.key === 'validation.status');
            const checksCountTag = tags.find(t => t.key === 'validation.checks_count');
            const alertLevelTag = tags.find(t => t.key === 'validation.alert_level');

            expect(statusTag.value).toBe('failed');
            expect(checksCountTag.value).toBe(2);
            expect(alertLevelTag.value).toBe('High');
            
            console.log("Verified 'validate_intent' span with validation metadata in Validation Agent");
        }
        
        if (service === 'code-investigator') {
            const span = tracesResponse.data.data[0].spans.find(s => s.operationName === 'code_triage_incident');
            expect(span).toBeDefined();
            
            // Validate Codebase Investigator Metadata in Span Tags
            const tags = span.tags;
            const statusTag = tags.find(t => t.key === 'investigation.status');
            const summaryTag = tags.find(t => t.key === 'investigation.summary');
            const turnCountTag = tags.find(t => t.key === 'investigation.turn_count');

            expect(statusTag.value).toBe('SUCCESS');
            expect(summaryTag.value).toBe('Found recursive loop in Payment Service downstream call');
            expect(turnCountTag.value).toBe(5);
            
            console.log("Verified 'code_triage_incident' span with full metadata in Code Investigator");
        }
        
        console.log(`Verified trace for service: ${service}`);
    }
  });
});
