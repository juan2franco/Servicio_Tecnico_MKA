from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from database import get_db
from app import seguridad
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
    # La contraseña ya NO se devuelve: el inicio de sesión se valida en el servidor (/tecnicos/login).

    class Config:
        from_attributes = True

class LoginIn(BaseModel):
    document_id: str
    password: str

@router.post("/", response_model=TecnicoResponse, status_code=status.HTTP_201_CREATED)
def create_tecnico(tecnico: TecnicoCreate, db: Session = Depends(get_db)):
    existing = db.query(models.TecnicoModel).filter(models.TecnicoModel.document_id == tecnico.document_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe un técnico con este documento.")

    datos = tecnico.model_dump()
    datos["password"] = seguridad.cifrar(tecnico.password)
    db_tecnico = models.TecnicoModel(**datos)
    db.add(db_tecnico)
    db.commit()
    db.refresh(db_tecnico)
    return db_tecnico

@router.post("/login", response_model=TecnicoResponse)
def login_tecnico(datos: LoginIn, db: Session = Depends(get_db)):
    tecnico = db.query(models.TecnicoModel).filter(models.TecnicoModel.document_id == datos.document_id.strip()).first()
    correcta, recifrar = seguridad.verificar(datos.password, tecnico.password if tecnico else "")
    if not tecnico or not correcta:
        raise HTTPException(status_code=401, detail="Cédula o contraseña incorrectas.")
    if recifrar:
        tecnico.password = seguridad.cifrar(datos.password)
        db.commit()
        db.refresh(tecnico)
    return tecnico

@router.get("/", response_model=List[TecnicoResponse])
def list_tecnicos(db: Session = Depends(get_db)):
    return db.query(models.TecnicoModel).all()
