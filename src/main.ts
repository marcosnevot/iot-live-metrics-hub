import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ValidationPipe } from "@nestjs/common";
import { Logger } from "nestjs-pino";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { HttpMetricsInterceptor } from "./modules/observability/http-metrics.interceptor";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  app.useLogger(app.get(Logger));
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

  // Global HTTP metrics interceptor for Prometheus http_requests_total
  app.useGlobalInterceptors(app.get(HttpMetricsInterceptor));

  const swaggerConfig = new DocumentBuilder()
    .setTitle("IoT Live Metrics Hub – API")
    .setDescription(
      "Business APIs for devices, metrics, rules and alerts of the IoT Live Metrics Hub backend.",
    )
    .setVersion("0.7.0")
    .addApiKey(
      {
        type: "apiKey",
        name: "x-api-key",
        in: "header",
      },
      "api-key",
    )
    .build();

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("docs", app, swaggerDocument);

  await app.listen(3000);
}

bootstrap();
