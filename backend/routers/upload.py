from fastapi import APIRouter, UploadFile, File, HTTPException, Request
from services.parser import parse_uploaded_file
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

ALLOWED_EXTENSIONS = {
    # Delimited text
    "csv", "tsv", "txt",
    # Excel family
    "xlsx", "xls", "xlsm", "xlsb",
    # OpenDocument
    "ods",
    # Structured / semi-structured
    "json", "xml",
    # Columnar (pandas handles natively)
    "parquet", "feather",
}

# 50 MB — practical ceiling for a browser-based analytics tool.
# Reject before reading into memory to avoid buffering huge files.
MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024  # 50 MB


@router.post("/upload")
async def upload_file(request: Request, file: UploadFile = File(...)):
    ext = (file.filename or "").rsplit(".", 1)[-1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, f"Unsupported file type: .{ext}. Allowed: {sorted(ALLOWED_EXTENSIONS)}")

    # Reject early using Content-Length if provided by the client
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            413,
            f"File too large. Maximum allowed size is {MAX_FILE_SIZE_BYTES // (1024 * 1024)} MB.",
        )

    # Stream-read with a running byte counter so we never buffer more than the limit
    chunks: list[bytes] = []
    total_bytes = 0
    chunk_size = 64 * 1024  # 64 KB per chunk
    while True:
        chunk = await file.read(chunk_size)
        if not chunk:
            break
        total_bytes += len(chunk)
        if total_bytes > MAX_FILE_SIZE_BYTES:
            raise HTTPException(
                413,
                f"File too large. Maximum allowed size is {MAX_FILE_SIZE_BYTES // (1024 * 1024)} MB.",
            )
        chunks.append(chunk)

    contents = b"".join(chunks)

    try:
        result = await parse_uploaded_file(contents, file.filename or "data.csv")
        return result
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        logger.error(f"File parse error: {str(e)}")
        raise HTTPException(500, "Failed to parse file. Please check the file format.")
