#!/usr/bin/env python3
"""Enlace público para compartir MKA por internet (Cloudflare Quick Tunnel).

- La primera vez descarga cloudflared.exe desde el GitHub oficial de Cloudflare.
- Abre un túnel hacia http://localhost:8000 y muestra el enlace https://....trycloudflare.com
- Guarda el enlace en enlace_publico.txt (la API lo muestra en el botón "Compartir")
  y lo copia al portapapeles.

El enlace funciona mientras esta ventana y la API estén abiertas, y cambia cada vez
que se vuelve a abrir. No necesita cuenta de Cloudflare.
"""

import os
import re
import subprocess
import sys
import threading
import time
import urllib.request
from pathlib import Path

CARPETA = Path(__file__).resolve().parent
EXE = CARPETA / ("cloudflared.exe" if os.name == "nt" else "cloudflared")
URL_DESCARGA = "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"
ARCHIVO_ENLACE = CARPETA / "enlace_publico.txt"
PATRON = re.compile(r"https://[a-z0-9-]+\.trycloudflare\.com")
PUERTO_LOCAL = os.getenv("MKA_PUERTO", "8000")


def guardar_enlace(enlace: str) -> None:
    ARCHIVO_ENLACE.write_text(enlace, encoding="utf-8")


def descargar_cloudflared() -> None:
    if os.name != "nt":
        print("En Linux/Mac instala cloudflared con tu gestor de paquetes y ponlo en esta carpeta.")
        sys.exit(1)
    print("Descargando Cloudflare Tunnel (cloudflared.exe) desde github.com/cloudflare/cloudflared")
    print("Solo pasa la primera vez...")
    temporal = EXE.with_suffix(".descargando")
    with urllib.request.urlopen(URL_DESCARGA, timeout=60) as respuesta, open(temporal, "wb") as destino:
        total = int(respuesta.headers.get("Content-Length") or 0)
        bajado = 0
        while True:
            bloque = respuesta.read(1024 * 256)
            if not bloque:
                break
            destino.write(bloque)
            bajado += len(bloque)
            if total:
                print(f"\r  {bajado * 100 // total:3d}%  ({bajado // 1_048_576} de {total // 1_048_576} MB)", end="", flush=True)
    print()
    temporal.replace(EXE)


def mantener_vivo(proceso: subprocess.Popen, enlace_ref: dict) -> None:
    # Toca el archivo cada 20 s: la API sabe así que el enlace sigue activo.
    while proceso.poll() is None:
        if enlace_ref.get("enlace"):
            os.utime(ARCHIVO_ENLACE, None)
        time.sleep(20)


def copiar_al_portapapeles(texto: str) -> None:
    if os.name == "nt":
        try:
            subprocess.run("clip", input=texto, text=True, check=False, shell=True)
        except OSError:
            pass


def main() -> None:
    guardar_enlace("")
    if not EXE.exists():
        try:
            descargar_cloudflared()
        except Exception as error:  # noqa: BLE001
            print(f"\nNo se pudo descargar cloudflared: {error}")
            print("Revisa tu conexión a internet y vuelve a abrir MKA.")
            return

    print("Abriendo el enlace público...")
    proceso = subprocess.Popen(
        [str(EXE), "tunnel", "--no-autoupdate", "--url", f"http://localhost:{PUERTO_LOCAL}"],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
        errors="replace",
        bufsize=1,
    )
    enlace_ref: dict = {}
    threading.Thread(target=mantener_vivo, args=(proceso, enlace_ref), daemon=True).start()

    try:
        for linea in proceso.stdout:  # type: ignore[union-attr]
            if not enlace_ref.get("enlace"):
                encontrado = PATRON.search(linea)
                if encontrado:
                    enlace = encontrado.group(0)
                    enlace_ref["enlace"] = enlace
                    guardar_enlace(enlace)
                    copiar_al_portapapeles(enlace + "/app/")
                    print("\n" + "=" * 64)
                    print("  ENLACE PARA COMPARTIR (ya está copiado):")
                    print(f"  {enlace}/app/")
                    print("  Funciona mientras esta ventana siga abierta.")
                    print("=" * 64 + "\n")
                    continue
            if " ERR " in linea or "error" in linea.lower():
                print(linea.rstrip())
    except KeyboardInterrupt:
        pass
    finally:
        guardar_enlace("")
        if proceso.poll() is None:
            proceso.terminate()
        print("Enlace público cerrado.")


if __name__ == "__main__":
    main()
