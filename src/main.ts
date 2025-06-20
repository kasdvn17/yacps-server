import 'tsconfig-paths/register';
import { NestApplication, NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = process.env.PORT ?? 3000;
  const logger = new Logger(NestApplication.name);
  app.useGlobalPipes(new ValidationPipe());
  app.enableCors({
    origin: '*',
  });
  await app
    .listen(port)
    .then(() => logger.log(`Application is listening on port ${port}`));
}
// eslint-disable-next-line @typescript-eslint/no-floating-promises
bootstrap();
