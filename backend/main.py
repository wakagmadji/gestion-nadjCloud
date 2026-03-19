from fastapi import FastAPI, Depends, HTTPException, UploadFile, File as FastAPIFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from typing import List
import os, uuid, shutil
from dotenv import load_dotenv

from database import engine, get_db, Base
import models, schemas

load_dotenv()

# ── Créer les tables automatiquement ──
Base.metadata.create_all(bind=engine)

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

app = FastAPI(title="FileVault API", version="1.0.0")

# ── CORS (pour que React puisse appeler l'API) ──
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


# ── Servir les fichiers uploadés ──
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


# ════════════════════════════════════════════════════════════════════════════════
# FOLDERS
# ════════════════════════════════════════════════════════════════════════════════

@app.get("/folders", response_model=List[schemas.FolderResponse])
def get_folders(db: Session = Depends(get_db)):
    return db.query(models.Folder).order_by(models.Folder.created_at).all()


@app.post("/folders", response_model=schemas.FolderResponse, status_code=201)
def create_folder(folder: schemas.FolderCreate, db: Session = Depends(get_db)):
    # Vérifier que le parent existe si fourni
    if folder.parent_id:
        parent = db.query(models.Folder).filter(models.Folder.id == folder.parent_id).first()
        if not parent:
            raise HTTPException(status_code=404, detail="Dossier parent introuvable")

    new_folder = models.Folder(
        id=str(uuid.uuid4()),
        name=folder.name,
        parent_id=folder.parent_id,
    )
    db.add(new_folder)
    db.commit()
    db.refresh(new_folder)
    return new_folder


@app.delete("/folders/{folder_id}", status_code=204)
def delete_folder(folder_id: str, db: Session = Depends(get_db)):
    folder = db.query(models.Folder).filter(models.Folder.id == folder_id).first()
    if not folder:
        raise HTTPException(status_code=404, detail="Dossier introuvable")

    # Supprimer les fichiers physiques liés (récursif)
    def delete_files_in_folder(fid: str):
        files = db.query(models.File).filter(models.File.folder_id == fid).all()
        for f in files:
            path = os.path.join(UPLOAD_DIR, f.storage_path)
            if os.path.exists(path):
                os.remove(path)
        subfolders = db.query(models.Folder).filter(models.Folder.parent_id == fid).all()
        for sf in subfolders:
            delete_files_in_folder(sf.id)

    delete_files_in_folder(folder_id)
    db.delete(folder)
    db.commit()
    return None


# ════════════════════════════════════════════════════════════════════════════════
# FILES
# ════════════════════════════════════════════════════════════════════════════════

@app.get("/files", response_model=List[schemas.FileResponse])
def get_files(db: Session = Depends(get_db)):
    return db.query(models.File).order_by(models.File.created_at.desc()).all()


@app.post("/files/upload", response_model=schemas.FileResponse, status_code=201)
async def upload_file(
    file: UploadFile = FastAPIFile(...),
    folder_id: str = None,
    db: Session = Depends(get_db),
):
    # Vérifier le dossier si fourni
    if folder_id:
        folder = db.query(models.Folder).filter(models.Folder.id == folder_id).first()
        if not folder:
            raise HTTPException(status_code=404, detail="Dossier introuvable")

    ext = file.filename.split(".")[-1] if "." in file.filename else "txt"
    unique_name = f"{uuid.uuid4()}_{file.filename}"
    file_path = os.path.join(UPLOAD_DIR, unique_name)

    # Sauvegarder le fichier sur le disque
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    size = os.path.getsize(file_path)

    new_file = models.File(
        id=str(uuid.uuid4()),
        name=file.filename,
        ext=ext,
        size=size,
        storage_path=unique_name,
        folder_id=folder_id if folder_id else None,
    )
    db.add(new_file)
    db.commit()
    db.refresh(new_file)
    return new_file


@app.delete("/files/{file_id}", status_code=204)
def delete_file(file_id: str, db: Session = Depends(get_db)):
    file = db.query(models.File).filter(models.File.id == file_id).first()
    if not file:
        raise HTTPException(status_code=404, detail="Fichier introuvable")

    # Supprimer le fichier physique
    path = os.path.join(UPLOAD_DIR, file.storage_path)
    if os.path.exists(path):
        os.remove(path)

    db.delete(file)
    db.commit()
    return None


# ── Health check ──
@app.get("/")
def root():
    return {"status": "ok", "message": "FileVault API opérationnelle 🚀"}
