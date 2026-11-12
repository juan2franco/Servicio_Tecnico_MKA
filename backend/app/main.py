from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles

from app.api.orders import router as orders_router
from app.api.tecnicos import router as tecnicos_router
from app.api.clients import router as clients_router
from app.api.nfc import router as nfc_router, router_rfid
from app.api.compartir import router as compartir_router
from app.api.basedatos import router as basedatos_router
import database
import migraciones
import models

models.Base.metadata.create_all(bind=database.engine)
migraciones.aplicar(database.engine)

app = FastAPI(title="Centro de servicio tecnico API - MKA")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Incluimos los routers directamente (el prefijo ya lo maneja cada archivo api)
app.include_router(clients_router)
app.include_router(orders_router)
app.include_router(tecnicos_router)
app.include_router(nfc_router)
app.include_router(router_rfid)
app.include_router(compartir_router)
app.include_router(basedatos_router)

# Sirve la página web en http://localhost:8000/app/ (si la carpeta frontend está al lado de backend).
FRONTEND_DIR = Path(__file__).resolve().parents[2] / "frontend"


@app.get("/salud")
def salud():
    return {"message": "API Activa y óptima - MKA Servicio Técnico", "panel": "/app/"}


@app.get("/")
def root():
    # Quien abre el enlace sin /app/ llega directo al panel.
    if FRONTEND_DIR.is_dir():
        return RedirectResponse(url="/app/")
    return salud()


if FRONTEND_DIR.is_dir():
    app.mount("/app", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
