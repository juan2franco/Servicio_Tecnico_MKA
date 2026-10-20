from fastapi import APIRouter, HTTPException, status
from app.schemas.order import OrderCreate, OrderResponse
from datetime import datetime
from typing import List


router = APIRouter(
    prefix="/Ordenes",
    tags=["Ordenes de servicio"]
)
order_db = [
    {
    "id": 1,
    "device_name": "ASUS",
    "issue_description": "Pantalla dañada",
    "client_name": "Carlos",
    "estimated_cost": 100000.0,
    "status": "Pendiente",
     "created_at": datetime.now()
     }
     
    
]

@router.post("/", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
def create_order(order: OrderCreate):
    new_id = len(order_db) + 1 if order_db else 1
    nwe_order = {
        "id": new_id,
        "device_name": order.device_name,
        "issue_description": order.issue_description,
        "client_name": order.client_name,
        "estimated_cost": order.estimated_cost,
        "status": "Pendiente",
        "created_at": datetime.now()
    }
    order_db.append(nwe_order)
    return nwe_order


@router.get("/", response_model=List[OrderResponse])
def list_orders():
        return order_db
    
@router.get("/{id}", response_model=OrderResponse)
def get_order(id: int):
        for order in order_db:
            if order["id"] == id:
                return order 
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No se encontro el pedido"
        )
        
@router.put("/{id}", response_model=OrderResponse)
def update_order(id: int, udate_order: OrderCreate):
        for order in order_db:
            if order["id"] == id:
                order["device_name"] = udate_order.device_name
                order["issue_description"] = udate_order.issue_description
                order["client_name"] = udate_order.client_name
                order["estimated_cost"] = udate_order.estimated_cost
                return order
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No se encontro el pedido"
        )
        
@router.delete("/{id}")
def delete_order(id: int):
    for order in order_db:
        if order["id"] == id:
            order_db.remove(order)
            return {"message": "Pedido eliminado"}
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="No se encontro el pedido"
    )
    

    