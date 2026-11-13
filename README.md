# RAG System

Hỏi đáp tiếng Việt trên kho tài liệu nội bộ.

```
frontend/ (Vite + React)  ──/api──►  backend/ (NestJS, public)  ──►  rag/ (Python FastAPI, internal)
                                       │ Better Auth, role, Prisma       │ parse, chunk, embed, search, LLM
                                       │ tài liệu, lịch sử chat (PG)     │ Qdrant
             └──── PUT file (presigned) ────────► R2 / S3 ◄──── tải file để index ────┘
```

- **backend/** quản lý user, quyền, metadata tài liệu, lịch sử chat; cấp presigned URL. Là cửa duy nhất FE gọi.
- **rag/** không giữ trạng thái người dùng, chỉ nhận lệnh từ API (header `X-Internal-Token`), không mở ra ngoài.
- Ba folder độc lập (lockfile, `.nvmrc`/`.python-version` riêng, không workspace): mỗi folder build, test, deploy riêng và tách được thành repo riêng.
- **Quyền** (chỉ theo role): `admin` quản lý user + duyệt tài liệu, `editor` tải lên/sửa đoạn/xóa tài liệu, `viewer` chỉ hỏi đáp. Mọi người đăng nhập đều hỏi được trên toàn bộ tài liệu **đã duyệt**.
- **Luồng tài liệu**: `uploading → parsing → pending_review → (admin duyệt) → indexing → ready`. Parse lỗi → `failed` (parse lại); embedding lỗi → về `pending_review`; từ chối = xóa.

## Chạy (dev)

Cần Node 24 (`nvm use` trong `backend/`, `frontend/`), [uv](https://docs.astral.sh/uv/), Docker.

```bash
docker compose up -d                       # Postgres :5432, Qdrant :6333
cp rag/.env.example rag/.env               # ALIBABA_API_KEY, INTERNAL_TOKEN, S3_*
cp backend/.env.example backend/.env       # BETTER_AUTH_SECRET, RAG_INTERNAL_TOKEN (= INTERNAL_TOKEN), S3_*

cd backend && npm install && npx prisma migrate deploy
npm run create-admin -- admin@congty.vn 'MatKhau123!'   # admin đầu tiên (không có tự đăng ký)
cd ../frontend && npm install
```

Ba terminal:

```bash
cd rag && uv run uvicorn app.api:app --port 8000   # RAG nội bộ
cd backend && npm run start:dev                     # API :3000
cd frontend && npm run dev                          # Web :5173 (proxy /api -> :3000)
```

**CORS cho R2** (bắt buộc, trình duyệt PUT thẳng lên bucket): Cloudflare → R2 → bucket → Settings → CORS Policy:

```json
[{ "AllowedOrigins": ["http://localhost:5173"], "AllowedMethods": ["PUT"], "AllowedHeaders": ["content-type"], "MaxAgeSeconds": 3600 }]
```

## Test

```bash
cd rag && uv run pytest
cd backend && npm test && npm run lint
cd frontend && npm run build && npm run lint
```

## Backend

```
backend/src/
  core/                    lõi app, import 1 lần ở AppModule
    config/env.ts          kiểm tra env khi khởi động (class-validator)
    auth/auth.ts           Better Auth + role (admin/editor/viewer)
    database/              Prisma client (global, dùng chung với Better Auth)
  shared/                  thư viện dùng chung, module nào cần thì import SharedModule
    storage/               S3/R2: presign, xóa file
    rag/                   client gọi service Python
  modules/<feature>/       documents, chat
    controllers/ services/ repositories/ dto/ constants/ utils/
    <feature>.module.ts
  scripts/create-admin.ts
```

Quy ước: `modules/*` được import `core/` và `shared/`; `shared/` không import `modules/*`.

## API (backend, tiền tố `/api`)

| Method | Path | Quyền | |
|---|---|---|---|
| * | `/auth/*` | | Better Auth: `sign-in/email`, `sign-out`, `get-session`, `admin/*` |
| GET | `/documents` | đăng nhập | |
| GET | `/documents/:id` | đăng nhập | |
| POST | `/documents` | admin, editor | `{name, contentType, size}` → `{document, upload: {url, headers}}` |
| POST | `/documents/:id/complete` | admin, editor | sau khi PUT xong: parse thành chunk để duyệt (chưa embedding). Cũng để parse lại khi `failed` |
| POST | `/documents/url` | admin, editor | `{url}`, parse để duyệt |
| GET | `/documents/:id/chunks` | admin, editor | các đoạn chờ duyệt |
| PATCH | `/documents/:id/chunks/:index` | admin, editor | `{content}` sửa đoạn đọc không ra; rỗng = bỏ đoạn đó. Chỉ khi `pending_review` |
| POST | `/documents/:id/approve` | admin | embedding đúng các đoạn đã duyệt; lỗi thì quay về `pending_review` |
| DELETE | `/documents/:id` | admin, editor | xóa vector + file + bản ghi; ở `pending_review` đây là "từ chối" |
| GET | `/conversations` | đăng nhập | của chính mình |
| GET | `/conversations/:id/messages` | chủ sở hữu | |
| POST | `/conversations/ask` | đăng nhập | `{question, conversationId?}` → `{conversationId, answer, sources}` |
| DELETE | `/conversations/:id` | chủ sở hữu | |

## Để sau
Phân quyền theo nhóm/tài liệu (lọc `acl` trong Qdrant), hàng đợi ingest (`@nestjs/bullmq`), streaming câu trả lời, OpenSearch (hybrid search), ảnh/chữ viết tay (Qwen multimodal).
