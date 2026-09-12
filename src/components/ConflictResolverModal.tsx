import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, Check, ArrowRight, ShieldAlert } from 'lucide-react';
import { SyncConflict } from '../types';
import { dbService } from '../services/database/indexedDB';
import { syncEngine } from '../services/sync/syncEngine';
import { formatDateTime } from '../utils/formatters';

interface ConflictResolverModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResolved: () => void;
}

export const ConflictResolverModal: React.FC<ConflictResolverModalProps> = ({
  isOpen,
  onClose,
  onResolved,
}) => {
  const [conflicts, setConflicts] = useState<SyncConflict[]>([]);
  const [selectedConflict, setSelectedConflict] = useState<SyncConflict | null>(null);

  const loadConflicts = async () => {
    const list = await dbService.getConflicts();
    setConflicts(list);
    if (list.length > 0 && !selectedConflict) {
      setSelectedConflict(list[0]);
    } else if (list.length === 0) {
      setSelectedConflict(null);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadConflicts();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleResolve = async (resolution: 'keep_local' | 'keep_remote') => {
    if (!selectedConflict) return;

    await syncEngine.resolveConflict(selectedConflict.id, resolution);
    await loadConflicts();
    onResolved();

    if (conflicts.length <= 1) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 overflow-y-auto">
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-amber-50/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Conflictos de Sincronización
              </h2>
              <p className="text-xs text-slate-500">
                Dos dispositivos modificaron la misma entidad concurrentemente
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-200/60 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {conflicts.length === 0 ? (
            <div className="text-center py-10">
              <Check className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700">No hay conflictos pendientes</p>
              <p className="text-xs text-slate-500 mt-1">Todos tus datos están sincronizados correctamente.</p>
            </div>
          ) : (
            <>
              {/* Conflict Selector if multiple */}
              {conflicts.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {conflicts.map((c, i) => (
                    <button
                      key={c.id}
                      onClick={() => setSelectedConflict(c)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                        selectedConflict?.id === c.id
                          ? 'bg-amber-500 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      Conflicto #{i + 1}: {c.entityType} ({c.entityId.substring(0, 8)}...)
                    </button>
                  ))}
                </div>
              )}

              {selectedConflict && (
                <div className="space-y-4">
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 text-xs">
                    <span className="font-bold text-slate-700 uppercase">Tipo de entidad: </span>
                    <span className="text-amber-700 font-semibold">{selectedConflict.entityType}</span>
                    <span className="text-slate-400 mx-2">|</span>
                    <span className="text-slate-500">Detectado: {formatDateTime(selectedConflict.detectedAt)}</span>
                  </div>

                  {/* Side by side comparison */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Local Version */}
                    <div className="p-4 rounded-2xl border-2 border-emerald-200 bg-emerald-50/30 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                            Versión Local (Este dispositivo)
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {formatDateTime(selectedConflict.localVersion?.updatedAt)}
                          </span>
                        </div>
                        <pre className="text-xs font-mono bg-white p-3 rounded-xl border border-emerald-100 overflow-x-auto max-h-56 text-slate-800">
                          {JSON.stringify(selectedConflict.localVersion, null, 2)}
                        </pre>
                      </div>

                      <button
                        onClick={() => handleResolve('keep_local')}
                        className="mt-4 w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition"
                      >
                        Conservar Versión Local
                      </button>
                    </div>

                    {/* Remote Version */}
                    <div className="p-4 rounded-2xl border-2 border-blue-200 bg-blue-50/30 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-blue-800 uppercase tracking-wider">
                            Versión Remota (Google Sheets)
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {formatDateTime(selectedConflict.remoteVersion?.updatedAt)}
                          </span>
                        </div>
                        <pre className="text-xs font-mono bg-white p-3 rounded-xl border border-blue-100 overflow-x-auto max-h-56 text-slate-800">
                          {JSON.stringify(selectedConflict.remoteVersion, null, 2)}
                        </pre>
                      </div>

                      <button
                        onClick={() => handleResolve('keep_remote')}
                        className="mt-4 w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition"
                      >
                        Conservar Versión Remota
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
