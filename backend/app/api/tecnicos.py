from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from database import get_db
import models

router = APIRouter(prefix="/tecnicos", tags=["Tecnicos"])

class TecnicoCreate(BaseModel):
    nombre: str
    especialidad: Optional[str] = None
    telefono: Optional[str] = None
    document_type: Optional[str] = "CC"
    document_id: str
    password: str

class TecnicoResponse(BaseModel):
    id: int
    nombre: str
    especialidad: Optional[str] = None
    telefono: Optional[str] = None
    document_id: str
    password: str  # <--- Necesario para que el login lo valide en el frontend

    class Config:
        from_attributes = True

@router.post("/", response_model=TecnicoResponse, status_code=status.HTTP_201_CREATED)
def create_tecnico(tecnico: TecnicoCreate, db: Session = Depends(get_db)):
    existing = db.query(models.TecnicoModel).filter(models.TecnicoModel.document_id == tecnico.document_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe un técnico con este documento.")
    
    db_tecnico = models.TecnicoModel(**tecnico.model_dump())
    db.add(db_tecnico)
    db.commit()
    db.refresh(db_tecnico)
    return db_tecnico

@router.get("/", response_model=List[TecnicoResponse])
def list_tecnicos(db: Session = Depends(get_db)):
    return db.query(models.TecnicoModel).all()