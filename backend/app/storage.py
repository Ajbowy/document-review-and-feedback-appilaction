from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, UploadFile

from app.config import settings

ALLOWED_EXTENSIONS = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
}


def ensure_upload_dir() -> Path:
    upload_dir = settings.upload_dir_path
    upload_dir.mkdir(parents=True, exist_ok=True)
    return upload_dir


def save_uploaded_document(file: UploadFile) -> tuple[str, str]:
    if file.filename is None or file.filename == "":
        raise HTTPException(status_code=400, detail="A file is required")

    suffix = Path(file.filename).suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type. Allowed: PDF, PNG, JPG, JPEG.",
        )

    content_type = (file.content_type or "").lower()
    expected_mime = ALLOWED_EXTENSIONS[suffix]
    if content_type and content_type != expected_mime:
        raise HTTPException(
            status_code=400,
            detail=f"File type mismatch for {file.filename}. Expected {expected_mime}.",
        )

    ensure_upload_dir()
    unique_name = f"{uuid4().hex}{suffix}"
    target_path = settings.upload_dir_path / unique_name

    if file.file is None:
        raise HTTPException(status_code=400, detail="No file content uploaded")

    file.file.seek(0)
    with target_path.open("wb") as output_file:
        while True:
            chunk = file.file.read(1024 * 1024)
            if not chunk:
                break
            output_file.write(chunk)

    return str(target_path.resolve()), unique_name
