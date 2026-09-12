import React, { useState, useEffect } from 'react';
import {
  Settings,
  Cloud,
  FolderSync,
  Database,
  Download,
  Upload,
  FileSpreadsheet,
  Terminal,
  ShieldCheck,
  RefreshCw,
  Copy,
  Check,
  ExternalLink,
  HelpCircle,
  AlertTriangle,
} from 'lucide-react';
import { AppConfig, AuditLog } from '../types';
import { dbService } from '../services/database/indexedDB';
import { googleApi } from '../services/google/apiClient';
import { syncEngine } from '../services/sync/syncEngine';
import { backupService } from '../services/export/backupService';
import { formatDateTime } from '../utils/formatters';

interface SettingsViewProps {
  config: AppConfig;
  onUpdateConfig: (newConfig: AppConfig) => void;
  onNavigateToTests: () => void;
  onNavigateToBankImport: () => void;
  onLoadSampleData: () => void;
  onRefresh: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  config,
  onUpdateConfig,
  onNavigateToTests,
  onNavigateToBankImport,
  onLoadSampleData,
  onRefresh,
}) => {
  const [appsScriptUrl, setAppsScriptUrl] = useState(config.appsScriptUrl || '');
  const [spreadsheetId, setSpreadsheetId] = useState(config.spreadsheetId || '');
  const [driveFolderId, setDriveFolderId] = useState(config.driveFolderId || '');
  const [userName, setUserName] = useState(config.userName || '');
  const [currency, setCurrency] = useState(config.currency || 'EUR');

  const [testStatus, setTestStatus] = useState<{
    loading: boolean;
    success?: boolean;
    message?: string;
  }>({ loading: false });

  const [initSheetsStatus, setInitSheetsStatus] = useState<{
    loading: boolean;
    success?: boolean;
    message?: string;
  }>({ loading: false });

  const [copiedDeviceId, setCopiedDeviceId] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [restoreFileJson, setRestoreFileJson] = useState<any>(null);

  useEffect(() => {
    dbService.getLogs(20).then(setAuditLogs);
  }, []);

  const handleSaveConfig = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const updated: AppConfig = {
      ...config,
      appsScriptUrl: appsScriptUrl.trim(),
      spreadsheetId: spreadsheetId.trim() || undefined,
      driveFolderId: driveFolderId.trim() || undefined,
      userName: userName.trim() || 'Usuario Principal',
      currency,
    };
    await dbService.saveConfig(updated);
    onUpdateConfig(updated);
  };

  const handleTestConnection = async () => {
    setTestStatus({ loading: true });
    await handleSaveConfig();
    const result = await googleApi.testConnection(appsScriptUrl.trim());
    setTestStatus({
      loading: false,
      success: result.ok,
      message: result.message,
    });
  };

  const handleInitializeSheets = async () => {
    if (!appsScriptUrl.trim()) {
      alert('Debes configurar la URL de Apps Script primero');
      return;
    }
    setInitSheetsStatus({ loading: true });
    await handleSaveConfig();

    const response = await googleApi.sendRequest('CREATE_DATABASE', {
      spreadsheetId: spreadsheetId.trim() || undefined,
    });

    if (response.success && response.data) {
      setInitSheetsStatus({
        loading: false,
        success: true,
        message: `¡Base de datos lista! Se crearon todas las hojas en: ${response.data.spreadsheetName}`,
      });
      if (response.data.spreadsheetId && !spreadsheetId) {
        setSpreadsheetId(response.data.spreadsheetId);
        const updated = { ...config, spreadsheetId: response.data.spreadsheetId };
        await dbService.saveConfig(updated);
        onUpdateConfig(updated);
      }
    } else {
      setInitSheetsStatus({
        loading: false,
        success: false,
        message: response.error || 'Error inicializando hojas',
      });
    }
  };

  const copyDeviceId = () => {
    navigator.clipboard.writeText(config.deviceId);
    setCopiedDeviceId(true);
    setTimeout(() => setCopiedDeviceId(false), 2000);
  };

  const handleBackupDownload = async () => {
    await backupService.downloadJsonBackup();
  };

  const handleFileSelectForRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string);
        setRestoreFileJson(parsed);
        setShowRestoreModal(true);
      } catch (err) {
        alert('El archivo seleccionado no es un JSON válido');
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmRestore = async () => {
    if (!restoreFileJson) return;
    const res = await backupService.restoreFromJson(restoreFileJson);
    setShowRestoreModal(false);
    alert(res.message);
    onRefresh();
  };

  return (
    <div className="space-y-4 pb-24">
      {/* Header */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs p-5">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Settings className="w-5 h-5 text-emerald-600" />
          Ajustes & Conexión Google Sheets
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Configuración del backend en Google Apps Script, respaldos y herramientas de diagnóstico.
        </p>
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={onNavigateToBankImport}
          className="p-4 rounded-3xl border border-slate-200/80 bg-white hover:bg-slate-50 text-left transition shadow-2xs flex flex-col justify-between"
        >
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-2">
            <Upload className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900">Importación Bancaria</h4>
            <p className="text-[10px] text-slate-500 mt-0.5">ING, ABANCA, Revolut, CSV</p>
          </div>
        </button>

        <button
          onClick={onNavigateToTests}
          className="p-4 rounded-3xl border border-slate-200/80 bg-white hover:bg-slate-50 text-left transition shadow-2xs flex flex-col justify-between"
        >
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900">Batería de Pruebas</h4>
            <p className="text-[10px] text-slate-500 mt-0.5">Verificación de 20 tests obligatorios</p>
          </div>
        </button>
      </div>

      {/* Google Apps Script Backend Settings */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs p-5 space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
          <Cloud className="w-4 h-4 text-emerald-600" />
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Backend Propio (Google Apps Script)
          </h3>
        </div>

        <form onSubmit={handleSaveConfig} className="space-y-3">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
              URL del Despliegue Web App de Apps Script
            </label>
            <input
              id="input-appsscript-url"
              type="url"
              value={appsScriptUrl}
              onChange={(e) => setAppsScriptUrl(e.target.value)}
              placeholder="https://script.google.com/macros/s/.../exec"
              className="w-full text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Despliega el código de la carpeta <code>/apps-script</code> en tu Google Drive como Aplicación Web ("Ejecutar como: Yo", "Acceso: Cualquiera").
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                ID de Hoja de Cálculo (Opcional)
              </label>
              <input
                type="text"
                value={spreadsheetId}
                onChange={(e) => setSpreadsheetId(e.target.value)}
                placeholder="Dejar vacío para crear una automática"
                className="w-full text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                ID Carpeta Google Drive Tickets (Opcional)
              </label>
              <input
                type="text"
                value={driveFolderId}
                onChange={(e) => setDriveFolderId(e.target.value)}
                placeholder="Dejar vacío para usar 'Monefy_Tickets'"
                className="w-full text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testStatus.loading || !appsScriptUrl.trim()}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition disabled:opacity-40"
            >
              {testStatus.loading ? 'Comprobando...' : 'Probar Conexión'}
            </button>

            <button
              type="button"
              onClick={handleInitializeSheets}
              disabled={initSheetsStatus.loading || !appsScriptUrl.trim()}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition disabled:opacity-40"
            >
              {initSheetsStatus.loading ? 'Creando Hojas...' : 'Inicializar Hojas (Sheets)'}
            </button>

            <button
              type="submit"
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
            >
              Guardar Configuración
            </button>
          </div>

          {testStatus.message && (
            <div
              className={`p-3 rounded-xl text-xs font-medium ${
                testStatus.success
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}
            >
              {testStatus.message}
            </div>
          )}

          {initSheetsStatus.message && (
            <div
              className={`p-3 rounded-xl text-xs font-medium ${
                initSheetsStatus.success
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}
            >
              {initSheetsStatus.message}
            </div>
          )}
        </form>
      </div>

      {/* Device & User Identity */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs p-5 space-y-3">
        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
          Identidad de Este Dispositivo
        </h3>

        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-200">
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase">Device ID</span>
            <p className="text-xs font-mono font-bold text-slate-800 mt-0.5">{config.deviceId}</p>
          </div>
          <button
            onClick={copyDeviceId}
            className="p-2 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-200/60"
            title="Copiar Device ID"
          >
            {copiedDeviceId ? (
              <Check className="w-4 h-4 text-emerald-600" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-1">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
              Nombre de Usuario
            </label>
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
              Moneda
            </label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2"
            >
              <option value="EUR">Euro (€)</option>
              <option value="USD">Dólar ($)</option>
              <option value="GBP">Libra (£)</option>
              <option value="MXN">Peso Mexicano ($)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Backup and Restore */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs p-5 space-y-3">
        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
          Copias de Seguridad (Backups)
        </h3>
        <p className="text-xs text-slate-500">
          Descarga un archivo JSON con todos tus movimientos, cuentas y reglas, libre de credenciales.
        </p>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            onClick={handleBackupDownload}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Descargar Backup JSON</span>
          </button>

          <label className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer">
            <Upload className="w-3.5 h-3.5" />
            <span>Restaurar Backup</span>
            <input
              type="file"
              accept=".json"
              onChange={handleFileSelectForRestore}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Optional Sample Data (Requirement 38) */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs p-5 space-y-2">
        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
          Datos de Prueba (Opcional)
        </h3>
        <p className="text-xs text-slate-500">
          Por defecto la app arranca limpia y sin datos ficticios. Si deseas probar con movimientos de demostración, puedes cargarlos aquí.
        </p>
        <button
          onClick={onLoadSampleData}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
        >
          Cargar Datos de Ejemplo
        </button>
      </div>

      {/* Audit Log / Sync History */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
            <Terminal className="w-4 h-4 text-slate-500" />
            Registro de Actividad y Auditoría (Últimos 20)
          </h3>
          <button
            onClick={() => dbService.getLogs(20).then(setAuditLogs)}
            className="p-1 text-slate-400 hover:text-slate-700"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="max-h-52 overflow-y-auto space-y-1.5 font-mono text-[11px] bg-slate-50 p-2.5 rounded-2xl border border-slate-200">
          {auditLogs.length === 0 ? (
            <p className="text-slate-400 text-center py-4">No hay registros de auditoría aún.</p>
          ) : (
            auditLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-start justify-between gap-2 p-1.5 rounded-lg bg-white border border-slate-100"
              >
                <div className="min-w-0">
                  <span
                    className={`font-bold mr-1.5 ${
                      log.status === 'success'
                        ? 'text-emerald-600'
                        : log.status === 'error'
                        ? 'text-rose-600'
                        : 'text-amber-600'
                    }`}
                  >
                    [{log.action}]
                  </span>
                  <span className="text-slate-700">{log.message}</span>
                </div>
                <span className="text-[9px] text-slate-400 whitespace-nowrap">
                  {formatDateTime(log.timestamp)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Restore Confirmation Modal */}
      {showRestoreModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center gap-2.5 text-amber-600">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-base font-bold text-slate-900">¿Confirmar Restauración?</h3>
            </div>
            <p className="text-xs text-slate-600">
              Se importarán los datos del archivo de copia de seguridad. Los elementos existentes con el mismo UUID se actualizarán y se mantendrán los registros previos.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowRestoreModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 rounded-xl hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmRestore}
                className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs"
              >
                Restaurar Datos
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
