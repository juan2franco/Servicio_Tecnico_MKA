from fastapi import APIRouter, HTTPException, status
from app.schemas.client import ClientCreate, ClientResponse
from typing import List

router = APIRouter(
    prefix="/Clientes",
    tags=["Clientes de servicio"]
)

client_db = [
    {
    "id": 1,
    "full_name": "Carlos",
    "document_type": "CC",
    "document_id": "1008776554",
    "phone": "3108876651",
    "email": "carlos@gmail.com",
    "direccion": "Calle 15 # 5-12"
     }
     
]

@router.post("/", response_model=ClientResponse, status_code=status.HTTP_201_CREATED)
def create_client(client: ClientCreate):
    new_id = len(client_db) + 1 if client_db else 1
    new_client = {
        "id": new_id,
        "full_name": client.full_name,
        "document_type": client.document_type,
        "document_id": client.document_id,
        "phone": client.phone,
        "email": client.email,
        "direccion": client.direccion
        
    }
    client_db.append(new_client)   
    # Mirar que hace esto
    return new_client

@router.get("/", response_model=List[ClientResponse])
def list_clients():
        return client_db
    
@router.get("/{client_id}", response_model=ClientResponse, status_code=status.HTTP_200_OK)
def get_client(client_id: int):
        for client in client_db:
            if client["id"] == client_id:
                return client
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No se encontro el cliente"
        )

@router.put("/{client_id}", response_model=ClientResponse)
def update_client(client_id: int, update_client: ClientCreate):
        for client in client_db:
            if client["id"] == client_id:
                client["full_name"] = update_client.full_name
                client["document_type"] = update_client.document_type
                client["document_id"] = update_client.document_id
                client["phone"] = update_client.phone
                client["email"] = update_client.email
                client["direccion"] = update_client.direccion
                return client
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No se encontro el cliente"
        )

@router.delete("/{client_id}")
def delete_client(client_id: int):
    for index, client in enumerate(client_db):
        if client["id"] == client_id:
            client_db.remove(client)
            return {"message": "Cliente eliminado"}
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="No se encontro el cliente"
    )
    
    
    
