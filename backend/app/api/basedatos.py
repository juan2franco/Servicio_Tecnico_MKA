"""Visor de la base de datos (solo lectura) para el panel de MKA.

Solo responde a peticiones hechas desde el mismo PC donde corre la API
(http://localhost:8000). Quien entra por el enlace público o por la red
recibe 403. Las columnas de contraseña nunca se muestran.
En Docker se usa Adminer (http://localhost:8081) en su lugar.
"""

import os
from datetime import date, datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import MetaData, Table, func, inspect, select
from sqlalchemy.orm import Session

import database
from database import get_db

CABECERAS_DE_PROXY = ("cf-connecting-ip", "cf-ray", "x-forwarded-for", "x-real-ip", "forwarded")
COLUMNAS_OCULTAS = {"password", "contrasena", "clave"}


def solo_este_pc(request: Request) -> None:
    if os.getenv("MKA_EN_DOCKER") == "1":
        raise HTTPException(status_code=403, detail="En Docker la base de datos se ve con Adminer: http://localhost:8081")
    host = request.client.host if request.client else ""
    if host not in ("127.0.0.1", "::1") or any(c in request.headers for c in CABECERAS_DE_PROXY):
        raise HTTPException(status_code=403,
                            detail="La base de datos solo se puede ver desde el PC donde corre MKA (http://localhost:8000).")


router = APIRouter(prefix="/basedatos", tags=["Base de datos (solo en este PC)"],
                   dependencies=[Depends(solo_este_pc)])


def _valor(v):
    if isinstance(v, (datetime, date)):
        return v.isoformat()
    if isinstance(v, Decimal):
        return float(v)
    if isinstance(v, (bytes, bytearray)):
        return f"<{len(v)} bytes>"
    return v


def _tabla(nombre: str) -> Table:
    if nombre not in inspect(database.engine).get_table_names():
        raise HTTPException(status_code=404, detail="Esa tabla no existe.")
    return Table(nombre, MetaData(), autoload_with=database.engine)


@router.get("")
def resumen(db: Session = Depends(get_db)):
    url = database.engine.url
    motor = url.get_backend_name()
    ubicacion = url.database if motor == "sqlite" else f"{url.host}:{url.port or 3306}/{url.database}"
    tablas = []
    for nombre in sorted(inspect(database.engine).get_table_names()):
        tabla = _tabla(nombre)
        filas = db.execute(select(func.count()).select_from(tabla)).scalar() or 0
        tablas.append({"nombre": nombre, "filas": filas, "columnas": [c.name for c in tabla.columns]})
    return {"motor": motor, "ubicacion": ubicacion, "tablas": tablas}


@router.get("/{nombre}")
def ver_tabla(
    nombre: str,
    limite: int = Query(50, ge=1, le=500),
    pagina: int = Query(1, ge=1),
    db: Session = Depends(get_db),
):
    tabla = _tabla(nombre)
    total = db.execute(select(func.count()).select_from(tabla)).scalar() or 0
    consulta = select(tabla)
    llave = list(tabla.primary_key.columns)
    if llave:
        consulta = consulta.order_by(*[c.desc() for c in llave])
    consulta = consulta.limit(limite).offset((pagina - 1) * limite)

    filas = []
    for fila in db.execute(consulta).mappings():
        filas.append({
            col: ("••••••" if col.lower() in COLUMNAS_OCULTAS and val else _valor(val))
            for col, val in fila.items()
        })
    return {
        "tabla": nombre,
        "columnas": [c.name for c in tabla.columns],
        "total": total,
        "pagina": pagina,
        "limite": limite,
        "filas": filas,
    }
