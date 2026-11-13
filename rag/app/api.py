import secrets
import tempfile
from pathlib import Path
from typing import Literal

from botocore.exceptions import BotoCoreError, ClientError
from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.responses import JSONResponse
from openai import APIError
from pydantic import BaseModel, HttpUrl, model_validator

from app.base import storage
from app.config import settings
from app.rag import index, retrieval


def internal_only(x_internal_token: str = Header(default="")):
    # only the NestJS API may call this service; it handles users and permissions
    if not secrets.compare_digest(x_internal_token, settings.internal_token):
        raise HTTPException(401, "invalid internal token")


app = FastAPI(title="RAG Service (internal)", dependencies=[Depends(internal_only)])


@app.exception_handler(APIError)
def alibaba_error(_: Request, e: APIError):
    # The openai SDK already retried 5xx/429; surface it as an upstream failure.
    return JSONResponse(status_code=502, content={"detail": f"Alibaba API lỗi: {e}"})


@app.exception_handler(ClientError)
@app.exception_handler(BotoCoreError)
def storage_error(_: Request, e: Exception):
    return JSONResponse(status_code=502, content={"detail": f"Storage lỗi: {e}"})


class ParseRequest(BaseModel):
    name: str  # file name; its extension picks the parser
    key: str | None = None  # object key in storage
    url: HttpUrl | None = None

    @model_validator(mode="after")
    def one_source(self):
        if (self.key is None) == (self.url is None):
            raise ValueError("cần đúng một trong key hoặc url")
        return self


class IngestRequest(BaseModel):
    doc_id: str
    name: str  # shown as the citation source
    chunks: list[str]


class Message(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class AskRequest(BaseModel):
    question: str
    history: list[Message] = []


@app.post("/parse")
def parse(req: ParseRequest):
    try:
        if req.url:
            return {"chunks": index.split(str(req.url), req.name)}
        with tempfile.NamedTemporaryFile(suffix=Path(req.key).suffix) as tmp:
            storage.download(req.key, tmp.name)
            return {"chunks": index.split(tmp.name, req.name)}
    except ValueError as e:
        raise HTTPException(400, str(e))


@app.post("/ingest")
def ingest(req: IngestRequest):
    try:
        return {"chunks": index.ingest(req.doc_id, req.name, req.chunks)}
    except ValueError as e:
        raise HTTPException(400, str(e))


@app.delete("/documents/{doc_id}")
def delete_document(doc_id: str):
    index.delete(doc_id)
    return {"ok": True}


@app.post("/ask")
def ask(req: AskRequest):
    return retrieval.ask(req.question, [m.model_dump() for m in req.history])
