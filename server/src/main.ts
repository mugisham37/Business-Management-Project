import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { setupSwagger } from './config/swagger.config';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  
  try {
    const app = await NestFactory.create(AppModule, {
      logger: ['error', 'warn', 'log', 'debug', 'verbose'],
    });

    const configService = app.get(ConfigService);
    const port = configService.get<number>('PORT', 3000);
    const apiPrefix = configService.get<string>('API_PREFIX', 'api/v1');

    // Global prefix
    app.setGlobalPrefix(apiPrefix);

    // Global validation pipe
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );

    // CORS configuration
    const corsOrigin = configService.get<string>('CORS_ORIGIN', 'http://localhost:3000');
    const corsCredentials = configService.get<boolean>('CORS_CREDENTIALS', true);
    
    app.enableCors({
      origin: corsOrigin.split(','),
      credentials: corsCredentials,
    });

    // Setup Swagger documentation
    setupSwagger(app);

    await app.listen(port);
    
    logger.log(`🚀 Application is running on: http://localhost:${port}/${apiPrefix}`);
    logger.log(`📚 API Documentation: http://localhost:${port}/docs`);
    logger.log(`🎯 GraphQL Playground: http://localhost:${port}/graphql`);
    logger.log(`🏥 Health Check: http://localhost:${port}/${apiPrefix}/health`);
  } catch (error) {
    logger.error('Failed to start application', error);
    process.exit(1);
  }
}

void bootstrap();