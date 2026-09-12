import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running as an installed PWA, hide the button
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        id="btn-install-pwa"
        onClick={install}
        className="flex items-center gap-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 text-xs font-semibold shadow-sm transition active:scale-95"
        title="Instalar Monefy en tu dispositivo"
      >
        <Download className="w-3.5 h-3.5" />
        <span>Instalar App</span>
      </button>
    );
  }

  // iOS Safari flow (beforeinstallprompt is not supported by WebKit)
  if (isIOS) {
    return (
      <>
        <button
          id="btn-install-ios"
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-1.5 rounded-full border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 px-3 py-1.5 text-xs font-medium hover:bg-emerald-100 transition"
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>Instalar en iOS</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-2xl border border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-emerald-600" />
                  Instalar en iPhone / iPad
                </h3>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <ol className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300 list-decimal list-inside">
                <li>
                  Toca el botón <strong className="text-emerald-700 dark:text-emerald-400">Compartir</strong> en la barra inferior de Safari.
                </li>
                <li>
                  Desplázate hacia abajo y selecciona <strong className="text-emerald-700 dark:text-emerald-400">Añadir a la pantalla de inicio</strong>.
                </li>
                <li>
                  Toca <strong className="text-emerald-700 dark:text-emerald-400">Añadir</strong> para instalar Monefy como aplicación nativa offline.
                </li>
              </ol>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full rounded-xl bg-emerald-600 text-white py-2 text-xs font-semibold hover:bg-emerald-700"
              >
                Entendido
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
