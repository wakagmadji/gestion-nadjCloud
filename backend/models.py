from sqlalchemy import Column, String, BigInteger, Text, DateTime, ForeignKey
from sqlalchemy.dialects.mysql import CHAR
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime
import uuid

def gen_uuid():
    return str(uuid.uuid4())

class Folder(Base):
    __tablename__ = "folders"

    id = Column(CHAR(36), primary_key=True, default=gen_uuid)
    name = Column(String(255), nullable=False)
    parent_id = Column(CHAR(36), ForeignKey("folders.id", ondelete="CASCADE"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    children = relationship("Folder", cascade="all, delete-orphan")
    files = relationship("File", cascade="all, delete-orphan")


class File(Base):
    __tablename__ = "files"

    id = Column(CHAR(36), primary_key=True, default=gen_uuid)
    name = Column(String(255), nullable=False)
    ext = Column(String(50), nullable=True)
    size = Column(BigInteger, default=0)
    storage_path = Column(Text, nullable=False)
    folder_id = Column(CHAR(36), ForeignKey("folders.id", ondelete="CASCADE"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
