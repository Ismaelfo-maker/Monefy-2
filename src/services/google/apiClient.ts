/**
 * Monefy PWA - Google Apps Script Client
 * Handles HTTP requests to the Monefy Backend on Google Apps Script
 */

import { AppsScriptRequest, AppsScriptResponse, AppConfig } from '../../types';
import { generateUUID } from '../../utils/uuid';
import { dbService } from '../database/indexedDB';
import { googleAuthService } from './googleAuthService';

export class GoogleApiClient {
  /**
   * Send structured request to Apps Script Web App
   */
  public async sendRequest<T = any>(
    action: AppsScriptRequest['action'],
    payload: any = {}
  ): Promise<AppsScriptResponse<T>> {
    const config = await dbService.getConfig();
    const requestId = generateUUID();
    const timestamp = new Date().toISOString();

    if (!config.appsScriptUrl || !config.appsScriptUrl.trim()) {
      return {
        success: false,
        requestId,
        timestamp,
        error: 'URL de Google Apps Script no configurada. Ve a Configuración para configurarla.',
      };
    }

    const requestBody: AppsScriptRequest = {
      requestId,
      deviceId: config.deviceId,
      userId: config.userId,
      timestamp,
      action,
      payload: {
        ...payload,
        spreadsheetId: config.spreadsheetId || payload.spreadsheetId,
        driveFolderId: config.driveFolderId || payload.driveFolderId,
      },
    };

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'text/plain;charset=utf-8', // Apps Script accepts text/plain to prevent preflight OPTIONS failures
      };

      // Retrieve in-memory access token from googleAuthService (not persisted in IndexedDB)
      const inMemoryToken = googleAuthService.getAccessToken();
      const accessToken = inMemoryToken || config.googleAccessToken;
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }

      const response = await fetch(config.appsScriptUrl.trim(), {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        redirect: 'follow',
      });

      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
      }

      const responseText = await response.text();
      let data: AppsScriptResponse<T>;
      try {
        data = JSON.parse(responseText);
      } catch (parseErr) {
        throw new Error(`Respuesta de Apps Script no es JSON válido: ${responseText.substring(0, 100)}`);
      }

      return data;
    } catch (err: any) {
      await dbService.addLog(
        action,
        'error',
        `Error de comunicación con Apps Script: ${err.message || err}`
      );

      return {
        success: false,
        requestId,
        timestamp,
        error: err.message || 'Error de red al conectar con Google Apps Script',
      };
    }
  }

  /**
   * Test connectivity to the Apps Script deployment
   */
  public async testConnection(url?: string): Promise<{ ok: boolean; message: string; data?: any }> {
    const config = await dbService.getConfig();
    const targetUrl = (url || config.appsScriptUrl || '').trim();

    if (!targetUrl) {
      return { ok: false, message: 'La URL no puede estar vacía' };
    }

    try {
      const req: AppsScriptRequest = {
        requestId: generateUUID(),
        deviceId: config.deviceId,
        userId: config.userId,
        timestamp: new Date().toISOString(),
        action: 'PING',
        payload: {},
      };

      const res = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(req),
        redirect: 'follow',
      });

      if (!res.ok) {
        return { ok: false, message: `Error HTTP ${res.status}: ${res.statusText}` };
      }

      const text = await res.text();
      const json = JSON.parse(text);

      if (json.success) {
        return { ok: true, message: 'Conexión exitosa con Apps Script', data: json.data };
      } else {
        return { ok: false, message: json.error || 'Apps Script devolvió error' };
      }
    } catch (err: any) {
      return { ok: false, message: `Fallo de conexión: ${err.message || err}` };
    }
  }
}

export const googleApi = new GoogleApiClient();
