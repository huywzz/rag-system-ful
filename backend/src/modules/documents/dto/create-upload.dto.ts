import { Transform } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, Min, ValidateBy } from 'class-validator';
import { MAX_UPLOAD_BYTES, SUPPORTED_EXTENSIONS } from '../constants/document.constants.js';
import { baseName, hasSupportedExtension } from '../utils/file-name.util.js';

export class CreateUploadDto {
  @Transform(({ value }) => (typeof value === 'string' ? baseName(value) : value))
  @IsString()
  @IsNotEmpty()
  @ValidateBy({
    name: 'supportedExtension',
    validator: {
      validate: (v) => typeof v === 'string' && hasSupportedExtension(v),
      defaultMessage: () => `Chỉ hỗ trợ ${SUPPORTED_EXTENSIONS.join(', ')}`,
    },
  })
  name!: string;

  @IsOptional()
  @IsString()
  contentType: string = 'application/octet-stream';

  @IsInt()
  @Min(1)
  @Max(MAX_UPLOAD_BYTES, { message: 'Tối đa 50MB' })
  size!: number;
}
