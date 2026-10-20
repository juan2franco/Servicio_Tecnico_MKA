from fastapi import APIRouter, HTTPException, status
from app.schemas.tecnicos import TecnicoCreate, TecnicoResponse
from typing import List

router = APIRouter(
    prefix="/Tecnicos",
    tags=["Tecnicos de servicio"]
)

tecnico_db = [
    {
    "id": 1,
    "full_name": "Jaime",
    "document_type": "CC",
    "especiality": "Hardware",
    "document_id": "1008776554",
    "phone": "3108876651",
    "email": "jass@gmail.com"
     }
     
]

@router.post("/", response_model=TecnicoResponse, status_code=status.HTTP_201_CREATED)
def create_tecnico(tecnico: TecnicoCreate):
    new_id = len(tecnico_db) + 1 if tecnico_db else 1
    new_tecnico = {
        "id": new_id,
        "full_name": tecnico.full_name,
        "document_type": tecnico.document_type,
        "document_id": tecnico.document_id,
        "phone": tecnico.phone,
        "especiality": tecnico.especiality,
        "email": tecnico.email
        
    }
    tecnico_db.append(new_tecnico)   

    return new_tecnico

@router.get("/", response_model=List[TecnicoResponse])
def list_tecnicos():
        return tecnico_db
    
@router.get("/{tecnico_id}", response_model=TecnicoResponse)
def get_tecnico(tecnico_id: int):
        for tecnico in tecnico_db:
            if tecnico["id"] == tecnico_id:
                return tecnico
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No se encontro el tecnico"
        )

@router.put("/{tecnico_id}", response_model=TecnicoResponse)
def datos_tecnico(tecnico_id: int, update_tecnico: TecnicoCreate):
        for tecnico in tecnico_db:
            if tecnico["id"] == tecnico_id:
                tecnico["full_name"] = update_tecnico.full_name
                tecnico["document_type"] = update_tecnico.document_type
                tecnico["document_id"] = update_tecnico.document_id
                tecnico["phone"] = update_tecnico.phone
                tecnico["especiality"] = update_tecnico.especiality
                tecnico["email"] = update_tecnico.email
                return tecnico
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No se encontro el tecnico"
        )

@router.delete("/{tecnico_id}")
def delete_tecnico(tecnico_id: int):
    for index, tecnico in enumerate(tecnico_db):
        if tecnico["id"] == tecnico_id:
            tecnico_db.remove(tecnico)
            return {"message": "Tecnico eliminado"}
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="No se encontro el tecnico"
    )   
