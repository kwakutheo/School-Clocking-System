import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/modules/auth/auth.service';

async function run() {
  console.log('Initializing Nest application context...');
  const app = await NestFactory.createApplicationContext(AppModule);
  console.log('Context initialized.');

  const authService = app.get(AuthService);

  console.log('Testing password reset request with valid admin credentials...');
  
  const result = await authService.requestPasswordReset({
    username: 'theo',
    email: 'walcottt243@gmail.com',
  });

  console.log('Result:', result);
  await app.close();
}

run().catch(console.error);
