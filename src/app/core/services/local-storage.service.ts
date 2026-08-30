// src/app/core/services/local-storage.service.ts
import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable } from 'rxjs';

export interface StorageChangeEvent {
  key: string;
  oldValue: string | null;
  newValue: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class LocalStorageService {
  private readonly isBrowser: boolean;
  private readonly storageChanges = new BehaviorSubject<StorageChangeEvent | null>(null);

  constructor() {
    const platformId = inject(PLATFORM_ID);
    this.isBrowser = isPlatformBrowser(platformId);

    // 🔥 Escutar mudanças de storage entre abas/janelas
    if (this.isBrowser) {
      window.addEventListener('storage', (event) => {
        this.storageChanges.next({
          key: event.key || '',
          oldValue: event.oldValue,
          newValue: event.newValue,
        });
      });
    }
  }

  /**
   * 🔥 Observable para escutar mudanças no storage
   */
  getStorageChanges(): Observable<StorageChangeEvent | null> {
    return this.storageChanges.asObservable();
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
      const oldValue = localStorage.getItem(key);
      localStorage.setItem(key, value);
      // Notificar mudança local
      this.storageChanges.next({
        key,
        oldValue,
        newValue: value,
      });
    }
  }

  /**
   * Remove um item do localStorage
   */
  removeItem(key: string): void {
    if (this.isBrowser) {
      const oldValue = localStorage.getItem(key);
      localStorage.removeItem(key);
      this.storageChanges.next({
        key,
        oldValue,
        newValue: null,
      });
    }
  }

  /**
   * Limpa todos os itens do localStorage
   */
  clear(): void {
    if (this.isBrowser) {
      localStorage.clear();
      this.storageChanges.next({
        key: '*',
        oldValue: null,
        newValue: null,
      });
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
        console.error(`❌ Erro ao fazer parse do item '${key}':`, error);
        return null;
      }
    }
    return null;
  }

  /**
   * Define um item no localStorage como JSON
   */
  setJSON<T>(key: string, value: T): void {
    try {
      const oldValue = this.getItem(key);
      const newValue = JSON.stringify(value);
      this.setItem(key, newValue);
    } catch (error) {
      console.error(`❌ Erro ao salvar item '${key}' como JSON:`, error);
    }
  }

  /**
   * Obtém um item do localStorage com fallback
   */
  getItemWithFallback<T>(key: string, fallback: T): T {
    const item = this.getJSON<T>(key);
    return item !== null ? item : fallback;
  }

  /**
   * 🔥 Obtém todos os itens do localStorage como objeto
   */
  getAll(): Record<string, string> {
    if (!this.isBrowser) return {};

    const result: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        result[key] = localStorage.getItem(key) || '';
      }
    }
    return result;
  }

  /**
   * 🔥 Obtém todos os itens do localStorage como JSON
   */
  getAllJSON(): Record<string, unknown> {
    const items = this.getAll();
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(items)) {
      try {
        result[key] = JSON.parse(value);
      } catch {
        result[key] = value;
      }
    }
    return result;
  }

  /**
   * 🔥 Remove múltiplos itens do localStorage
   */
  removeItems(keys: string[]): void {
    keys.forEach(key => this.removeItem(key));
  }

  /**
   * 🔥 Verifica se o localStorage está disponível
   */
  isAvailable(): boolean {
    if (!this.isBrowser) return false;

    try {
      const testKey = '__storage_test__';
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 🔥 Obtém o espaço utilizado no localStorage (em bytes)
   */
  getUsedSpace(): number {
    if (!this.isBrowser) return 0;

    let total = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        const value = localStorage.getItem(key) || '';
        total += key.length + value.length;
      }
    }
    return total;
  }

  /**
   * 🔥 Prefixa uma chave (útil para namespaces)
   */
  prefixedKey(prefix: string, key: string): string {
    return `${prefix}:${key}`;
  }

  /**
   * 🔥 Busca todas as chaves com um prefixo específico
   */
  getKeysWithPrefix(prefix: string): string[] {
    if (!this.isBrowser) return [];

    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        keys.push(key);
      }
    }
    return keys;
  }

  /**
   * 🔥 Remove todos os itens com um prefixo específico
   */
  removeItemsWithPrefix(prefix: string): void {
    const keys = this.getKeysWithPrefix(prefix);
    this.removeItems(keys);
  }

  /**
   * 🔥 Obtém itens com um prefixo específico
   */
  getItemsWithPrefix<T>(prefix: string): Record<string, T> {
    const keys = this.getKeysWithPrefix(prefix);
    const result: Record<string, T> = {};
    for (const key of keys) {
      const value = this.getJSON<T>(key);
      if (value !== null) {
        result[key] = value;
      }
    }
    return result;
  }
}
