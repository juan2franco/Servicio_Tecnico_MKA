from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from database import get_db
import models

router = APIRouter(prefix="", tags=["Tecnicos de servicio"])

class TecnicoCreate(BaseModel):
    full_name: str
    document_type: str = "CC"
    document_id: str
    phone: str
    especialidad: str
    password: str

class TecnicoResponse(BaseModel):
    id: int
    full_name: str
    document_type: str
    document_id: str
    phone: str
    especialidad: str
    password: Optional[str] = None

    class Config:
        from_attributes = True

@router.post("/", response_model=TecnicoResponse, status_code=status.HTTP_201_CREATED)
def create_tecnico(tecnico: TecnicoCreate, db: Session = Depends(get_db)):
    existing = db.query(models.TecnicoModel).filter(models.TecnicoModel.document_id == tecnico.document_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe un técnico registrado con esta cédula.")

    db_tecnico = models.TecnicoModel(
        nombre=tecnico.full_name,
        document_type=tecnico.document_type,
        document_id=tecnico.document_id,
        telefono=tecnico.phone,
        especialidad=tecnico.especialidad,
        password=tecnico.password
    )
    
    db.add(db_tecnico)
    db.commit()
    db.refresh(db_tecnico)
    
    return TecnicoResponse(
        id=db_tecnico.id,
        full_name=db_tecnico.nombre,
        document_type=db_tecnico.document_type,
        document_id=db_tecnico.document_id,
        phone=db_tecnico.telefono,
        especialidad=db_tecnico.especialidad,
        password=db_tecnico.password
    )

@router.get("/", response_model=List[TecnicoResponse])
def list_tecnicos(db: Session = Depends(get_db)):
    tecnicos = db.query(models.TecnicoModel).all()
    resultado = []
    for t in tecnicos:
        resultado.append(
            TecnicoResponse(
                id=t.id,
                full_name=t.nombre,
                document_type=t.document_type,
                document_id=t.document_id,
                phone=t.telefono,
                especialidad=t.especialidad,
                password=t.password
            )
        )
    return resultado