from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.schemas.order import OrderCreate, OrderResponse  # Ajusta según tus esquemas actuales
from database import get_db
import models
from typing import List

router = APIRouter(
    prefix="",  # Vacío para que tome el prefijo /orders o /ordenes del main.py
    tags=["Ordenes de Servicio"]
)

@router.post("/", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
def create_order(order: OrderCreate, db: Session = Depends(get_db)):
    # Verificamos primero si el cliente asociado existe en la base de datos
    client_exists = db.query(models.ClienteModel).filter(models.ClienteModel.id == order.cliente_id).first()
    if not client_exists:
        raise HTTPException(status_code=404, detail="El cliente asociado no existe")

    # Creamos la orden usando el modelo de SQLAlchemy (cambia OrdenModel si tu clase se llama diferente)
    db_order = models.OrdenModel(
        cliente_id=order.cliente_id,
        equipo=order.equipo,
        descripcion=order.descripcion,
        estado=order.estado or "Solicitado"
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
    
    db.commit()
    db.refresh(db_order)
    return db_order
    