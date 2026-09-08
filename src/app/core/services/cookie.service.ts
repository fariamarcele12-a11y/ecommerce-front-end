// src/app/core/services/cookie.service.ts
import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export interface CookieOptions {
  expires?: number | Date;
  path?: string;
  domain?: string;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
  httpOnly?: boolean;
}

// 🔥 Renomeado para CookieConsentSettings para evitar conflito
export interface CookieConsentSettings {
  necessary: boolean;
  preferences: boolean;
  analytics: boolean;
  marketing: boolean;
  accepted: boolean;
  acceptedAt?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CookieService {
  private isBrowser: boolean;
  private defaultOptions: CookieOptions = {
    path: '/',
    sameSite: 'Lax'
  };

  private readonly CONSENT_COOKIE_NAME = 'cookie_consent';
  private readonly CONSENT_EXPIRY_DAYS = 365;

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  /**
   * 🔥 Define um cookie
   */
  setCookie(name: string, value: string, options?: CookieOptions): void {
    if (!this.isBrowser) return;

    const mergedOptions = { ...this.defaultOptions, ...options };
    let cookieString = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;

    if (mergedOptions.expires) {
      if (typeof mergedOptions.expires === 'number') {
        const date = new Date();
        date.setTime(date.getTime() + mergedOptions.expires * 24 * 60 * 60 * 1000);
        cookieString += `; expires=${date.toUTCString()}`;
      } else {
        cookieString += `; expires=${mergedOptions.expires.toUTCString()}`;
      }
    }

    if (mergedOptions.path) {
      cookieString += `; path=${mergedOptions.path}`;
    }

    if (mergedOptions.domain) {
      cookieString += `; domain=${mergedOptions.domain}`;
    }

    if (mergedOptions.secure) {
      cookieString += '; secure';
    }

    if (mergedOptions.sameSite) {
      cookieString += `; samesite=${mergedOptions.sameSite}`;
    }

    document.cookie = cookieString;
  }

  /**
   * 🔥 Obtém um cookie
   */
  getCookie(name: string): string | null {
    if (!this.isBrowser) return null;

    const cookies = document.cookie.split('; ');
    for (const cookie of cookies) {
      const [key, value] = cookie.split('=');
      if (decodeURIComponent(key) === name) {
        return decodeURIComponent(value);
      }
    }
    return null;
  }

  /**
   * 🔥 Remove um cookie
   */
  deleteCookie(name: string, path?: string): void {
    if (!this.isBrowser) return;

    const options: CookieOptions = {
      expires: new Date(0),
      path: path || '/'
    };

    this.setCookie(name, '', options);
  }

  /**
   * 🔥 Verifica se um cookie existe
   */
  hasCookie(name: string): boolean {
    return this.getCookie(name) !== null;
  }

  /**
   * 🔥 Salva o consentimento do usuário
   */
  saveConsent(consent: CookieConsentSettings): void {
    const value = JSON.stringify(consent);
    const options: CookieOptions = {
      expires: this.CONSENT_EXPIRY_DAYS,
      path: '/'
    };
    this.setCookie(this.CONSENT_COOKIE_NAME, value, options);
  }

  /**
   * 🔥 Obtém o consentimento do usuário
   */
  getConsent(): CookieConsentSettings | null {
    const consent = this.getCookie(this.CONSENT_COOKIE_NAME);
    if (consent) {
      try {
        return JSON.parse(consent);
      } catch (error) {
        console.error('❌ Erro ao parsear consentimento:', error);
        return null;
      }
    }
    return null;
  }

  /**
   * 🔥 Verifica se o usuário aceitou os cookies
   */
  hasConsent(): boolean {
    const consent = this.getConsent();
    return consent?.accepted || false;
  }

  /**
   * 🔥 Verifica se uma categoria específica de cookie é permitida
   */
  isCategoryAllowed(category: 'necessary' | 'preferences' | 'analytics' | 'marketing'): boolean {
    const consent = this.getConsent();
    if (!consent) return false;

    if (category === 'necessary') return true;

    return consent[category] || false;
  }

  /**
   * 🔥 Aceita todos os cookies
   */
  acceptAll(): void {
    const consent: CookieConsentSettings = {
      necessary: true,
      preferences: true,
      analytics: true,
      marketing: true,
      accepted: true,
      acceptedAt: new Date().toISOString()
    };
    this.saveConsent(consent);
  }

  /**
   * 🔥 Recusa todos os cookies (exceto os necessários)
   */
  rejectAll(): void {
    const consent: CookieConsentSettings = {
      necessary: true,
      preferences: false,
      analytics: false,
      marketing: false,
      accepted: true,
      acceptedAt: new Date().toISOString()
    };
    this.saveConsent(consent);
  }

  /**
   * 🔥 Salva preferências personalizadas
   */
  savePreferences(preferences: Partial<CookieConsentSettings>): void {
    const currentConsent = this.getConsent() || {
      necessary: true,
      preferences: false,
      analytics: false,
      marketing: false,
      accepted: false
    };

    const updatedConsent: CookieConsentSettings = {
      ...currentConsent,
      ...preferences,
      accepted: true,
      acceptedAt: new Date().toISOString()
    };

    this.saveConsent(updatedConsent);
  }
}
