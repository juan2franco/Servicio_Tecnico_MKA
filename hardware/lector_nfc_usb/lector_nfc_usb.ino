/*
  Lector NFC MKA por cable USB
  ----------------------------
  Lee tarjetas y stickers NFC de 13.56 MHz (NTAG213/215/216, MIFARE) con el
  modulo RC522 y manda cada lectura por el puerto serie como una linea JSON.
  En el PC, hardware/puente_usb/puente_nfc.py lee esas lineas y las envia a la
  API (http://localhost:8000/nfc/lecturas), y el panel tecnico las muestra.

  Funciona en Arduino UNO / Nano / Mega y en ESP32 / ESP32-S3.
  Librerias: MFRC522 (GithubCommunity).

  Mensajes que envia (115200 baudios):
    {"evento":"listo","lector":"ARDUINO-MKA-01","chip_ok":true,"version":"0x92"}
    {"evento":"tarjeta","uid":"04 A3 1F 9C","tipo":"MIFARE Ultralight or Ultralight C","lector":"ARDUINO-MKA-01"}
    {"evento":"estado","chip_ok":true}            (cada 5 s)
  Respuesta del puente:  R:1 (equipo registrado)  /  R:0 (tarjeta nueva)
*/

#include <SPI.h>
#include <MFRC522.h>

// ---------------- Pines ----------------
#if defined(ESP32)
// ESP32-S3 (mismo cableado que el sketch WiFi)
constexpr uint8_t SS_PIN   = 10;
constexpr uint8_t RST_PIN  = 14;
constexpr uint8_t SCK_PIN  = 12;
constexpr uint8_t MISO_PIN = 13;
constexpr uint8_t MOSI_PIN = 11;
#else
// UNO / Nano: SCK=13, MISO=12, MOSI=11 (fijos).  Mega: SCK=52, MISO=50, MOSI=51.
constexpr uint8_t SS_PIN  = 10;
constexpr uint8_t RST_PIN = 9;
#endif

// Pon aqui el pin de un buzzer activo si tienes uno (por ejemplo 7). -1 = sin buzzer.
#define PIN_BUZZER -1

const char LECTOR_ID[] = "ARDUINO-MKA-01";
constexpr unsigned long TIEMPO_RETIRO_MS = 3000;   // misma tarjeta encima: se manda una sola vez
constexpr unsigned long INTERVALO_ESTADO_MS = 5000;

MFRC522 lector(SS_PIN, RST_PIN);
String ultimoUid;
unsigned long ultimaDeteccion = 0;
unsigned long ultimoEstado = 0;
String respuesta;

byte versionChip() {
  return lector.PCD_ReadRegister(MFRC522::VersionReg);
}

bool versionValida(byte version) {
  return version != 0x00 && version != 0xFF;   // 0x00 / 0xFF = el RC522 no contesta
}

void pitar(uint8_t veces) {
#if PIN_BUZZER >= 0
  for (uint8_t i = 0; i < veces; ++i) {
    tone(PIN_BUZZER, 2200, 90);
    delay(150);
  }
#else
  (void)veces;
#endif
}

String leerUid() {
  String uid;
  for (byte i = 0; i < lector.uid.size; ++i) {
    if (i) uid += ' ';
    if (lector.uid.uidByte[i] < 0x10) uid += '0';
    uid += String(lector.uid.uidByte[i], HEX);
  }
  uid.toUpperCase();
  return uid;
}

void enviarListo() {
  byte version = versionChip();
  bool ok = versionValida(version);
  Serial.print(F("{\"evento\":\"listo\",\"lector\":\""));
  Serial.print(LECTOR_ID);
  Serial.print(F("\",\"chip_ok\":"));
  Serial.print(ok ? F("true") : F("false"));
  Serial.print(F(",\"version\":\"0x"));
  Serial.print(version, HEX);
  Serial.println(F("\"}"));
}

void enviarTarjeta(const String& uid, MFRC522::PICC_Type tipo) {
  Serial.print(F("{\"evento\":\"tarjeta\",\"uid\":\""));
  Serial.print(uid);
  Serial.print(F("\",\"tipo\":\""));
  Serial.print(MFRC522::PICC_GetTypeName(tipo));
  Serial.print(F("\",\"lector\":\""));
  Serial.print(LECTOR_ID);
  Serial.println(F("\"}"));
}

void revisarEstado() {
  if (millis() - ultimoEstado < INTERVALO_ESTADO_MS) return;
  ultimoEstado = millis();

  bool ok = versionValida(versionChip());
  if (!ok) {
    // El RC522 a veces se cuelga con cables flojos: se reinicia solo.
    lector.PCD_Init();
    delay(4);
    ok = versionValida(versionChip());
  }
  Serial.print(F("{\"evento\":\"estado\",\"chip_ok\":"));
  Serial.print(ok ? F("true") : F("false"));
  Serial.println(F("}"));
}

void revisarRespuesta() {
  while (Serial.available()) {
    char c = (char)Serial.read();
    if (c == '\n') {
      if (respuesta == "R:1") pitar(1);
      else if (respuesta == "R:0") pitar(2);
      respuesta = "";
    } else if (c != '\r' && respuesta.length() < 16) {
      respuesta += c;
    }
  }
}

void setup() {
  Serial.begin(115200);
#if defined(ESP32)
  SPI.begin(SCK_PIN, MISO_PIN, MOSI_PIN, SS_PIN);
#else
  SPI.begin();
#endif
#if PIN_BUZZER >= 0
  pinMode(PIN_BUZZER, OUTPUT);
#endif
  lector.PCD_Init();
  delay(50);
  enviarListo();
}

void loop() {
  revisarRespuesta();
  revisarEstado();

  byte atqa[2];
  byte longitud = sizeof(atqa);
  MFRC522::StatusCode estado = lector.PICC_WakeupA(atqa, &longitud);

  if ((estado == MFRC522::STATUS_OK || estado == MFRC522::STATUS_COLLISION)
      && lector.PICC_ReadCardSerial()) {
    String uid = leerUid();
    MFRC522::PICC_Type tipo = MFRC522::PICC_GetType(lector.uid.sak);
    lector.PICC_HaltA();
    lector.PCD_StopCrypto1();

    bool mismaTarjeta = uid == ultimoUid && millis() - ultimaDeteccion < TIEMPO_RETIRO_MS;
    ultimoUid = uid;
    ultimaDeteccion = millis();

    if (!mismaTarjeta) enviarTarjeta(uid, tipo);
    delay(300);
  } else {
    delay(120);
  }
}
