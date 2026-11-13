import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { Roles, Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { CreateUploadDto } from '../dto/create-upload.dto.js';
import { CreateUrlDocumentDto } from '../dto/create-url-document.dto.js';
import { UpdateChunkDto } from '../dto/update-chunk.dto.js';
import { DocumentsService } from '../services/documents.service.js';

@Controller('documents')
export class DocumentsController {
  constructor(private readonly docs: DocumentsService) {}

  // role-only model: every signed-in user can see the list; only approved documents are searchable
  @Get()
  list() {
    return this.docs.list();
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.docs.get(id);
  }

  @Post()
  @Roles(['admin', 'editor'])
  createUpload(@Session() s: UserSession, @Body() dto: CreateUploadDto) {
    return this.docs.createUpload(s.user.id, dto.name, dto.contentType, dto.size);
  }

  @Post('url')
  @Roles(['admin', 'editor'])
  createFromUrl(@Session() s: UserSession, @Body() dto: CreateUrlDocumentDto) {
    return this.docs.createFromUrl(s.user.id, dto.url);
  }

  /** Upload finished (or retry a failed parse): parse into chunks for review. */
  @Post(':id/complete')
  @HttpCode(200)
  @Roles(['admin', 'editor'])
  complete(@Param('id', ParseUUIDPipe) id: string) {
    return this.docs.complete(id);
  }

  @Get(':id/chunks')
  @Roles(['admin', 'editor'])
  chunks(@Param('id', ParseUUIDPipe) id: string) {
    return this.docs.chunks(id);
  }

  @Get(':id/file')
  @Roles(['admin', 'editor'])
  file(@Param('id', ParseUUIDPipe) id: string) {
    return this.docs.fileUrl(id);
  }

  @Patch(':id/chunks/:index')
  @Roles(['admin', 'editor'])
  updateChunk(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('index', ParseIntPipe) index: number,
    @Body() dto: UpdateChunkDto,
  ) {
    return this.docs.updateChunk(id, index, dto.content);
  }

  @Post(':id/approve')
  @HttpCode(200)
  @Roles(['admin'])
  approve(@Session() s: UserSession, @Param('id', ParseUUIDPipe) id: string) {
    return this.docs.approve(id, s.user.id);
  }

  /** Delete; on a pending_review document this is the admin's "reject". */
  @Delete(':id')
  @HttpCode(204)
  @Roles(['admin', 'editor'])
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.docs.remove(id);
  }
}
