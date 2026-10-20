
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.orders import router as orders_router
from app.api.tecnicos import router as tecnicos_router
from app.api.clients import router as clients_router

app = FastAPI(title="Centro de servicio tecnico API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(clients_router)
app.include_router(orders_router)
app.include_router(tecnicos_router)

@app.get("/")
def root():
    return {"message": "API Activa y optima"}




    
    
    