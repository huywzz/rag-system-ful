import 'dotenv/config';
import { plainToInstance, Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, IsUrl, MinLength, validateSync } from 'class-validator';

const url = { require_tld: false, require_protocol: true }; // allow http://localhost:...

class Env {
  @Type(() => Number) @IsInt() PORT = 3000;
  @IsString() @IsNotEmpty() DATABASE_URL!: string;
  @IsString() @MinLength(32) BETTER_AUTH_SECRET!: string;
  @IsUrl(url) BETTER_AUTH_URL!: string;
  @IsUrl(url) WEB_ORIGIN!: string;
  @IsUrl(url) RAG_URL!: string;
  @IsString() @MinLength(16) RAG_INTERNAL_TOKEN!: string;
  @IsUrl(url) S3_ENDPOINT_URL!: string;
  @IsString() @IsNotEmpty() S3_ACCESS_KEY_ID!: string;
  @IsString() @IsNotEmpty() S3_SECRET_ACCESS_KEY!: string;
  @IsString() @IsNotEmpty() S3_BUCKET!: string;
}

// Fail fast at boot on missing config instead of on the first request.
function load(): Env {
  const env = plainToInstance(Env, process.env);
  const errors = validateSync(env, { skipMissingProperties: false });
  if (errors.length) {
    throw new Error(`Invalid env:\n${errors.map((e) => `  ${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`).join('\n')}`);
  }
  return env;
}

export const env = load();
