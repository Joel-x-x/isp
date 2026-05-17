# MVP Plan — Sistema Automatizado de Notificación de Facturas Vencidas vía WhatsApp

## 1. Objetivo General

Automatizar el envío de recordatorios de pago vía WhatsApp a clientes con facturas vencidas,
consultando datos desde WispHub y enviando mensajes a través de Evolution API self-hosted.
Sin frontend. Sin intervención manual en operación normal.

---

## 2. Decisiones de Diseño (acordadas)

| Decisión | Valor |
|----------|-------|
| WhatsApp API | Evolution API (self-hosted, Docker) |
| Mensajes | 1 por cliente, facturas agrupadas |
| Horario cron | 9:00 AM y 3:00 PM, lunes–sábado |
| Delay entre mensajes | 15–45s aleatorio |
| Pausa entre lotes (20 msgs) | 3–5 min aleatorio |
| Tamaño de lote | 20 mensajes |
| Reintentos por fallo | 3 intentos con backoff (5min → 15min → 30min) |
| Base de datos | PostgreSQL vía Docker Compose |
| Alertas de desconexión | Telegram bot |
| Trigger manual HTTP | No en MVP |
| Clientes objetivo estimados | ~200 con facturas vencidas |
| Tiempo total de envío estimado | ~90–120 min por ciclo |

---

## 3. Arquitectura

```
VPS (Ubuntu)
├── Docker Compose
│   ├── nestjs-app          → lógica principal
│   ├── postgres            → persistencia
│   └── evolution-api       → gateway WhatsApp
│
└── Flujo
    WispHub API → NestJS → Evolution API → WhatsApp
                        ↕
                   PostgreSQL (logs)
                        ↓
                   Telegram (alertas)
```

---

## 4. Módulos NestJS

```
src/
├── app.module.ts
├── config/
│   └── configuration.ts              # env vars centralizadas
├── wisphub/
│   ├── wisphub.module.ts
│   ├── wisphub.service.ts            # consulta facturas vencidas
│   └── dto/
│       ├── factura.dto.ts
│       └── cliente.dto.ts
├── whatsapp/
│   ├── whatsapp.module.ts
│   ├── whatsapp.service.ts           # envío de mensajes
│   └── whatsapp-connection.service.ts # monitoreo de estado
├── notifications/
│   ├── notifications.module.ts
│   ├── notifications.service.ts      # orquesta el flujo completo
│   └── batch.service.ts              # lógica de lotes y delays
├── scheduler/
│   ├── scheduler.module.ts
│   └── notification.cron.ts          # cron jobs 9AM / 3PM
├── telegram/
│   ├── telegram.module.ts
│   └── telegram.service.ts           # alertas de desconexión
├── webhook/
│   ├── webhook.module.ts
│   └── webhook.controller.ts         # recibe eventos Evolution API
└── database/
    ├── database.module.ts
    └── entities/
        └── notification-log.entity.ts
```

---

## 5. Endpoints WispHub Utilizados

### 5.1 Facturas vencidas pendientes
```
GET /api/facturas/
Headers: Api-Key: {WISPHUB_API_KEY}
Query params:
  estado=1                              # 1 = Pendiente de pago
  fecha_vencimiento__range_1={HOY}      # vencimiento <= hoy
  limit=100
  offset=0                              # paginar hasta agotar resultados
```

**Respuesta relevante:**
```json
{
  "count": 215,
  "next": "...",
  "results": [
    {
      "id_factura": 101,
      "fecha_vencimiento": "2026-05-01",
      "total": 50.00,
      "saldo": 50.00,
      "cliente": { "usuario": "juan@empresa", "nombre": "Juan Pérez" }
    }
  ]
}
```

> ⚠️ `SimpleCliente` embebido en factura puede no incluir `telefono`.
> Si no lo incluye, hacer segundo request:

### 5.2 Detalle de cliente (si telefono no viene en factura)
```
GET /api/clientes/{id_servicio}/
Headers: Api-Key: {WISPHUB_API_KEY}
```

**Campo clave en respuesta:** `telefono`

### 5.3 Estrategia de paginación
```typescript
// Iterar páginas hasta next === null
let offset = 0;
const limit = 100;
do {
  const page = await fetchFacturas(offset, limit);
  process(page.results);
  offset += limit;
} while (page.next !== null);
```

---

## 6. Integración Evolution API

### 6.1 Enviar mensaje
```
POST {EVOLUTION_API_URL}/message/sendText/{INSTANCE_NAME}
Headers:
  apikey: {EVOLUTION_API_KEY}
  Content-Type: application/json

Body:
{
  "number": "5219991234567",   // formato internacional sin +
  "text": "Hola Juan..."
}
```

### 6.2 Verificar estado de conexión
```
GET {EVOLUTION_API_URL}/instance/connectionState/{INSTANCE_NAME}
Headers: apikey: {EVOLUTION_API_KEY}
```

### 6.3 Webhook de eventos (recibido por NestJS)
```
POST /webhook/evolution
Body ejemplo:
{
  "event": "CONNECTION_UPDATE",
  "data": { "state": "close" }   // o "open"
}
```

---

## 7. Template de Mensaje

```
Hola {nombre} 👋

Te recordamos que tienes {n} factura(s) vencida(s):

{lista_facturas}

Total adeudado: *${total}*

Para realizar tu pago o consultar opciones, contáctanos.
```

Donde `{lista_facturas}`:
```
• Factura #101 — $50.00 (venció 01/05/2026)
• Factura #102 — $50.00 (venció 10/05/2026)
```

---

## 8. Flujo Técnico Completo

```
[CRON 9:00 AM / 3:00 PM]
        │
        ▼
[1] Verificar estado WhatsApp (Evolution API)
        │
    ┌───┴───────────────────────────────────┐
  OPEN                                   CLOSE
    │                                       │
    ▼                                       ▼
[2] Consultar facturas            [Alerta Telegram]
    vencidas en WispHub            [Abortar ciclo]
    (paginando hasta agotar)
        │
        ▼
[3] Agrupar facturas por cliente
    (1 mensaje por cliente)
        │
        ▼
[4] Filtrar clientes ya notificados hoy
    (consultar notification_log en PostgreSQL)
        │
        ▼
[5] Dividir en lotes de 20 clientes
        │
        ▼
[6] Por cada lote:
    ├── Por cada cliente en lote:
    │       ├── Formatear mensaje
    │       ├── Enviar via Evolution API
    │       ├── Esperar delay aleatorio 15–45s
    │       └── Registrar resultado en notification_log
    │
    └── Esperar pausa aleatoria 3–5 min entre lotes
        │
        ▼
[7] Log resumen del ciclo completado
```

---

## 9. Estrategia Anti-Ban WhatsApp

| Técnica | Valor configurado |
|---------|-------------------|
| Delay entre mensajes | 15–45 segundos aleatorio |
| Pausa entre lotes | 3–5 minutos aleatorio |
| Tamaño de lote | 20 mensajes |
| Ventanas de envío | 9:00 AM – 11:30 AM / 3:00 PM – 5:30 PM |
| Días de envío | Lunes a sábado |
| Mensajes por día por número | Máximo 400 (2 ciclos × 200) |

---

## 10. Manejo de Errores y Reintentos

```typescript
// Backoff para reintentos
const RETRY_DELAYS = [5 * 60 * 1000, 15 * 60 * 1000, 30 * 60 * 1000]; // 5, 15, 30 min

async function sendWithRetry(cliente, mensaje) {
  for (let attempt = 0; attempt <= 3; attempt++) {
    try {
      await evolutionApi.send(cliente.telefono, mensaje);
      await logResult(cliente, 'SENT', attempt);
      return;
    } catch (err) {
      if (attempt < 3) {
        await sleep(RETRY_DELAYS[attempt]);
      } else {
        await logResult(cliente, 'FAILED', attempt, err.message);
      }
    }
  }
}
```

---

## 11. Base de Datos — Tabla `notification_log`

```sql
CREATE TABLE notification_log (
  id              SERIAL PRIMARY KEY,
  cliente_id      VARCHAR(100) NOT NULL,     -- usuario@empresa de WispHub
  nombre          VARCHAR(200),
  telefono        VARCHAR(20) NOT NULL,
  facturas_ids    INTEGER[] NOT NULL,         -- IDs de facturas incluidas
  total_deuda     DECIMAL(10,2),
  estado          VARCHAR(10) NOT NULL,       -- SENT | FAILED | PENDING
  intentos        INTEGER DEFAULT 1,
  error_msg       TEXT,
  ciclo           VARCHAR(10),               -- MORNING | AFTERNOON
  fecha_envio     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  fecha_creacion  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_notification_log_cliente_fecha
  ON notification_log (cliente_id, fecha_envio);
```

---

## 12. Monitoreo de Conexión WhatsApp

```
Evolution API webhook → POST /webhook/evolution
        │
        ▼
WhatsAppConnectionService
        │
   estado = 'close'         estado = 'open'
        │                         │
        ▼                         ▼
[Marcar WA offline]      [Marcar WA online]
[Enviar alerta Telegram] [Enviar confirmación Telegram]
[Bloquear cron jobs]     [Habilitar cron jobs]
```

**Mensaje Telegram desconexión:**
```
⚠️ WhatsApp Desconectado

El número de WhatsApp se ha desvinculado.
Los envíos automáticos están PAUSADOS.

Acción requerida: Re-escanea el QR en:
{EVOLUTION_API_URL}/manager

Hora: {timestamp}
```

**Mensaje Telegram reconexión:**
```
✅ WhatsApp Reconectado

El número volvió a conectarse.
Los envíos automáticos se reanudan en el próximo ciclo.

Hora: {timestamp}
```

---

## 13. Variables de Entorno

```env
# App
NODE_ENV=production
PORT=3000

# PostgreSQL
DATABASE_URL=postgresql://user:password@postgres:5432/isp
DB_USER=isp_user
DB_PASSWORD=strong_password_here
DB_NAME=isp

# WispHub
WISPHUB_API_URL=https://wisphub.net/api
WISPHUB_API_KEY=your_api_key_here

# Evolution API
EVOLUTION_API_URL=http://evolution-api:8080
EVOLUTION_API_KEY=your_evolution_key
EVOLUTION_INSTANCE_NAME=isp

# Telegram
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id

# Notificaciones
BATCH_SIZE=20
DELAY_MIN_MS=15000
DELAY_MAX_MS=45000
BATCH_PAUSE_MIN_MS=180000
BATCH_PAUSE_MAX_MS=300000
CRON_MORNING=0 9 * * 1-6
CRON_AFTERNOON=0 15 * * 1-6
```

---

## 14. Docker Compose

```yaml
version: '3.9'

services:
  postgres:
    image: postgres:16-alpine
    container_name: isp-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ${DB_NAME}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  evolution-api:
    image: atendai/evolution-api:latest
    container_name: isp-evolution
    restart: unless-stopped
    ports:
      - "8080:8080"
    environment:
      AUTHENTICATION_API_KEY: ${EVOLUTION_API_KEY}
      WEBHOOK_GLOBAL_URL: http://nestjs-app:3000/webhook/evolution
      WEBHOOK_GLOBAL_ENABLED: "true"
    volumes:
      - evolution_data:/evolution/instances

  nestjs-app:
    build: .
    container_name: isp-app
    restart: unless-stopped
    depends_on:
      - postgres
      - evolution-api
    ports:
      - "3000:3000"
    env_file:
      - .env

volumes:
  postgres_data:
  evolution_data:
```

---

## 15. Dependencias NestJS

```json
{
  "dependencies": {
    "@nestjs/common": "^10",
    "@nestjs/core": "^10",
    "@nestjs/schedule": "^4",          // cron jobs
    "@nestjs/typeorm": "^10",          // ORM
    "@nestjs/config": "^3",            // env vars
    "typeorm": "^0.3",
    "pg": "^8",                        // PostgreSQL driver
    "axios": "^1",                     // HTTP client para APIs
    "nestjs-telegraf": "^2",           // Telegram bot
    "telegraf": "^4"
  },
  "devDependencies": {
    "@nestjs/cli": "^10",
    "@types/node": "^20",
    "typescript": "^5"
  }
}
```

---

## 16. Logs Recomendados

```
[CRON] Ciclo MORNING iniciado — 2026-05-13T09:00:00Z
[WISPHUB] 47 clientes con facturas vencidas encontrados
[WISPHUB] 12 clientes ya notificados hoy — omitidos
[BATCH] Procesando lote 1/2 (20 clientes)
[WA] ✓ Enviado a Juan Pérez (+521999...) — 2 facturas — $100.00
[WA] ✗ Fallo en Pedro López (+521888...) — intento 1/3
[WA] ✓ Reintento exitoso Pedro López — intento 2/3
[BATCH] Pausa entre lotes: 4m 12s
[BATCH] Procesando lote 2/2 (15 clientes)
[CRON] Ciclo MORNING completado — 34 enviados, 1 fallido — duración: 1h 23m
```

---

## 17. Riesgos Técnicos

| Riesgo | Probabilidad | Mitigación |
|--------|-------------|------------|
| Ban de número WhatsApp | Media | Delays largos, lotes pequeños, horarios naturales |
| WispHub API caída | Baja | Retry con backoff, log de error, skip ciclo |
| `telefono` inválido o vacío | Media | Validar formato antes de enviar, loggear y omitir |
| Evolution API caída | Baja | Health check antes de cada ciclo, alerta Telegram |
| Doble envío mismo día | Baja | Filtro en `notification_log` por cliente + fecha |
| `telefono` sin código de país | Alta | Normalizar número: agregar código país configurado |

---

## 18. Qué NO incluye este MVP

- Frontend o panel de administración
- Dashboard de métricas
- Gestión de respuestas de clientes (bot conversacional)
- Integración con pasarelas de pago
- Múltiples instancias de WhatsApp
- Multi-tenant (múltiples empresas)
- API REST pública
- Autenticación/autorización
- Blacklist de clientes (no enviar a ciertos números)

---

## 19. Tiempo Estimado de Desarrollo (con Claude)

| Tarea | Tiempo estimado |
|-------|----------------|
| Setup VPS: Docker, Docker Compose | 2–3 horas |
| Setup Evolution API + vincular número | 1–2 horas |
| Proyecto NestJS base + módulos | 2–3 horas |
| Integración WispHub (fetch + paginación) | 2–3 horas |
| Lógica de batch + delays + cron | 2–3 horas |
| Integración Evolution API (envío) | 1–2 horas |
| Webhook desconexión + alertas Telegram | 1–2 horas |
| PostgreSQL + TypeORM + entidades | 1–2 horas |
| Pruebas end-to-end + ajustes | 2–4 horas |
| **Total estimado** | **14–22 horas** |

---

## 20. Preparación para Escalar (Fase 2+)

Decisiones tomadas en MVP que facilitan el crecimiento:

- **PostgreSQL** → soporta carga alta, fácil agregar tablas
- **Docker Compose** → migrar a Docker Swarm o Kubernetes sin reescribir
- **Módulos desacoplados** → agregar canal SMS/Email sin tocar lógica de negocio
- **`notification_log`** → base para dashboard de métricas futuro
- **Variables de entorno centralizadas** → multi-tenant con mínimo esfuerzo

**Posibles Fase 2:**
- Panel web (Next.js) para ver logs y estadísticas
- Blacklist de clientes
- Bot conversacional (responder mensajes de clientes)
- Soporte multi-empresa
- Canal de notificación adicional (SMS, Email)
- Webhook de confirmación de pago desde pasarela
