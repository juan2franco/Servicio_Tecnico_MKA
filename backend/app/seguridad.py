"""Contraseñas cifradas con PBKDF2 (librería estándar de Python, sin dependencias).

Las contraseñas viejas guardadas en texto plano siguen funcionando: al iniciar
sesión con una de ellas se valida y se vuelve a guardar ya cifrada.
"""

import base64
import hashlib
import hmac
import os

PREFIJO = "pbkdf2_sha256"
ITERACIONES = 200_000


def cifrar(password: str) -> str:
    sal = os.urandom(16)
    huella = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), sal, ITERACIONES)
    return f"{PREFIJO}${ITERACIONES}${base64.b64encode(sal).decode()}${base64.b64encode(huella).decode()}"


def verificar(password: str, guardada: str) -> tuple[bool, bool]:
    """Devuelve (es_correcta, hay_que_volver_a_cifrar)."""
    if not guardada:
        return False, False
    if guardada.startswith(PREFIJO + "$"):
        try:
            _, iteraciones, sal, huella = guardada.split("$")
            calculada = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"),
                                            base64.b64decode(sal), int(iteraciones))
            return hmac.compare_digest(calculada, base64.b64decode(huella)), False
        except (ValueError, TypeError):
            return False, False
    # Contraseña antigua en texto plano.
    correcta = hmac.compare_digest(password.encode("utf-8"), guardada.encode("utf-8"))
    return correcta, correcta
