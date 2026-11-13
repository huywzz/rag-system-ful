import { IsUrl } from 'class-validator';

export class CreateUrlDocumentDto {
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  url!: string;
}
