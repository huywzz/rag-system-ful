import { Global, Module } from '@nestjs/common';
import { PrismaClient } from '../../generated/prisma/client.js';
import { prisma } from './prisma.js';

/** Same PrismaClient instance Better Auth uses, injectable anywhere. */
@Global()
@Module({ providers: [{ provide: PrismaClient, useValue: prisma }], exports: [PrismaClient] })
export class DatabaseModule {}
