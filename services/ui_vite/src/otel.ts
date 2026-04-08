import { WebTracerProvider } from '@opentelemetry/sdk-trace-web';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { 
  LoggerProvider, 
  BatchLogRecordProcessor 
} from '@opentelemetry/sdk-logs';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { XMLHttpRequestInstrumentation } from '@opentelemetry/instrumentation-xml-http-request';
import { ZoneContextManager } from '@opentelemetry/context-zone';
import { Resource } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { logs } from '@opentelemetry/api-logs';

console.log('OTEL Initialization...');
const resource = new Resource({
  [ATTR_SERVICE_NAME]: 'ui-vite',
});

// Trace Setup
const provider = new WebTracerProvider({ resource });
// Redirect to Interpreter Gateway Proxy
provider.add_span_processor(new BatchSpanProcessor(new OTLPTraceExporter({
  url: 'http://localhost:48000/v1/traces',
})));

provider.register({
  contextManager: new ZoneContextManager(),
});

// Log Setup
const loggerProvider = new LoggerProvider({ resource });
loggerProvider.add_log_record_processor(
  new BatchLogRecordProcessor(new OTLPLogExporter({
    url: 'http://localhost:48000/v1/logs',
  }))
);
// Global logger provider
logs.set_global_logger_provider(loggerProvider);

registerInstrumentations({
  instrumentations: [
    new XMLHttpRequestInstrumentation(),
  ],
});
console.log('OTEL Registered with Traces and Logs');
