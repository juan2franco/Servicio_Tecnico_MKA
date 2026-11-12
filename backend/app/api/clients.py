from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from typing import List, Optional
from database import get_db
from app import seguridad
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
    # La contraseña ya NO se devuelve: el inicio de sesión se valida en el servidor (/clients/login).

    class Config:
        from_attributes = True

class LoginIn(BaseModel):
    document_id: str
    password: str

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

    datos = client.model_dump()
    datos["password"] = seguridad.cifrar(client.password)
    db_client = models.ClienteModel(**datos)
    db.add(db_client)
    db.commit()
    db.refresh(db_client)
    return db_client

@router.post("/login", response_model=ClientResponse)
def login_client(datos: LoginIn, db: Session = Depends(get_db)):
    cliente = db.query(models.ClienteModel).filter(models.ClienteModel.document_id == datos.document_id.strip()).first()
    correcta, recifrar = seguridad.verificar(datos.password, cliente.password if cliente else "")
    if not cliente or not correcta:
        raise HTTPException(status_code=401, detail="Documento o contraseña incorrectos.")
    if recifrar:
        cliente.password = seguridad.cifrar(datos.password)
        db.commit()
        db.refresh(cliente)
    return cliente

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
