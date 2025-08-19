// Express types - these will be available when express is installed in the consuming application
interface Request {
  method: string;
  url: string;
  path: string;
  route?: { path: string };
}

interface Response {
  statusCode: number;
  end: Function;
  get: (header: string) => string | number | undefined;
}

interface NextFunction {
  (): void;
}
import { httpRequestDuration, httpRequestsTotal } from './metrics';
import { createSpan, finishSpan, setSpanStatus } from './tracing';

// Express middleware for HTTP metrics and tracing
export function metricsMiddleware(serviceName: string = 'api') {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    const span = createSpan(`HTTP ${req.method} ${req.route?.path || req.path}`, {
      'http.method': req.method,
      'http.url': req.url,
      'http.route': req.route?.path || req.path,
      'service.name': serviceName,
    });

    // Override res.end to capture metrics
    const originalEnd = res.end;
    res.end = function (this: Response, ...args: any[]) {
      const duration = (Date.now() - start) / 1000;
      const route = req.route?.path || req.path;
      const statusCode = res.statusCode.toString();

      // Record Prometheus metrics
      httpRequestsTotal.inc({
        method: req.method,
        route,
        status_code: statusCode,
        service: serviceName,
      });

      httpRequestDuration.observe(
        {
          method: req.method,
          route,
          service: serviceName,
        },
        duration
      );

      // Update tracing span
      span.setAttributes({
        'http.status_code': res.statusCode,
        'http.response_size': res.get('content-length') || 0,
      });

      if (res.statusCode >= 400) {
        setSpanStatus(span, 'error', `HTTP ${res.statusCode}`);
      } else {
        setSpanStatus(span, 'ok');
      }

      finishSpan(span);

      // Call original end method
      return originalEnd.apply(this, args);
    };

    next();
  };
}

// Fastify plugin for metrics and tracing
export function fastifyMetricsPlugin(
  fastify: any,
  options: { serviceName?: string },
  done: Function
) {
  const serviceName = options.serviceName || 'api';

  fastify.addHook('onRequest', async (request: any, _reply: any) => {
    request.startTime = Date.now();
    request.span = createSpan(`HTTP ${request.method} ${request.routerPath || request.url}`, {
      'http.method': request.method,
      'http.url': request.url,
      'http.route': request.routerPath || request.url,
      'service.name': serviceName,
    });
  });

  fastify.addHook('onResponse', async (request: any, reply: any) => {
    const duration = (Date.now() - request.startTime) / 1000;
    const route = request.routerPath || request.url;
    const statusCode = reply.statusCode.toString();

    // Record Prometheus metrics
    httpRequestsTotal.inc({
      method: request.method,
      route,
      status_code: statusCode,
      service: serviceName,
    });

    httpRequestDuration.observe(
      {
        method: request.method,
        route,
        service: serviceName,
      },
      duration
    );

    // Update tracing span
    if (request.span) {
      request.span.setAttributes({
        'http.status_code': reply.statusCode,
        'http.response_size': reply.getHeader('content-length') || 0,
      });

      if (reply.statusCode >= 400) {
        setSpanStatus(request.span, 'error', `HTTP ${reply.statusCode}`);
      } else {
        setSpanStatus(request.span, 'ok');
      }

      finishSpan(request.span);
    }
  });

  done();
}

// Database query middleware
export function databaseMetricsMiddleware(
  operation: string,
  table: string,
  serviceName: string = 'api'
) {
  return async function <T>(queryFn: () => Promise<T>): Promise<T> {
    const start = Date.now();
    const span = createSpan(`DB ${operation} ${table}`, {
      'db.operation': operation,
      'db.table': table,
      'service.name': serviceName,
    });

    try {
      const result = await queryFn();
      const duration = (Date.now() - start) / 1000;

      // Record metrics (these would be imported from metrics.ts)
      const { databaseQueriesTotal, databaseQueryDuration } = require('./metrics');

      databaseQueriesTotal.inc({
        operation,
        table,
        status: 'success',
        service: serviceName,
      });

      databaseQueryDuration.observe(
        {
          operation,
          table,
          service: serviceName,
        },
        duration
      );

      setSpanStatus(span, 'ok');
      return result;
    } catch (error) {
      const { databaseQueriesTotal } = require('./metrics');

      databaseQueriesTotal.inc({
        operation,
        table,
        status: 'error',
        service: serviceName,
      });

      setSpanStatus(
        span,
        'error',
        error instanceof Error ? error.message : 'Database query failed'
      );
      throw error;
    } finally {
      finishSpan(span);
    }
  };
}

// Cache operation middleware
export function cacheMetricsMiddleware(operation: string, serviceName: string = 'api') {
  return async function <T>(cacheFn: () => Promise<T>, hit: boolean = false): Promise<T> {
    const span = createSpan(`Cache ${operation}`, {
      'cache.operation': operation,
      'cache.hit': hit,
      'service.name': serviceName,
    });

    try {
      const result = await cacheFn();

      // Record metrics
      const { cacheOperationsTotal } = require('./metrics');

      cacheOperationsTotal.inc({
        operation,
        result: hit ? 'hit' : 'miss',
        service: serviceName,
      });

      setSpanStatus(span, 'ok');
      return result;
    } catch (error) {
      const { cacheOperationsTotal } = require('./metrics');

      cacheOperationsTotal.inc({
        operation,
        result: 'error',
        service: serviceName,
      });

      setSpanStatus(
        span,
        'error',
        error instanceof Error ? error.message : 'Cache operation failed'
      );
      throw error;
    } finally {
      finishSpan(span);
    }
  };
}
