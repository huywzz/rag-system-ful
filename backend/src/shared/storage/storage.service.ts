import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable } from '@nestjs/common';
import { env } from '../../core/config/env.js';
import type { PresignedUpload } from './storage.interface.js';

const UPLOAD_URL_TTL_SECONDS = 15 * 60;
const VIEW_URL_TTL_SECONDS = 60 * 60; // the PDF viewer may keep fetching ranges while a review is open

/** Raw files in any S3-compatible bucket (Cloudflare R2 now); swap provider via S3_* env. */
@Injectable()
export class StorageService {
  private readonly s3 = new S3Client({
    region: 'auto', // R2 requires "auto"
    endpoint: env.S3_ENDPOINT_URL,
    credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY },
  });

  /** URL the browser PUTs the file to directly; size is signed (another size gets a 403), content type is not. */
  async presignPut(key: string, contentType: string, size: number): Promise<PresignedUpload> {
    const cmd = new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: key, ContentType: contentType, ContentLength: size });
    return {
      url: await getSignedUrl(this.s3, cmd, { expiresIn: UPLOAD_URL_TTL_SECONDS }),
      headers: { 'Content-Type': contentType },
    };
  }

  /** Short-lived URL to view the original file in the browser (inline, not as a download). */
  presignGet(key: string) {
    const cmd = new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key, ResponseContentDisposition: 'inline' });
    return getSignedUrl(this.s3, cmd, { expiresIn: VIEW_URL_TTL_SECONDS });
  }

  async delete(key: string) {
    await this.s3.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
  }
}
