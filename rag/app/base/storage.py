from functools import lru_cache

import boto3

from app.config import settings


@lru_cache
def s3():
    # S3 API works for R2, Alibaba OSS, AWS: swap provider via S3_* env only
    return boto3.client(
        "s3",
        endpoint_url=settings.s3_endpoint_url,
        aws_access_key_id=settings.s3_access_key_id,
        aws_secret_access_key=settings.s3_secret_access_key,
        region_name="auto",  # R2 requires "auto"
    )


def download(key: str, path: str) -> None:
    s3().download_file(settings.s3_bucket, key, path)
