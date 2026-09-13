/**
 * Monefy PWA - Google OAuth Service
 * Implements client-side Google Identity Services (GIS) OAuth 2.0 flow.
 *
 * Security principles:
 * - NO client secrets or private keys anywhere in the frontend.
 * - NO access tokens or refresh tokens in IndexedDB, localStorage or sessionStorage.
 * - Access token is held in-memory ONLY during runtime.
 * - Stable user identity (sub) is persisted to 'users' and 'config' in IndexedDB.
 * - Full offline operation remains functional after authentication.
 */

import { User, AppConfig } from '../../types';
import { dbService } from '../database/indexedDB';
import { getOrCreateDeviceId } from '../../utils/device';

// In-memory token storage (volatile RAM only - NEVER persisted to storage)
let inMemoryAccessToken: string | null = null;
let inMemoryTokenExpiresAt: number | null = null;

// GSI Type declarations
interface GoogleTokenResponse {
  access_token: string;
  expires_in: string | number;
  scope: string;
  token_type: string;
  error?: string;
  error_description?: string;
}

interface GoogleTokenClient {
  requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
}

export interface GoogleUserProfile {
  sub: string;
  name: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  email: string;
  email_verified?: boolean;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  hasToken: boolean;
}

type AuthListener = (state: AuthState) => void;

class GoogleAuthService {
  private listeners: Set<AuthListener> = new Set();
  private tokenClient: GoogleTokenClient | null = null;
  private scriptLoadingPromise: Promise<boolean> | null = null;

  /**
   * Resolve configured Google OAuth Web Client ID
   * Checks environment variable (VITE_GOOGLE_CLIENT_ID) first, then app config.
   */
  public getClientId(config?: AppConfig): string {
    const envClientId = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID;
    if (envClientId && typeof envClientId === 'string' && envClientId.trim()) {
      return envClientId.trim();
    }
    if (config?.googleClientId && typeof config.googleClientId === 'string' && config.googleClientId.trim()) {
      return config.googleClientId.trim();
    }
    return '';
  }

  /**
   * Loads Google Identity Services (GSI) library dynamically if not already available
   */
  public async loadGsi(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    if ((window as any).google?.accounts?.oauth2) return true;

    if (this.scriptLoadingPromise) {
      return this.scriptLoadingPromise;
    }

    // If offline, do not block
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return false;
    }

    this.scriptLoadingPromise = new Promise((resolve) => {
      const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
      if (existing) {
        if ((window as any).google?.accounts?.oauth2) {
          resolve(true);
          return;
        }
        existing.addEventListener('load', () => resolve(true));
        existing.addEventListener('error', () => resolve(false));
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.head.appendChild(script);
    });

    return this.scriptLoadingPromise;
  }

  /**
   * Request Google OAuth login and get user profile
   */
  public async signIn(customClientId?: string): Promise<{ user: User; config: AppConfig }> {
    if (typeof window === 'undefined') {
      throw new Error('OAuth sólo está disponible en el navegador');
    }

    if (!navigator.onLine) {
      throw new Error('No hay conexión a internet para autenticar con Google. La app sigue operativa con datos locales.');
    }

    const currentConfig = await dbService.getConfig();
    const clientId = customClientId || this.getClientId(currentConfig);

    if (!clientId) {
      throw new Error(
        'Client ID de Google no configurado. Configúralo en Ajustes o define VITE_GOOGLE_CLIENT_ID en tu archivo .env'
      );
    }

    // Ensure GSI script is loaded
    const gsiLoaded = await this.loadGsi();
    if (!gsiLoaded || !(window as any).google?.accounts?.oauth2) {
      throw new Error('No se pudo cargar Google Identity Services. Comprueba tu conexión de red.');
    }

    // Request OAuth 2.0 Access Token using Google Token Client
    const tokenResponse = await new Promise<GoogleTokenResponse>((resolve, reject) => {
      try {
        const tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: 'openid email profile',
          callback: (res: GoogleTokenResponse) => {
            if (res.error) {
              reject(new Error(res.error_description || res.error || 'Error al autorizar con Google'));
            } else {
              resolve(res);
            }
          },
          error_callback: (err: any) => {
            reject(new Error(err?.message || 'Error en ventana de Google OAuth'));
          },
        });

        this.tokenClient = tokenClient;
        tokenClient.requestAccessToken({ prompt: 'consent' });
      } catch (err: any) {
        reject(new Error(err?.message || 'Error inicializando cliente de autenticación de Google'));
      }
    });

    // Save token strictly in volatile memory (never to storage)
    inMemoryAccessToken = tokenResponse.access_token;
    const expiresInSec = typeof tokenResponse.expires_in === 'string'
      ? parseInt(tokenResponse.expires_in, 10)
      : tokenResponse.expires_in;
    inMemoryTokenExpiresAt = Date.now() + (expiresInSec || 3600) * 1000;

    // Fetch user profile from Google's official userinfo endpoint
    const profileResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: {
        Authorization: `Bearer ${inMemoryAccessToken}`,
      },
    });

    if (!profileResponse.ok) {
      throw new Error(`Error al obtener información del perfil (${profileResponse.status})`);
    }

    const profile: GoogleUserProfile = await profileResponse.json();
    if (!profile.sub) {
      throw new Error('La respuesta de Google no contiene un identificador único de usuario (sub)');
    }

    // Stable User ID derived from Google sub (e.g. 'usr_108394829384729104829')
    const stableUserId = `usr_${profile.sub}`;
    const deviceId = getOrCreateDeviceId();
    const now = new Date().toISOString();

    // 1. Persist or update user in IndexedDB 'users' store
    const existingUser = await dbService.getUser(stableUserId);
    const userToSave: User = {
      id: stableUserId,
      email: profile.email,
      name: profile.name || profile.email.split('@')[0],
      avatarUrl: profile.picture || '',
      googleId: profile.sub,
      role: 'owner',
      status: 'active',
      createdAt: existingUser?.createdAt || now,
      updatedAt: now,
      isDeleted: false,
      createdByUserId: stableUserId,
      updatedByUserId: stableUserId,
      createdByDeviceId: deviceId,
      updatedByDeviceId: deviceId,
      deviceId: deviceId,
    };

    const savedUser = await dbService.saveUser(userToSave);

    // 2. Link authenticated user to AppConfig in IndexedDB
    const updatedConfig: AppConfig = {
      ...currentConfig,
      userId: stableUserId,
      userName: savedUser.name,
      userEmail: savedUser.email,
      googleClientId: clientId,
    };

    await dbService.saveConfig(updatedConfig);

    // Notify listeners
    this.notify({
      isAuthenticated: true,
      user: savedUser,
      hasToken: true,
    });

    return { user: savedUser, config: updatedConfig };
  }

  /**
   * Log out current user, revoking and destroying in-memory tokens
   */
  public async signOut(): Promise<AppConfig> {
    // 1. Revoke access token if exists
    if (inMemoryAccessToken && typeof window !== 'undefined' && (window as any).google?.accounts?.oauth2) {
      try {
        (window as any).google.accounts.oauth2.revoke(inMemoryAccessToken, () => {
          // revocation callback
        });
      } catch (e) {
        console.warn('Error al revocar token:', e);
      }
    }

    // 2. Clear volatile memory tokens
    inMemoryAccessToken = null;
    inMemoryTokenExpiresAt = null;

    // 3. Disable GSI auto-select if available
    if (typeof window !== 'undefined' && (window as any).google?.accounts?.id) {
      try {
        (window as any).google.accounts.id.disableAutoSelect();
      } catch (e) {
        // ignore
      }
    }

    // 4. Update config in IndexedDB to reset active session user
    const currentConfig = await dbService.getConfig();
    const updatedConfig: AppConfig = {
      ...currentConfig,
      userId: '',
      userName: '',
      userEmail: '',
    };

    await dbService.saveConfig(updatedConfig);

    // Notify listeners
    this.notify({
      isAuthenticated: false,
      user: null,
      hasToken: false,
    });

    return updatedConfig;
  }

  /**
   * Return in-memory access token for authorized API requests (Phase 3 preparation)
   * Returns null if expired or not authenticated.
   */
  public getAccessToken(): string | null {
    if (!inMemoryAccessToken) return null;
    if (inMemoryTokenExpiresAt && Date.now() >= inMemoryTokenExpiresAt) {
      inMemoryAccessToken = null;
      inMemoryTokenExpiresAt = null;
      return null;
    }
    return inMemoryAccessToken;
  }

  /**
   * Check if an active, unexpired in-memory token exists
   */
  public hasValidToken(): boolean {
    return this.getAccessToken() !== null;
  }

  /**
   * Subscribe to auth state changes
   */
  public subscribe(listener: AuthListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(state: AuthState): void {
    for (const listener of this.listeners) {
      try {
        listener(state);
      } catch (e) {
        console.error('Error en listener de autenticación:', e);
      }
    }
  }
}

export const googleAuthService = new GoogleAuthService();
