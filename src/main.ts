import 'tsconfig-paths/register';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = process.env.PORT ?? 3000;
  await app.listen(port).then(() => console.log(`Listening on port ${port}`));
}
// eslint-disable-next-line @typescript-eslint/no-floating-promises
bootstrap();
