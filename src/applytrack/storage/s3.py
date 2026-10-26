"""An S3-compatible bucket, such as Cloudflare R2."""

from datetime import timedelta
from typing import TYPE_CHECKING, Self

import boto3
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError

from applytrack.storage import StorageError, UploadLink, check_key, content_disposition

if TYPE_CHECKING:
    from types_boto3_s3 import S3Client

_MISSING = {"404", "NoSuchKey", "NotFound"}


class S3Storage:
    def __init__(self, client: "S3Client", bucket: str) -> None:
        self.client = client
        self.bucket = bucket

    @classmethod
    def connect(
        cls, *, endpoint: str, bucket: str, access_key_id: str, secret_access_key: str, region: str
    ) -> Self:
        client = boto3.client(
            "s3",
            endpoint_url=endpoint,
            aws_access_key_id=access_key_id,
            aws_secret_access_key=secret_access_key,
            region_name=region,
            config=Config(
                signature_version="s3v4",
                connect_timeout=5,
                read_timeout=30,
                retries={"max_attempts": 3, "mode": "standard"},
            ),
        )
        return cls(client, bucket)

    def upload_link(
        self, key: str, *, content_type: str, size: int, expires: timedelta
    ) -> UploadLink:
        # Content-Type and Content-Length are signed: storage refuses any other file.
        url = self.client.generate_presigned_url(
            "put_object",
            Params={
                "Bucket": self.bucket,
                "Key": check_key(key),
                "ContentType": content_type,
                "ContentLength": size,
            },
            ExpiresIn=int(expires.total_seconds()),
        )
        return UploadLink(url, {"Content-Type": content_type})

    def download_link(self, key: str, *, filename: str, expires: timedelta) -> str:
        return self.client.generate_presigned_url(
            "get_object",
            Params={
                "Bucket": self.bucket,
                "Key": check_key(key),
                "ResponseContentDisposition": content_disposition(filename),
            },
            ExpiresIn=int(expires.total_seconds()),
        )

    def size(self, key: str) -> int | None:
        try:
            return self.client.head_object(Bucket=self.bucket, Key=check_key(key))["ContentLength"]
        except ClientError as exc:
            if exc.response.get("Error", {}).get("Code") in _MISSING:
                return None
            raise StorageError(str(exc)) from exc
        except BotoCoreError as exc:
            raise StorageError(str(exc)) from exc

    def read(self, key: str) -> bytes:
        try:
            return self.client.get_object(Bucket=self.bucket, Key=check_key(key))["Body"].read()
        except (BotoCoreError, ClientError) as exc:
            raise StorageError(str(exc)) from exc

    def delete(self, key: str) -> None:
        try:
            self.client.delete_object(Bucket=self.bucket, Key=check_key(key))
        except (BotoCoreError, ClientError) as exc:
            raise StorageError(str(exc)) from exc
