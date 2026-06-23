import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable({
  providedIn: 'root',
})
export class LocalStorageService {
  private readonly isBrowser: boolean;

  constructor() {
    const platformId = inject(PLATFORM_ID);
    this.isBrowser = isPlatformBrowser(platformId);
  }

  /**
   * Obtém um item do localStorage
   */
  getItem(key: string): string | null {
    if (this.isBrowser) {
      return localStorage.getItem(key);
    }
    return null;
  }

  /**
   * Define um item no localStorage
   */
  setItem(key: string, value: string): void {
    if (this.isBrowser) {
      localStorage.setItem(key, value);
    }
  }

  /**
   * Remove um item do localStorage
   */
  removeItem(key: string): void {
    if (this.isBrowser) {
      localStorage.removeItem(key);
    }
  }

  /**
   * Limpa todos os itens do localStorage
   */
  clear(): void {
    if (this.isBrowser) {
      localStorage.clear();
    }
  }

  /**
   * Verifica se existe um item no localStorage
   */
  hasItem(key: string): boolean {
    if (this.isBrowser) {
      return localStorage.getItem(key) !== null;
    }
    return false;
  }

  /**
   * Obtém um item do localStorage e faz parse como JSON
   */
  getJSON<T>(key: string): T | null {
    const item = this.getItem(key);
    if (item) {
      try {
        return JSON.parse(item) as T;
      } catch (error) {
        console.error(`Erro ao fazer parse do item '${key}':`, error);
        return null;
      }
    }
    return null;
  }

  /**
   * Define um item no localStorage como JSON
   */
  setJSON(key: string, value: unknown): void {
    try {
      this.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`Erro ao salvar item '${key}' como JSON:`, error);
    }
  }

  /**
   * Obtém um item do localStorage com fallback
   */
  getItemWithFallback<T>(key: string, fallback: T): T {
    const item = this.getJSON<T>(key);
    return item !== null ? item : fallback;
  }
}
