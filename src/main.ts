import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: [
      'https://auto-bot-frontend.vercel.app',
      'http://localhost:5173',
      'http://localhost:5175',
      'http://62.84.177.127',
      'http://194.163.167.191:3003',
      'http://194.163.167.191:5173',
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  await app.listen(process.env.PORT || 3000);
}
bootstrap();
