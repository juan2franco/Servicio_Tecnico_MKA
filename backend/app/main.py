from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.orders import router as orders_router
from app.api.tecnicos import router as tecnicos_router
from app.api.clients import router as clients_router
import database
import models

models.Base.metadata.create_all(bind=database.engine)

app = FastAPI(title="Centro de servicio tecnico API - MKA")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Forzamos los prefijos exactos aquí en minúsculas e inglés
app.include_router(clients_router, prefix="/clients", tags=["Clients"])
app.include_router(orders_router, prefix="/orders", tags=["Orders"])
app.include_router(tecnicos_router, prefix="/tecnicos", tags=["Tecnicos"])

@app.get("/")
def root():
    return {"message": "API Activa y óptima - MKA Servicio Técnico"}