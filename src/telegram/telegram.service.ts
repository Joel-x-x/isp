import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private readonly botToken: string;
  private readonly chatId: string;

  constructor(private readonly config: ConfigService) {
    this.botToken = config.get<string>('telegram.botToken') ?? '';
    this.chatId = config.get<string>('telegram.chatId') ?? '';
  }

  async alertarDesconexion(): Promise<void> {
    const evolutionUrl = this.config.get<string>('evolution.apiUrl') ?? '';
    const hora = new Date().toISOString();

    const mensaje =
      `⚠️ *WhatsApp Desconectado*\n\n` +
      `El número de WhatsApp se ha desvinculado.\n` +
      `Los envíos automáticos están *PAUSADOS*.\n\n` +
      `Acción requerida: Re\\-escanea el QR en:\n` +
      `${this.escaparMarkdown(evolutionUrl)}/manager\n\n` +
      `Hora: ${this.escaparMarkdown(hora)}`;

    await this.enviar(mensaje);
  }

  async alertarReconexion(): Promise<void> {
    const hora = new Date().toISOString();

    const mensaje =
      `✅ *WhatsApp Reconectado*\n\n` +
      `El número volvió a conectarse\\.\n` +
      `Los envíos automáticos se reanudan en el próximo ciclo\\.\n\n` +
      `Hora: ${this.escaparMarkdown(hora)}`;

    await this.enviar(mensaje);
  }

  async alertarErrorCiclo(ciclo: string, error: string): Promise<void> {
    const hora = new Date().toISOString();

    const mensaje =
      `🔴 *Error en ciclo ${ciclo}*\n\n` +
      `${this.escaparMarkdown(error)}\n\n` +
      `Hora: ${this.escaparMarkdown(hora)}`;

    await this.enviar(mensaje);
  }

  async reportarCicloCompletado(ciclo: string, enviados: number, fallidos: number, duracionMin: number): Promise<void> {
    const mensaje =
      `📊 *Ciclo ${ciclo} completado*\n\n` +
      `✅ Enviados: ${enviados}\n` +
      `❌ Fallidos: ${fallidos}\n` +
      `⏱ Duración: ${duracionMin} min`;

    await this.enviar(mensaje);
  }

  private async enviar(texto: string): Promise<void> {
    if (!this.botToken || !this.chatId) {
      this.logger.warn('[TELEGRAM] Bot token o chat ID no configurados — omitiendo alerta');
      return;
    }

    try {
      await axios.post(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
        chat_id: this.chatId,
        text: texto,
        parse_mode: 'MarkdownV2',
      });
    } catch (err) {
      this.logger.error(`[TELEGRAM] Error al enviar mensaje: ${err.message}`);
    }
  }

  private escaparMarkdown(texto: string): string {
    return texto.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
  }
}
