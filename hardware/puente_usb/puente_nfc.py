#!/usr/bin/env python3
"""Puente USB -> API del lector NFC de MKA.

Lee lo que el Arduino manda por el cable USB y lo envía a la API, para que el
panel técnico (http://localhost:8000/app/) muestre cada tarjeta al instante.

Uso (con la API ya corriendo):
    python puente_nfc.py                    # busca el Arduino solo
    python puente_nfc.py --puerto COM4      # puerto fijo
    python puente_nfc.py --simular          # sin Arduino: escribes el UID y Enter

Importante: cierra el Monitor Serie del Arduino IDE. Si está abierto, el puerto
queda ocupado y el puente no puede leerlo.
"""

import argparse
import json
import re
import sys
import time
import urllib.error
import urllib.request

PALABRAS_ARDUINO = ("arduino", "ch340", "ch910", "cp210", "ftdi", "usb serial", "usb-serial",
                    "usb-enhanced-serial", "esp32", "jtag", "silicon labs", "wch", "dispositivo serie usb")
# Fabricantes USB: Espressif (ESP32-S3/C3 USB nativo), Arduino, CH340, CP210x, FTDI.
VIDS_ARDUINO = ("303a", "2341", "2a03", "1a86", "10c4", "0403")
INTERVALO_HEARTBEAT = 5


# ---------------------------------------------------------------------------
# API
# ---------------------------------------------------------------------------

def post_json(api, ruta, datos, timeout=5):
    """POST con la librería estándar. Devuelve (código, cuerpo) o (None, texto_error)."""
    cuerpo = json.dumps(datos).encode("utf-8")
    peticion = urllib.request.Request(
        api.rstrip("/") + ruta,
        data=cuerpo,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(peticion, timeout=timeout) as respuesta:
            return respuesta.status, json.loads(respuesta.read().decode("utf-8") or "{}")
    except urllib.error.HTTPError as error:
        try:
            detalle = json.loads(error.read().decode("utf-8"))
        except Exception:
            detalle = {"detail": str(error)}
        return error.code, detalle
    except (urllib.error.URLError, OSError) as error:
        return None, str(getattr(error, "reason", error))


# ---------------------------------------------------------------------------
# Protocolo con el Arduino
# ---------------------------------------------------------------------------

def parsear_linea(linea):
    """Convierte una línea del Arduino en un evento (dict) o None si está vacía.

    Entiende el JSON del sketch lector_nfc_usb y también el formato del sketch
    WiFi anterior ("UID: A3 1F 9C 04"), por si lo conectas por cable.
    """
    linea = linea.strip()
    if not linea:
        return None
    if linea.startswith("{"):
        try:
            evento = json.loads(linea)
        except json.JSONDecodeError:
            return {"evento": "log", "texto": linea}
        if not isinstance(evento, dict):
            return {"evento": "log", "texto": linea}
        evento.setdefault("evento", "tarjeta" if "uid" in evento else "log")
        return evento
    coincide = re.match(r"^UID\s*[:=]\s*([0-9A-Fa-f:\s\-]+)$", linea)
    if coincide:
        return {"evento": "tarjeta", "uid": coincide.group(1).strip()}
    return {"evento": "log", "texto": linea}


def resumen_respuesta(respuesta):
    if respuesta.get("registrado"):
        disp = respuesta.get("dispositivo") or {}
        cli = respuesta.get("cliente") or {}
        orden = respuesta.get("orden")
        texto = f"  Equipo:  {disp.get('nombre_equipo', '-')} ({disp.get('marca', '-')})\n"
        texto += f"  Cliente: {cli.get('full_name', '-')} - Tel: {cli.get('phone', '-')}"
        if orden:
            texto += f"\n  Orden:   #{orden.get('id')} - {orden.get('estado')}"
        return texto
    return "  Tarjeta nueva: regístrala en el panel técnico (pestaña Lector NFC)."


def enviar_lectura(api, evento, lector):
    datos = {"uid": evento["uid"], "lector": lector}
    if evento.get("tipo"):
        datos["tipo_tarjeta"] = str(evento["tipo"])[:50]
    codigo, respuesta = post_json(api, "/nfc/lecturas", datos)
    if codigo is None:
        print(f"  ! No hay conexión con la API ({respuesta}). ¿Está corriendo el backend?")
        return None
    if codigo not in (200, 201):
        print(f"  ! La API respondió {codigo}: {respuesta}")
        return None
    print(f"  Lectura #{respuesta.get('lectura_id')} guardada")
    print(resumen_respuesta(respuesta))
    return respuesta


# ---------------------------------------------------------------------------
# Puerto serie
# ---------------------------------------------------------------------------

def buscar_puerto():
    from serial.tools import list_ports

    puertos = list(list_ports.comports())
    if not puertos:
        return None
    for puerto in puertos:
        if getattr(puerto, "vid", None) is not None and f"{puerto.vid:04x}" in VIDS_ARDUINO:
            return puerto.device
    for puerto in puertos:
        texto = f"{puerto.description} {puerto.manufacturer or ''} {puerto.hwid}".lower()
        if "bluetooth" in texto:
            continue
        if any(palabra in texto for palabra in PALABRAS_ARDUINO):
            return puerto.device
    # Si solo hay uno, seguramente es el Arduino.
    return puertos[0].device if len(puertos) == 1 else None


def listar_puertos():
    from serial.tools import list_ports
    return [f"{p.device} ({p.description})" for p in list_ports.comports()]


def atender_puerto(args, puerto):
    import serial

    try:
        conexion = serial.Serial(puerto, args.baudios, timeout=1)
    except serial.SerialException as error:
        print(f"No pude abrir {puerto}: {error}")
        print("  -> Cierra el Monitor Serie del Arduino IDE (o cualquier programa que use el puerto).")
        return

    print(f"Conectado al lector en {puerto}. Acerca una tarjeta... (Ctrl+C para salir)")
    time.sleep(2)  # el Arduino se reinicia al abrir el puerto
    lector = args.lector or f"USB-{puerto}"
    chip_ok = None
    ultimo_heartbeat = 0.0
    api_caida = False

    try:
        while True:
            if time.time() - ultimo_heartbeat >= INTERVALO_HEARTBEAT:
                ultimo_heartbeat = time.time()
                codigo, _ = post_json(args.api, "/nfc/heartbeat",
                                      {"lector": lector, "modo": "usb", "puerto": puerto, "chip_ok": chip_ok},
                                      timeout=2)
                if codigo is None and not api_caida:
                    print(f"  ! La API no responde en {args.api}. Sigo intentando...")
                api_caida = codigo is None

            crudo = conexion.readline()
            if not crudo:
                continue
            evento = parsear_linea(crudo.decode("utf-8", errors="replace"))
            if not evento:
                continue

            tipo = evento.get("evento")
            if tipo == "listo":
                if not args.lector and evento.get("lector"):
                    lector = str(evento["lector"])[:50]
                chip_ok = evento.get("chip_ok")
                print(f"Arduino listo: {lector} (módulo NFC {'OK' if chip_ok else 'SIN RESPUESTA - revisa los cables'})")
                ultimo_heartbeat = 0  # avisar ya mismo
            elif tipo == "estado":
                if evento.get("chip_ok") != chip_ok:
                    chip_ok = evento.get("chip_ok")
                    print("Módulo NFC OK" if chip_ok else "! El módulo NFC no responde - revisa los cables")
                    ultimo_heartbeat = 0
            elif tipo == "tarjeta" and evento.get("uid"):
                if not args.lector and evento.get("lector"):
                    lector = str(evento["lector"])[:50]
                print(f"\nTarjeta {evento['uid']}")
                respuesta = enviar_lectura(args.api, evento, lector)
                if respuesta is not None:
                    conexion.write(b"R:1\n" if respuesta.get("registrado") else b"R:0\n")
            elif tipo == "log":
                print(f"[arduino] {evento.get('texto', '')}")
    except serial.SerialException:
        print(f"\nSe desconectó el lector de {puerto}.")
    finally:
        try:
            conexion.close()
        except Exception:
            pass


def modo_simulado(args):
    lector = args.lector or "SIMULADO"
    print("Modo simulado: escribe un UID (ej. 04 A3 1F 9C) y Enter. Ctrl+C para salir.")
    post_json(args.api, "/nfc/heartbeat", {"lector": lector, "modo": "simulado", "chip_ok": True}, timeout=2)
    for linea in sys.stdin:
        uid = linea.strip()
        if uid:
            post_json(args.api, "/nfc/heartbeat", {"lector": lector, "modo": "simulado", "chip_ok": True}, timeout=2)
            enviar_lectura(args.api, {"uid": uid}, lector)


def main():
    parser = argparse.ArgumentParser(description="Puente USB entre el lector NFC (Arduino) y la API de MKA")
    parser.add_argument("--puerto", help="Puerto del Arduino, ej. COM3 o /dev/ttyUSB0 (por defecto lo busca solo)")
    parser.add_argument("--api", default="http://localhost:8000", help="URL de la API (por defecto http://localhost:8000)")
    parser.add_argument("--baudios", type=int, default=115200)
    parser.add_argument("--lector", help="Nombre del lector que se verá en el panel")
    parser.add_argument("--simular", action="store_true", help="Sin Arduino: escribir los UID a mano")
    args = parser.parse_args()

    if args.simular:
        modo_simulado(args)
        return

    try:
        import serial  # noqa: F401
    except ImportError:
        print("Falta pyserial. Instálalo con:  python -m pip install pyserial")
        sys.exit(1)

    avisado = False
    while True:
        puerto = args.puerto or buscar_puerto()
        if not puerto:
            if not avisado:
                disponibles = listar_puertos()
                print("No encuentro el Arduino. Conéctalo por USB.")
                if disponibles:
                    print("  Puertos disponibles: " + ", ".join(disponibles))
                    print("  Si es uno de esos, usa:  python puente_nfc.py --puerto COMx")
                avisado = True
            time.sleep(3)
            continue
        avisado = False
        atender_puerto(args, puerto)
        time.sleep(2)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nPuente detenido.")
