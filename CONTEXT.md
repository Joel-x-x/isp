# ISP — Sistema de Notificación de Facturas Vencidas

Sistema automatizado que consulta facturas vencidas en WispHub y envía recordatorios de pago
vía WhatsApp, operado por un ISP para sus clientes de servicio de internet.

## Language

**Ciclo**:
Ejecución programada del proceso completo: consulta WispHub → agrupa por cliente → envía mensajes.
Ocurre dos veces al día (mañana y tarde).
_Avoid_: job, run, proceso, tarea

**Cliente**:
Persona o empresa con servicio de internet activo en WispHub. Tiene `telefono`, `nombre`, `usuario`.
_Avoid_: usuario, suscriptor, abonado

**Factura Vencida**:
Factura con `estado=1` (pendiente de pago) y `fecha_vencimiento` menor o igual a la fecha actual.
_Avoid_: deuda, cobro, cuenta pendiente

**Notificación**:
Mensaje de WhatsApp enviado a un cliente agrupando todas sus facturas vencidas. Una por cliente por ciclo.
_Avoid_: mensaje, alerta, recordatorio

**Lote**:
Grupo de 20 clientes procesados consecutivamente antes de aplicar pausa entre lotes.
_Avoid_: batch, grupo, chunk

**Estado de Conexión**:
Estado del número de WhatsApp en Evolution API. Puede ser `open` (conectado) o `close` (desvinculado).
Si `close`, los ciclos se abortan y se envía alerta a Telegram.
_Avoid_: estado del bot, conexión WA

**Log de Notificación**:
Registro en PostgreSQL de cada intento de envío. Campos clave: `cliente_id`, `estado` (SENT/FAILED), `fecha_envio`.
Previene doble envío en el mismo día.
_Avoid_: historial, registro, audit log
