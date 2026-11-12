"""Enlaces para compartir el panel: público (Cloudflare) y de la red local."""

import os
import socket
import time
from pathlib import Path

from fastapi import APIRouter

router = APIRouter(prefix="/compartir", tags=["Compartir"])

# herramientas/enlace_publico.txt lo escribe herramientas/compartir_internet.py
ARCHIVO_ENLACE = Path(__file__).resolve().parents[3] / "herramientas" / "enlace_publico.txt"
SEGUNDOS_VIGENCIA = 90  # el script lo actualiza cada 20 s mientras el túnel está abierto


def _enlace_publico():
    try:
        if time.time() - ARCHIVO_ENLACE.stat().st_mtime > SEGUNDOS_VIGENCIA:
            return None
        enlace = ARCHIVO_ENLACE.read_text(encoding="utf-8").strip()
        return enlace or None
    except OSError:
        return None


def _ips_locales():
    ips = []
    try:
        # No envía nada: solo pregunta qué interfaz usaría para salir a internet.
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("1.1.1.1", 80))
            ips.append(s.getsockname()[0])
    except OSError:
        pass
    try:
        for ip in socket.gethostbyname_ex(socket.gethostname())[2]:
            if not ip.startswith("127.") and ip not in ips:
                ips.append(ip)
    except OSError:
        pass
    return ips[:3]


@router.get("")
def enlaces():
    publico = _enlace_publico()
    # Dentro de Docker las IP que se ven son las del contenedor, no las del PC.
    ips = [] if os.getenv("MKA_EN_DOCKER") == "1" else _ips_locales()
    return {
        "publico": f"{publico}/app/" if publico else None,
        "red_local": [f"http://{ip}:8000/app/" for ip in ips],
    }
