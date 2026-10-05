import uuid
from pathlib import Path
from fastapi import UploadFile, HTTPException

from app.core.paths import UPLOAD_DIR
ALLOWED_IMAGE_TYPES = {"image/png", "image/jpeg", "image/x-icon", "image/svg+xml", "image/webp"}
MAX_UPLOAD_BYTES = 5 * 1024 * 1024  # 5MB - reference photos tend to be larger than logos


async def save_uploaded_image(file: UploadFile, subfolder: str) -> str:
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported image type")
    contents = await file.read()
    if len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=400, detail="Image must be under 5MB")

    ext = Path(file.filename or "").suffix or ".png"
    filename = f"{uuid.uuid4()}{ext}"
    dest_dir = UPLOAD_DIR / subfolder
    dest_dir.mkdir(parents=True, exist_ok=True)
    (dest_dir / filename).write_bytes(contents)
    return f"/static/uploads/{subfolder}/{filename}"
