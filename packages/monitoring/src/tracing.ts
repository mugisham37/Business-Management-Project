import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { Resource } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { TracingConfig } from './types';

let sdk: NodeSDK | null = null;

export function initializeTracing(config: TracingConfig): NodeSDK {
  if (sdk) {
    return sdk;
  }

  // Create resource with service information
  const resource = new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: config.serviceName,
    [SemanticResourceAttributes.SERVICE_VERSION]: config.serviceVersion,
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: config.environment,
  });

  // Configure exporters
  const exporters = [];

  // Jaeger exporter for distributed tracing
  if (config.jaegerEndpoint) {
    exporters.push(
      new JaegerExporter({
        endpoint: config.jaegerEndpoint,
      })
    );
  }

  // Prometheus exporter for metrics
  exporters.push(
    new PrometheusExporter({
      port: 9090,
      endpoint: '/metrics',
    })
  );

  // Initialize SDK
  const sdkConfig: any = {
    resource,
    instrumentations: [
      getNodeAutoInstrumentations({
        // Disable file system instrumentation to reduce noise
        '@opentelemetry/instrumentation-fs': {
          enabled: false,
        },
        // Configure HTTP instrumentation
        '@opentelemetry/instrumentation-http': {
          enabled: true,
          ignoreIncomingRequestHook: (req: any) => {
            // Ignore health check and metrics endpoints
            const url = req.url || '';
            return url.includes('/health') || url.includes('/metrics');
          },
        },
        // Configure Express instrumentation
        '@opentelemetry/instrumentation-express': {
          enabled: true,
        },
        // Configure database instrumentations
        '@opentelemetry/instrumentation-pg': {
          enabled: true,
        },
        '@opentelemetry/instrumentation-redis': {
          enabled: true,
        },
      }),
    ],
  };

  // Add trace exporter if available
  if (exporters.length > 0 && exporters[0] instanceof JaegerExporter) {
    sdkConfig.traceExporter = exporters[0];
  }

  sdk = new NodeSDK(sdkConfig);

  return sdk;
}

export function startTracing(): void {
  if (sdk) {
    sdk.start();
    console.log('OpenTelemetry tracing initialized successfully');
  }
}

export function stopTracing(): Promise<void> {
  if (sdk) {
    return sdk.shutdown();
  }
  return Promise.resolve();
}

// Utility functions for manual instrumentation
export function createSpan(name: string, attributes?: Record<string, string | number | boolean>) {
  const { trace } = require('@opentelemetry/api');
  const tracer = trace.getTracer('manual-instrumentation');

  return tracer.startSpan(name, {
    attributes,
  });
}

export function addSpanEvent(span: any, name: string, attributes?: Record<string, any>) {
  span.addEvent(name, attributes);
}

export function setSpanStatus(span: any, status: 'ok' | 'error', message?: string) {
  const { SpanStatusCode } = require('@opentelemetry/api');

  span.setStatus({
    code: status === 'ok' ? SpanStatusCode.OK : SpanStatusCode.ERROR,
    message,
  });
}

export function finishSpan(span: any) {
  span.end();
}
