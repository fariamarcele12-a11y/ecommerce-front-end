// src/app/core/services/id-generator.service.ts
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class IdGeneratorService {

  /**
   * 🔥 Gera um ID único no formato UUID v4
   */
  generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * 🔥 Gera um ID curto (8 caracteres) para exibição
   */
  generateShortId(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * 🔥 Gera um ID para produto
   */
  generateProductId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `PROD-${timestamp}-${random}`;
  }

  /**
   * 🔥 Gera um ID para loja
   */
  generateStoreId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 6);
    return `STR-${timestamp}-${random}`;
  }

  /**
   * 🔥 Gera um ID para mensagens do chat
   */
  generateMessageId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 6);
    return `MSG-${timestamp}-${random}`;
  }

  /**
   * 🔥 Gera um ID para pedidos
   */
  generateOrderId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 4);
    return `ORD-${timestamp}-${random}`;
  }

  /**
   * 🔥 Gera um ID para categorias
   */
  generateCategoryId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 6);
    return `CAT-${timestamp}-${random}`;
  }

  /**
   * 🔥 Gera um ID para cupons
   */
  generateCouponId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 6);
    return `CPN-${timestamp}-${random}`;
  }
}
