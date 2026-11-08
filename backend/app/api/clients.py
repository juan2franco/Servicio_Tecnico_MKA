from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from typing import List, Optional
from database import get_db
import models

router = APIRouter(prefix="/clients", tags=["Clientes"])

class ClientCreate(BaseModel):
    full_name: str
    document_type: str = "CC"
    document_id: str
    email: Optional[EmailStr] = None
    phone: str
    direccion: str
    password: str

class ClientResponse(BaseModel):
    id: int
    full_name: str
    document_type: str
    document_id: str
    email: Optional[str] = None
    phone: str
    direccion: str
    password: str  # <--- Necesario para que el login lo valide en el frontend

    class Config:
        from_attributes = True

class DispositivoCreate(BaseModel):
    cliente_id: int
    nombre_equipo: str
    marca: str
    serial_modelo: Optional[str] = "N/A"

class DispositivoResponse(BaseModel):
    id: int
    cliente_id: int
    nombre_equipo: str
    marca: str
    serial_modelo: Optional[str]

    class Config:
        from_attributes = True

@router.post("/", response_model=ClientResponse, status_code=status.HTTP_201_CREATED)
def create_client(client: ClientCreate, db: Session = Depends(get_db)):
    existing = db.query(models.ClienteModel).filter(models.ClienteModel.document_id == client.document_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe un cliente registrado con este documento.")
    
    db_client = models.ClienteModel(**client.model_dump())
    db.add(db_client)
    db.commit()
    db.refresh(db_client)
    return db_client

@router.get("/", response_model=List[ClientResponse])
def list_clients(db: Session = Depends(get_db)):
    return db.query(models.ClienteModel).all()

@router.post("/dispositivos/", response_model=DispositivoResponse, status_code=201)
def registrar_dispositivo(disp: DispositivoCreate, db: Session = Depends(get_db)):
    nuevo_disp = models.DispositivoModel(**disp.model_dump())
    db.add(nuevo_disp)
    db.commit()
    db.refresh(nuevo_disp)
    return nuevo_disp

@router.get("/dispositivos/{cliente_id}", response_model=List[DispositivoResponse])
def listar_dispositivos_cliente(cliente_id: int, db: Session = Depends(get_db)):
    return db.query(models.DispositivoModel).filter(models.DispositivoModel.cliente_id == cliente_id).all()