from pydantic import BaseModel
from typing import Optional
from datetime import datetime

# ── Folder ────────────────────────────────────────────────────────────────────
class FolderCreate(BaseModel):
    name: str
    parent_id: Optional[str] = None

class FolderResponse(BaseModel):
    id: str
    name: str
    parent_id: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True

# ── File ──────────────────────────────────────────────────────────────────────
class FileResponse(BaseModel):
    id: str
    name: str
    ext: Optional[str]
    size: int
    storage_path: str
    folder_id: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True
