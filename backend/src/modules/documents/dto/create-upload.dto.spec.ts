import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateUploadDto } from './create-upload.dto.js';

const check = (body: object) => {
  const dto = plainToInstance(CreateUploadDto, body);
  return { dto, errors: validateSync(dto).map((e) => e.property) };
};

describe('CreateUploadDto', () => {
  it('strips any path so the storage key stays under the document id', () => {
    expect(check({ name: '../../x/quy-dinh.PDF', size: 10 }).dto.name).toBe('quy-dinh.PDF');
    expect(check({ name: 'C:\\tmp\\a.md', size: 10 }).dto.name).toBe('a.md');
  });

  it('defaults the content type', () => {
    expect(check({ name: 'a.md', size: 10 })).toMatchObject({ dto: { contentType: 'application/octet-stream' }, errors: [] });
  });

  it('rejects unsupported types and bad sizes', () => {
    expect(check({ name: 'a.exe', size: 10 }).errors).toEqual(['name']);
    expect(check({ name: 'a.pdf', size: 51 * 1024 * 1024 }).errors).toEqual(['size']);
    expect(check({ name: 'a.pdf', size: 0 }).errors).toEqual(['size']);
  });
});
