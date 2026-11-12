"""Lector NFC de MKA.

Flujo:
  Arduino/ESP32 lee la tarjeta -> POST /nfc/lecturas -> queda en `nfc_lecturas`
  El panel técnico (localhost) consulta /nfc/estado cada segundo y abre la ficha.
  Si la tarjeta es nueva, el técnico registra el equipo y queda vinculada.
  En la ficha se editan los datos del equipo y se lleva el historial técnico.

/rfid/lecturas se mantiene como alias para el sketch WiFi anterior del ESP32.
"""

import re
import threading
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

import models
from database import get_db

router = APIRouter(prefix="/nfc", tags=["Lector NFC"])
router_rfid = APIRouter(prefix="/rfid", tags=["Lector NFC (compatibilidad ESP32)"])

# Un lector se considera conectado si habló con la API en los últimos N segundos.
SEGUNDOS_CONECTADO = 15
LECTOR_MANUAL = "MANUAL"

_lectores: dict = {}
_lock = threading.Lock()


# ---------------------------------------------------------------------------
# Esquemas
# ---------------------------------------------------------------------------

class _Base(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)


class LecturaIn(_Base):
    uid: str = Field(..., min_length=1, max_length=64)
    lector: Optional[str] = Field("LECTOR", max_length=50)
    tipo_tarjeta: Optional[str] = Field(None, max_length=50)


class HeartbeatIn(_Base):
    lector: str = Field(..., min_length=1, max_length=50)
    modo: Optional[str] = Field(None, max_length=20)
    puerto: Optional[str] = Field(None, max_length=50)
    chip_ok: Optional[bool] = None


class EquipoCampos(_Base):
    serial_modelo: Optional[str] = Field(None, max_length=50)
    tipo_equipo: Optional[str] = Field(None, max_length=50)
    color: Optional[str] = Field(None, max_length=30)
    accesorios: Optional[str] = Field(None, max_length=200)
    estado_fisico: Optional[str] = Field(None, max_length=200)
    notas: Optional[str] = Field(None, max_length=5000)


class EquipoNuevo(EquipoCampos):
    uid: str = Field(..., min_length=1, max_length=64)
    cliente_id: int
    nombre_equipo: str = Field(..., min_length=1, max_length=100)
    marca: str = Field(..., min_length=1, max_length=50)
    tecnico_id: Optional[int] = None


class EquipoEditar(EquipoCampos):
    nombre_equipo: Optional[str] = Field(None, max_length=100)
    marca: Optional[str] = Field(None, max_length=50)


class VincularIn(_Base):
    uid: str = Field(..., min_length=1, max_length=64)
    dispositivo_id: int
    reemplazar: bool = False
    tecnico_id: Optional[int] = None


class HistorialIn(_Base):
    tipo: str = Field("Nota", min_length=1, max_length=40)
    descripcion: str = Field(..., min_length=1, max_length=5000)
    repuestos: Optional[str] = Field(None, max_length=200)
    costo: Optional[float] = Field(None, ge=0)
    tecnico_id: Optional[int] = None
    orden_id: Optional[int] = None
    publicar_en_orden: bool = False


class HistorialEditar(_Base):
    tipo: Optional[str] = Field(None, max_length=40)
    descripcion: Optional[str] = Field(None, max_length=5000)
    repuestos: Optional[str] = Field(None, max_length=200)
    costo: Optional[float] = Field(None, ge=0)
    orden_id: Optional[int] = None


# ---------------------------------------------------------------------------
# Utilidades
# ---------------------------------------------------------------------------

def normalizar_uid(uid: str) -> str:
    """'04a31f9c', '04:A3:1F:9C' y '04 A3 1F 9C' quedan todos como '04 A3 1F 9C'."""
    crudo = uid.strip()
    limpio = re.sub(r"[\s:\-]", "", crudo).upper()
    if limpio and len(limpio) % 2 == 0 and re.fullmatch(r"[0-9A-F]+", limpio):
        return " ".join(limpio[i:i + 2] for i in range(0, len(limpio), 2))
    return re.sub(r"\s+", " ", crudo).upper()


def _uid_valido(uid: str) -> str:
    normal = normalizar_uid(uid)
    if not normal or len(normal) > 40:
        raise HTTPException(status_code=400, detail="UID de tarjeta inválido.")
    return normal


def _sin_vacios(datos: dict) -> dict:
    return {k: (None if isinstance(v, str) and v == "" else v) for k, v in datos.items()}


def _iso(fecha: Optional[datetime]) -> Optional[str]:
    return fecha.isoformat(timespec="seconds") if fecha else None


def _marcar_lector(lector: str, **datos) -> None:
    with _lock:
        info = _lectores.setdefault(lector, {"lector": lector})
        info.update({k: v for k, v in datos.items() if v is not None})
        info["ultimo_contacto"] = datetime.now()


def _tag_por_uid(db: Session, uid: str):
    return db.query(models.NfcTagModel).filter(models.NfcTagModel.uid == uid).first()


def _dispositivo_o_404(db: Session, dispositivo_id: int):
    disp = db.get(models.DispositivoModel, dispositivo_id)
    if not disp:
        raise HTTPException(status_code=404, detail="Equipo no encontrado.")
    return disp


def _tecnico_valido(db: Session, tecnico_id: Optional[int]) -> Optional[int]:
    if tecnico_id is None:
        return None
    return tecnico_id if db.get(models.TecnicoModel, tecnico_id) else None


def _cliente_dict(c) -> Optional[dict]:
    if c is None:
        return None
    return {
        "id": c.id,
        "full_name": c.full_name,
        "document_type": c.document_type,
        "document_id": c.document_id,
        "phone": c.phone,
        "email": c.email,
        "direccion": c.direccion,
    }


def _orden_dict(o) -> dict:
    return {
        "id": o.id,
        "equipo": o.equipo,
        "descripcion": o.descripcion,
        "estado": o.estado,
        "avance_realtime": o.avance_realtime,
        "presupuesto": float(o.presupuesto or 0),
        "tecnico_id": o.tecnico_id,
    }


def _dispositivo_dict(d) -> dict:
    return {
        "id": d.id,
        "cliente_id": d.cliente_id,
        "nombre_equipo": d.nombre_equipo,
        "marca": d.marca,
        "serial_modelo": d.serial_modelo,
        "tipo_equipo": d.tipo_equipo,
        "color": d.color,
        "accesorios": d.accesorios,
        "estado_fisico": d.estado_fisico,
        "notas": d.notas,
        "uid": d.tag.uid if d.tag else None,
    }


def _historial_dict(h) -> dict:
    return {
        "id": h.id,
        "dispositivo_id": h.dispositivo_id,
        "fecha": _iso(h.fecha),
        "editado_en": _iso(h.editado_en),
        "tipo": h.tipo,
        "descripcion": h.descripcion,
        "repuestos": h.repuestos,
        "costo": h.costo,
        "tecnico_id": h.tecnico_id,
        "tecnico_nombre": h.tecnico.nombre if h.tecnico else None,
        "orden_id": h.orden_id,
    }


def _ordenes_activas(db: Session, d) -> list:
    """Órdenes no finalizadas del cliente; primero las que mencionan este equipo."""
    ordenes = (
        db.query(models.OrdenModel)
        .filter(models.OrdenModel.cliente_id == d.cliente_id, models.OrdenModel.estado != "Finalizado")
        .order_by(models.OrdenModel.id.desc())
        .all()
    )
    nombre = (d.nombre_equipo or "").strip().lower()

    def menciona_equipo(o) -> bool:
        equipo = (o.equipo or "").strip().lower()
        return bool(nombre and equipo) and (nombre in equipo or equipo in nombre)

    ordenes.sort(key=lambda o: not menciona_equipo(o))
    return ordenes


def _ficha(db: Session, d, limite_historial: Optional[int] = None) -> dict:
    historial = list(d.historial)
    if limite_historial:
        historial = historial[:limite_historial]
    ordenes = _ordenes_activas(db, d)
    return {
        "dispositivo": _dispositivo_dict(d),
        "cliente": _cliente_dict(d.cliente),
        "orden": _orden_dict(ordenes[0]) if ordenes else None,
        "ordenes_activas": [_orden_dict(o) for o in ordenes],
        "historial": [_historial_dict(h) for h in historial],
    }


def _anotar(db: Session, disp_id: int, tipo: str, descripcion: str, tecnico_id: Optional[int] = None) -> None:
    db.add(models.HistorialEquipoModel(
        dispositivo_id=disp_id,
        tecnico_id=_tecnico_valido(db, tecnico_id),
        tipo=tipo,
        descripcion=descripcion,
    ))


# ---------------------------------------------------------------------------
# Lecturas y estado del lector
# ---------------------------------------------------------------------------

@router.post("/lecturas", status_code=201)
def registrar_lectura(lectura: LecturaIn, db: Session = Depends(get_db)):
    """Lo llama el Arduino (por el puente USB) o el ESP32 (por WiFi) al pasar una tarjeta."""
    uid = _uid_valido(lectura.uid)
    lector = (lectura.lector or "LECTOR").strip() or "LECTOR"
    tag = _tag_por_uid(db, uid)

    registro = models.NfcLecturaModel(
        uid=uid,
        lector=lector,
        tipo_tarjeta=lectura.tipo_tarjeta or None,
        dispositivo_id=tag.dispositivo_id if tag else None,
    )
    db.add(registro)
    db.commit()
    db.refresh(registro)

    if lector != LECTOR_MANUAL:
        _marcar_lector(lector)

    respuesta = {
        "lectura_id": registro.id,
        "uid": uid,
        "lector": lector,
        "fecha": _iso(registro.fecha),
        "registrado": tag is not None,
    }
    if tag is None:
        respuesta.update({
            "mensaje": "Tarjeta no registrada. Registrala desde el panel tecnico (pestana Lector NFC).",
            "dispositivo": None,
            "cliente": None,
            "orden": None,
            "ordenes_activas": [],
            "historial": [],
        })
        return respuesta

    respuesta.update(_ficha(db, tag.dispositivo, limite_historial=5))
    respuesta["mensaje"] = f"Equipo reconocido: {tag.dispositivo.nombre_equipo}"
    return respuesta


@router.get("/lecturas")
def listar_lecturas(
    limite: int = Query(30, ge=1, le=200),
    despues_de: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """Registro de lecturas, de la más nueva a la más vieja."""
    consulta = db.query(models.NfcLecturaModel)
    if despues_de:
        consulta = consulta.filter(models.NfcLecturaModel.id > despues_de)
    lecturas = consulta.order_by(models.NfcLecturaModel.id.desc()).limit(limite).all()

    uids = {l.uid for l in lecturas}
    tags = {}
    if uids:
        tags = {t.uid: t for t in db.query(models.NfcTagModel).filter(models.NfcTagModel.uid.in_(list(uids))).all()}

    salida = []
    for l in lecturas:
        tag = tags.get(l.uid)
        disp = tag.dispositivo if tag else None
        salida.append({
            "id": l.id,
            "uid": l.uid,
            "lector": l.lector,
            "tipo_tarjeta": l.tipo_tarjeta,
            "fecha": _iso(l.fecha),
            "registrado": disp is not None,
            "dispositivo_id": disp.id if disp else None,
            "equipo": disp.nombre_equipo if disp else None,
            "cliente": disp.cliente.full_name if disp and disp.cliente else None,
        })
    return salida


@router.post("/heartbeat")
def heartbeat(datos: HeartbeatIn):
    """El puente USB (cada 5 s) y el ESP32 (cada 10 s) avisan que siguen conectados."""
    _marcar_lector(datos.lector, modo=datos.modo, puerto=datos.puerto, chip_ok=datos.chip_ok)
    return {"ok": True}


@router.get("/estado")
def estado_lector(db: Session = Depends(get_db)):
    """Consulta liviana para el panel: si hay lector conectado y cuál es la última lectura."""
    ultima = db.query(func.max(models.NfcLecturaModel.id)).scalar() or 0
    ahora = datetime.now()
    with _lock:
        copia = [dict(info) for info in _lectores.values()]

    lectores = []
    for info in copia:
        segundos = (ahora - info["ultimo_contacto"]).total_seconds()
        lectores.append({
            "lector": info["lector"],
            "modo": info.get("modo"),
            "puerto": info.get("puerto"),
            "chip_ok": info.get("chip_ok"),
            "ultimo_contacto": _iso(info["ultimo_contacto"]),
            "segundos_sin_contacto": int(segundos),
            "conectado": segundos <= SEGUNDOS_CONECTADO,
        })
    lectores.sort(key=lambda l: l["segundos_sin_contacto"])

    return {
        "ultima_lectura_id": ultima,
        "lectores": lectores,
        "hay_lector_conectado": any(l["conectado"] for l in lectores),
    }


# ---------------------------------------------------------------------------
# Equipos (ficha editable)
# ---------------------------------------------------------------------------

@router.get("/buscar")
def buscar_por_uid(uid: str = Query(..., min_length=1, max_length=64), db: Session = Depends(get_db)):
    uid = _uid_valido(uid)
    tag = _tag_por_uid(db, uid)
    if not tag:
        return {"registrado": False, "uid": uid}
    return {"registrado": True, "uid": uid, **_ficha(db, tag.dispositivo)}


@router.get("/equipos")
def listar_equipos(
    cliente_id: Optional[int] = None,
    con_historial: bool = False,
    db: Session = Depends(get_db),
):
    consulta = db.query(models.DispositivoModel)
    if cliente_id is not None:
        consulta = consulta.filter(models.DispositivoModel.cliente_id == cliente_id)

    salida = []
    for d in consulta.order_by(models.DispositivoModel.id.desc()).all():
        item = _dispositivo_dict(d)
        item["cliente_nombre"] = d.cliente.full_name if d.cliente else None
        item["total_historial"] = len(d.historial)
        if con_historial:
            item["historial"] = [_historial_dict(h) for h in d.historial]
        salida.append(item)
    return salida


@router.post("/equipos", status_code=201)
def registrar_equipo_con_tarjeta(datos: EquipoNuevo, db: Session = Depends(get_db)):
    """Tarjeta nueva -> se crea el equipo con sus datos y queda vinculado a la tarjeta."""
    uid = _uid_valido(datos.uid)
    if _tag_por_uid(db, uid):
        raise HTTPException(status_code=409, detail={
            "codigo": "tarjeta_en_uso",
            "mensaje": "Esta tarjeta ya está vinculada a otro equipo.",
        })
    if not db.get(models.ClienteModel, datos.cliente_id):
        raise HTTPException(status_code=404, detail="Cliente no encontrado.")

    campos = _sin_vacios(datos.model_dump(exclude={"uid", "tecnico_id"}))
    campos["serial_modelo"] = campos.get("serial_modelo") or "N/A"

    disp = models.DispositivoModel(**campos)
    db.add(disp)
    db.flush()
    db.add(models.NfcTagModel(uid=uid, dispositivo_id=disp.id))
    _anotar(db, disp.id, "Recepción", f"Equipo registrado en el taller con la tarjeta NFC {uid}.", datos.tecnico_id)
    db.commit()
    db.refresh(disp)
    return _ficha(db, disp)


@router.get("/equipos/{dispositivo_id}")
def ver_equipo(dispositivo_id: int, db: Session = Depends(get_db)):
    return _ficha(db, _dispositivo_o_404(db, dispositivo_id))


@router.put("/equipos/{dispositivo_id}")
def editar_equipo(dispositivo_id: int, datos: EquipoEditar, db: Session = Depends(get_db)):
    disp = _dispositivo_o_404(db, dispositivo_id)
    cambios = _sin_vacios(datos.model_dump(exclude_unset=True))

    for obligatorio in ("nombre_equipo", "marca"):
        if obligatorio in cambios and not cambios[obligatorio]:
            raise HTTPException(status_code=400, detail=f"El campo {obligatorio} no puede quedar vacío.")
    if "serial_modelo" in cambios and not cambios["serial_modelo"]:
        cambios["serial_modelo"] = "N/A"

    for campo, valor in cambios.items():
        setattr(disp, campo, valor)
    db.commit()
    db.refresh(disp)
    return _ficha(db, disp)


# ---------------------------------------------------------------------------
# Vincular / desvincular tarjetas
# ---------------------------------------------------------------------------

@router.get("/tags")
def listar_tags(db: Session = Depends(get_db)):
    return [
        {
            "id": t.id,
            "uid": t.uid,
            "dispositivo_id": t.dispositivo_id,
            "equipo": t.dispositivo.nombre_equipo if t.dispositivo else None,
            "cliente": t.dispositivo.cliente.full_name if t.dispositivo and t.dispositivo.cliente else None,
            "vinculado_en": _iso(t.vinculado_en),
        }
        for t in db.query(models.NfcTagModel).order_by(models.NfcTagModel.id.desc()).all()
    ]


@router.post("/tags", status_code=201)
def vincular_tarjeta(datos: VincularIn, db: Session = Depends(get_db)):
    """Vincula una tarjeta a un equipo que ya estaba registrado."""
    uid = _uid_valido(datos.uid)
    disp = _dispositivo_o_404(db, datos.dispositivo_id)

    existente = _tag_por_uid(db, uid)
    if existente:
        if existente.dispositivo_id == disp.id:
            return _ficha(db, disp)
        raise HTTPException(status_code=409, detail={
            "codigo": "tarjeta_en_uso",
            "mensaje": f"Esta tarjeta ya está vinculada a «{existente.dispositivo.nombre_equipo}».",
        })

    if disp.tag and not datos.reemplazar:
        raise HTTPException(status_code=409, detail={
            "codigo": "equipo_con_tarjeta",
            "mensaje": f"«{disp.nombre_equipo}» ya tiene la tarjeta {disp.tag.uid}.",
        })

    if disp.tag:
        anterior = disp.tag.uid
        disp.tag.uid = uid
        disp.tag.vinculado_en = datetime.now()
        _anotar(db, disp.id, "Nota", f"Tarjeta NFC cambiada: {anterior} → {uid}.", datos.tecnico_id)
    else:
        db.add(models.NfcTagModel(uid=uid, dispositivo_id=disp.id))
        _anotar(db, disp.id, "Nota", f"Tarjeta NFC {uid} vinculada al equipo.", datos.tecnico_id)

    db.commit()
    db.refresh(disp)
    return _ficha(db, disp)


@router.delete("/equipos/{dispositivo_id}/tag")
def desvincular_tarjeta(dispositivo_id: int, tecnico_id: Optional[int] = None, db: Session = Depends(get_db)):
    disp = _dispositivo_o_404(db, dispositivo_id)
    if not disp.tag:
        raise HTTPException(status_code=404, detail="Este equipo no tiene tarjeta vinculada.")
    uid = disp.tag.uid
    db.delete(disp.tag)
    _anotar(db, disp.id, "Nota", f"Tarjeta NFC {uid} desvinculada.", tecnico_id)
    db.commit()
    db.refresh(disp)
    return _ficha(db, disp)


# ---------------------------------------------------------------------------
# Historial técnico
# ---------------------------------------------------------------------------

@router.get("/equipos/{dispositivo_id}/historial")
def ver_historial(dispositivo_id: int, db: Session = Depends(get_db)):
    disp = _dispositivo_o_404(db, dispositivo_id)
    return [_historial_dict(h) for h in disp.historial]


@router.post("/equipos/{dispositivo_id}/historial", status_code=201)
def agregar_historial(dispositivo_id: int, datos: HistorialIn, db: Session = Depends(get_db)):
    disp = _dispositivo_o_404(db, dispositivo_id)

    orden = None
    if datos.orden_id is not None:
        orden = db.get(models.OrdenModel, datos.orden_id)
        if not orden:
            raise HTTPException(status_code=404, detail="Orden no encontrada.")

    entrada = models.HistorialEquipoModel(
        dispositivo_id=disp.id,
        tecnico_id=_tecnico_valido(db, datos.tecnico_id),
        orden_id=orden.id if orden else None,
        tipo=datos.tipo,
        descripcion=datos.descripcion,
        repuestos=datos.repuestos or None,
        costo=datos.costo,
    )
    db.add(entrada)

    # Lo que escribe el técnico también puede verse en el portal del cliente.
    if orden and datos.publicar_en_orden:
        orden.avance_realtime = f"{datos.tipo}: {datos.descripcion}"

    db.commit()
    db.refresh(disp)
    return {"historial_id": entrada.id, **_ficha(db, disp)}


@router.put("/historial/{historial_id}")
def editar_historial(historial_id: int, datos: HistorialEditar, db: Session = Depends(get_db)):
    entrada = db.get(models.HistorialEquipoModel, historial_id)
    if not entrada:
        raise HTTPException(status_code=404, detail="Registro de historial no encontrado.")

    cambios = _sin_vacios(datos.model_dump(exclude_unset=True))
    for obligatorio in ("tipo", "descripcion"):
        if obligatorio in cambios and not cambios[obligatorio]:
            raise HTTPException(status_code=400, detail=f"El campo {obligatorio} no puede quedar vacío.")
    if cambios.get("orden_id") is not None and not db.get(models.OrdenModel, cambios["orden_id"]):
        raise HTTPException(status_code=404, detail="Orden no encontrada.")

    for campo, valor in cambios.items():
        setattr(entrada, campo, valor)
    entrada.editado_en = datetime.now()
    db.commit()

    disp = _dispositivo_o_404(db, entrada.dispositivo_id)
    db.refresh(disp)
    return _ficha(db, disp)


@router.delete("/historial/{historial_id}")
def borrar_historial(historial_id: int, db: Session = Depends(get_db)):
    entrada = db.get(models.HistorialEquipoModel, historial_id)
    if not entrada:
        raise HTTPException(status_code=404, detail="Registro de historial no encontrado.")
    dispositivo_id = entrada.dispositivo_id
    db.delete(entrada)
    db.commit()

    disp = _dispositivo_o_404(db, dispositivo_id)
    db.refresh(disp)
    return _ficha(db, disp)


# Alias para el sketch WiFi anterior (POST /rfid/lecturas).
router_rfid.add_api_route("/lecturas", registrar_lectura, methods=["POST"], status_code=201)
router_rfid.add_api_route("/lecturas", listar_lecturas, methods=["GET"])
