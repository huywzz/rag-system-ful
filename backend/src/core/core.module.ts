import { Module } from '@nestjs/common';
import { AuthModule } from '@thallesp/nestjs-better-auth';
import { auth } from './auth/auth.js';
import { DatabaseModule } from './database/database.module.js';

/** App-wide wiring imported once by AppModule. AuthModule adds a global guard: every route needs a session unless @AllowAnonymous(). */
@Module({ imports: [AuthModule.forRoot({ auth }), DatabaseModule] })
export class CoreModule {}
