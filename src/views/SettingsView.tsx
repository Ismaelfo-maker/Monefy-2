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
  LogOut,
  LogIn,
  UserCheck,
  Key,
} from 'lucide-react';
import { AppConfig, AuditLog, User } from '../types';
import { dbService } from '../services/database/indexedDB';
import { googleApi } from '../services/google/apiClient';
import { googleAuthService } from '../services/google/googleAuthService';
import { syncEngine } from '../services/sync/syncEngine';
import { backupService } from '../services/export/backupService';
import { formatDateTime } from '../utils/formatters';

interface SettingsViewProps {
  config: AppConfig;
  currentUser?: User | null;
  onUpdateConfig: (newConfig: AppConfig) => void;
  onNavigateToTests: () => void;
  onNavigateToBankImport: () => void;
  onLoadSampleData: () => void;
  onRefresh: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  config,
  currentUser,
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
  const [googleClientId, setGoogleClientId] = useState(config.googleClientId || '');
  const [authLoading, setAuthLoading] = useState(false);
  const [authMessage, setAuthMessage] = useState<{ success: boolean; text: string } | null>(null);
  const [copiedUserId, setCopiedUserId] = useState(false);

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
      googleClientId: googleClientId.trim() || undefined,
    };
    await dbService.saveConfig(updated);
    onUpdateConfig(updated);
  };

  const handleGoogleSignIn = async () => {
    setAuthLoading(true);
    setAuthMessage(null);
    try {
      // Save client ID if changed
      if (googleClientId.trim() && googleClientId.trim() !== config.googleClientId) {
        await handleSaveConfig();
      }
      const result = await googleAuthService.signIn(googleClientId.trim() || undefined);
      setUserName(result.user.name);
      onUpdateConfig(result.config);
      setAuthMessage({
        success: true,
        text: `¡Sesión iniciada con éxito! Conectado como ${result.user.name} (${result.user.email}).`,
      });
      onRefresh();
    } catch (err: any) {
      setAuthMessage({
        success: false,
        text: err?.message || 'Error al iniciar sesión con Google',
      });
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGoogleSignOut = async () => {
    setAuthLoading(true);
    setAuthMessage(null);
    try {
      const updated = await googleAuthService.signOut();
      onUpdateConfig(updated);
      setAuthMessage({
        success: true,
        text: 'Sesión cerrada correctamente. Los datos locales permanecen en tu dispositivo.',
      });
      onRefresh();
    } catch (err: any) {
      setAuthMessage({
        success: false,
        text: err?.message || 'Error al cerrar sesión de Google',
      });
    } finally {
      setAuthLoading(false);
    }
  };

  const copyUserId = () => {
    if (config.userId) {
      navigator.clipboard.writeText(config.userId);
      setCopiedUserId(true);
      setTimeout(() => setCopiedUserId(false), 2000);
    }
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

      {/* Google OAuth & User Identity */}
      <div id="google-oauth-section" className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Cuenta de Google & Identidad
              </h3>
              <p className="text-[11px] text-slate-500">
                Autenticación OAuth 2.0 para identidad de usuario estable
              </p>
            </div>
          </div>

          {config.userId ? (
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              Conectado
            </span>
          ) : (
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
              Modo Local
            </span>
          )}
        </div>

        {/* Feedback message */}
        {authMessage && (
          <div
            className={`p-3 rounded-xl text-xs font-medium ${
              authMessage.success
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            {authMessage.text}
          </div>
        )}

        {config.userId ? (
          /* Logged In State */
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-200">
              {currentUser?.avatarUrl ? (
                <img
                  src={currentUser.avatarUrl}
                  alt={currentUser.name}
                  className="w-10 h-10 rounded-full object-cover border border-slate-200 shadow-2xs"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
                  {(currentUser?.name || config.userName || 'U').charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-900 truncate">
                  {currentUser?.name || config.userName}
                </p>
                <p className="text-[11px] text-slate-500 truncate">
                  {currentUser?.email || config.userEmail || 'Cuenta de Google activa'}
                </p>
                {currentUser?.googleId && (
                  <p className="text-[10px] font-mono text-slate-400 truncate">
                    Google ID: {currentUser.googleId}
                  </p>
                )}
              </div>
            </div>

            {/* Stable User ID vs Device ID */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wide">
                    User ID (Permanente)
                  </span>
                  <button
                    onClick={copyUserId}
                    className="text-blue-600 hover:text-blue-800 p-1"
                    title="Copiar User ID"
                  >
                    {copiedUserId ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <p className="text-xs font-mono font-bold text-blue-950 truncate mt-1">
                  {config.userId}
                </p>
                <span className="text-[10px] text-blue-700 block mt-0.5">
                  Estable entre dispositivos
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">
                    Device ID (Este equipo)
                  </span>
                  <button
                    onClick={copyDeviceId}
                    className="text-slate-500 hover:text-slate-800 p-1"
                    title="Copiar Device ID"
                  >
                    {copiedDeviceId ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <p className="text-xs font-mono font-bold text-slate-800 truncate mt-1">
                  {config.deviceId}
                </p>
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  Único de este dispositivo
                </span>
              </div>
            </div>

            <div className="pt-1 flex items-center justify-between">
              <span className="text-[11px] text-slate-500">
                Los tokens no se almacenan en el almacenamiento local por seguridad.
              </span>
              <button
                id="btn-google-signout"
                type="button"
                onClick={handleGoogleSignOut}
                disabled={authLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 transition disabled:opacity-50"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>{authLoading ? 'Cerrando...' : 'Cerrar Sesión'}</span>
              </button>
            </div>
          </div>
        ) : (
          /* Logged Out / Local Mode State */
          <div className="space-y-3">
            <p className="text-xs text-slate-600 leading-relaxed">
              Inicia sesión con tu cuenta de Google para obtener tu identidad permanente de usuario (<code className="text-blue-600 font-mono text-[11px]">userId</code>). La aplicación seguirá funcionando offline con tus datos locales.
            </p>

            {/* Google Client ID Configuration */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                Google OAuth Client ID (Web Application)
              </label>
              <div className="flex gap-2">
                <input
                  id="input-google-client-id"
                  type="text"
                  placeholder="ej. 123456789-abc.apps.googleusercontent.com o dejar vacío si está en .env"
                  value={googleClientId}
                  onChange={(e) => setGoogleClientId(e.target.value)}
                  className="flex-1 text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-mono"
                />
                <button
                  type="button"
                  onClick={handleSaveConfig}
                  className="px-3 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl border border-slate-200 transition"
                  title="Guardar Client ID"
                >
                  Guardar
                </button>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Configúralo aquí o en <code className="font-mono">VITE_GOOGLE_CLIENT_ID</code> en tu entorno. No requiere client secret.
              </p>
            </div>

            {/* Sign In Button */}
            <div className="pt-2">
              <button
                id="btn-google-signin"
                type="button"
                onClick={handleGoogleSignIn}
                disabled={authLoading}
                className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm hover:shadow transition disabled:opacity-50"
              >
                {authLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#ffffff"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#ffffff"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#ffffff"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#ffffff"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                )}
                <span>{authLoading ? 'Conectando con Google...' : 'Iniciar Sesión con Google'}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Device & User Identity */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs p-5 space-y-3">
        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
          Configuración Local de Este Dispositivo
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
