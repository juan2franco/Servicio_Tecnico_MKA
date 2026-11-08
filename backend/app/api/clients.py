from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from typing import Optional, List
from database import get_db
import models

router = APIRouter(prefix="", tags=["Clientes"])

class ClientCreate(BaseModel):
    full_name: str
    document_type: str = "CC"
    document_id: str
    email: Optional[str] = None
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
    password: Optional[str] = None

    class Config:
        from_attributes = True

@router.post("/", response_model=ClientResponse, status_code=status.HTTP_201_CREATED)
def create_client(client: ClientCreate, db: Session = Depends(get_db)):
    existing = db.query(models.ClienteModel).filter(models.ClienteModel.document_id == client.document_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe un cliente registrado con este número de documento.")

    db_client = models.ClienteModel(
        full_name=client.full_name,
        document_type=client.document_type,
        document_id=client.document_id,
        email=client.email,
        phone=client.phone,
        direccion=client.direccion,
        password=client.password
    )
    
    db.add(db_client)
    db.commit()
    db.refresh(db_client)
    
    return db_client

@router.get("/", response_model=List[ClientResponse])
def list_clients(db: Session = Depends(get_db)):
    return db.query(models.ClienteModel).all()