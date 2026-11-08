from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from database import get_db
import models

router = APIRouter(prefix="", tags=["Ordenes de Servicio"])

class OrderCreate(BaseModel):
    cliente_id: int
    tecnico_id: int
    equipo: str
    descripcion: str
    presupuesto: float

class OrderResponse(BaseModel):
    id: int
    cliente_id: int
    tecnico_id: int
    equipo: str
    descripcion: str
    presupuesto: float
    estado: str
    aprobado_cliente: int

    class Config:
        from_attributes = True

@router.post("/", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
def create_order(order: OrderCreate, db: Session = Depends(get_db)):
    # Verificamos si el cliente existe
    client_exists = db.query(models.ClienteModel).filter(models.ClienteModel.id == order.cliente_id).first()
    if not client_exists:
        raise HTTPException(status_code=404, detail="El cliente asociado no existe en la base de datos")

    # Verificamos si el técnico existe
    tecnico_exists = db.query(models.TecnicoModel).filter(models.TecnicoModel.id == order.tecnico_id).first()
    if not tecnico_exists:
        raise HTTPException(status_code=404, detail="El técnico asociado no existe en la base de datos")

    db_order = models.OrdenModel(
        cliente_id=order.cliente_id,
        tecnico_id=order.tecnico_id,
        equipo=order.equipo,
        descripcion=order.descripcion,
        presupuesto=order.presupuesto,
        estado="Solicitado",
        aprobado_cliente=0
    )
    
    db.add(db_order)
    db.commit()
    db.refresh(db_order)
    return db_order

@router.get("/", response_model=List[OrderResponse])
def list_orders(db: Session = Depends(get_db)):
    orders = db.query(models.OrdenModel).all()
    return orders

@router.put("/{order_id}", response_model=OrderResponse)
def update_order_status(order_id: int, order_update: dict, db: Session = Depends(get_db)):
    db_order = db.query(models.OrdenModel).filter(models.OrdenModel.id == order_id).first()
    if not db_order:
        raise HTTPException(status_code=404, detail="Orden no encontrada")

    if "estado" in order_update:
        db_order.estado = order_update["estado"]
    if "presupuesto" in order_update:
        db_order.presupuesto = order_update["presupuesto"]

    db.commit()
    db.refresh(db_order)
    return db_order