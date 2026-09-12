import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineBanner: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      id="banner-offline"
      className="bg-amber-600 text-white text-xs font-medium py-1.5 px-3 flex items-center justify-center gap-2 shadow-xs transition-all animate-in fade-in"
    >
      <WifiOff className="w-3.5 h-3.5 animate-pulse" />
      <span>Modo Offline activo: todos los datos se guardan de forma segura en tu dispositivo (IndexedDB).</span>
    </div>
  );
};
