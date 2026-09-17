// src/app/core/services/cart.service.ts
import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  BehaviorSubject,
  Observable,
  throwError,
  catchError,
  of,
  tap,
  switchMap,
  forkJoin,
  map,
} from 'rxjs';
import { isPlatformBrowser } from '@angular/common';
import { Product } from '../models/ProductModel/product.model';

export interface CartItem {
  product: Product;
  quantity: number;
  subtotal?: number;
}

export interface CartSummary {
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  itemCount: number;
  savings: number;
}

export interface ServerCart {
  id: number;
  items: {
    productId: string;
    quantity: number;
  }[];
}

/**
 * 🔥 Estrutura pronta para o checkout (com sellerId)
 */
export interface CheckoutItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  subtotal: number;
  image: string;
  sellerId: string;
  sellerName: string;
}

type Coupon = Record<string, number>;

@Injectable({
  providedIn: 'root',
})
export class CartService {
  private apiUrl = 'http://localhost:3000/cart';

  private cartItems = new BehaviorSubject<CartItem[]>([]);
  private totalItems = new BehaviorSubject<number>(0);
  private totalPrice = new BehaviorSubject<number>(0);
  private discount = new BehaviorSubject<number>(0);
  private shipping = new BehaviorSubject<number>(0);
  private couponCode = new BehaviorSubject<string>('');

  private isBrowser: boolean;
  private isSyncing = false;

  private readonly platformId = inject(PLATFORM_ID);
  private readonly http = inject(HttpClient);

  constructor() {
    this.isBrowser = isPlatformBrowser(this.platformId);

    if (this.isBrowser) {
      this.loadCartFromStorage();
      this.syncCartWithServer();
    }
  }

  getCartItems(): Observable<CartItem[]> {
    return this.cartItems.asObservable();
  }

  getTotalItems(): Observable<number> {
    return this.totalItems.asObservable();
  }

  getTotalPrice(): Observable<number> {
    return this.totalPrice.asObservable();
  }

  getDiscount(): Observable<number> {
    return this.discount.asObservable();
  }

  getShipping(): Observable<number> {
    return this.shipping.asObservable();
  }

  getCouponCode(): Observable<string> {
    return this.couponCode.asObservable();
  }

  /**
   * 🔥 Retorna os itens formatados para o checkout (com sellerId)
   */
  getCheckoutItems(): CheckoutItem[] {
    return this.cartItems.value.map((item) => {
      const product = item.product;
      const price = product.price || 0;
      const quantity = item.quantity || 1;

      return {
        productId: String(product.id),
        productName: product.name,
        quantity,
        price,
        subtotal: price * quantity,
        image: product.images?.[0] || '',
        sellerId: this.getSellerIdFromItem(item),
        sellerName: this.getSellerNameFromItem(item),
      };
    });
  }

  addToCart(product: Product, quantity = 1): void {
    const currentItems = this.cartItems.value;
    const existingItem = currentItems.find((item) => item.product.id === product.id);

    if (existingItem) {
      const newQuantity = existingItem.quantity + quantity;
      if (newQuantity <= product.stock) {
        existingItem.quantity = newQuantity;
      } else {
        existingItem.quantity = product.stock;
        if (this.isBrowser) {
          alert(`Desculpe, só temos ${product.stock} unidades disponíveis.`);
        }
      }
    } else {
      if (quantity <= product.stock) {
        currentItems.push({
          product,
          quantity: Math.min(quantity, product.stock),
          subtotal: product.price * quantity,
        });
      } else {
        if (this.isBrowser) {
          alert(`Desculpe, só temos ${product.stock} unidades disponíveis.`);
        }
        return;
      }
    }

    this.updateCart(currentItems);
    this.saveToStorageAndServer(currentItems);

    // 🔥 LOG de debug
    console.log('🛒 Produto adicionado:', {
      id: product.id,
      name: product.name,
      seller: product.seller,
      sellerIdExtraido: this.getSellerIdFromProduct(product),
    });
  }

  removeFromCart(productId: string): void {
    const currentItems = this.cartItems.value.filter((item) => item.product.id !== productId);
    this.updateCart(currentItems);
    this.saveToStorageAndServer(currentItems);
  }

  updateQuantity(productId: string, quantity: number): void {
    const currentItems = this.cartItems.value;
    const item = currentItems.find((item) => item.product.id === productId);

    if (item) {
      if (quantity <= 0) {
        this.removeFromCart(productId);
      } else if (quantity <= item.product.stock) {
        item.quantity = quantity;
        this.updateCart(currentItems);
        this.saveToStorageAndServer(currentItems);
      } else {
        if (this.isBrowser) {
          alert(`Desculpe, só temos ${item.product.stock} unidades disponíveis.`);
        }
      }
    }
  }

  clearCart(): void {
    console.log('🗑️ Limpando APENAS o carrinho...');

    this.updateCart([]);
    this.discount.next(0);
    this.couponCode.next('');
    this.shipping.next(0);
    this.totalItems.next(0);
    this.totalPrice.next(0);

    if (this.isBrowser) {
      localStorage.removeItem('cart');
      localStorage.removeItem('appliedCoupon');
    }

    this.saveCartToServer([]);
  }

  applyCoupon(
    code: string,
  ): Observable<{ valid: boolean; message: string; discountAmount?: number }> {
    const currentTotal = this.totalPrice.value;

    if (currentTotal === 0) {
      return of({
        valid: false,
        message: 'Carrinho vazio. Adicione produtos para aplicar o cupom.',
      });
    }

    const upperCode = code.toUpperCase().trim();
    const validCoupons: Coupon = {
      PROMO10: 10,
      PROMO20: 20,
      PROMO30: 30,
      BLACKFRIDAY: 50,
      FREEGIFT: 0,
      WELCOME10: 10,
      VIP20: 20,
    };

    if (upperCode in validCoupons) {
      const discountValue = validCoupons[upperCode];
      const maxDiscount = currentTotal * 0.5;
      const discountAmount = Math.min((currentTotal * discountValue) / 100, maxDiscount);

      this.discount.next(discountAmount);
      this.couponCode.next(upperCode);

      if (this.isBrowser) {
        localStorage.setItem(
          'appliedCoupon',
          JSON.stringify({
            code: upperCode,
            discount: discountAmount,
          }),
        );
      }

      return of({
        valid: true,
        message: 'Cupom aplicado com sucesso!',
        discountAmount: discountAmount,
      });
    }

    return of({
      valid: false,
      message: 'Cupom inválido. Verifique o código digitado.',
    });
  }

  removeDiscount(): void {
    this.discount.next(0);
    this.couponCode.next('');
    if (this.isBrowser) {
      localStorage.removeItem('appliedCoupon');
    }
  }

  hasDiscount(): boolean {
    return this.discount.value > 0;
  }

  getAppliedCoupon(): { code: string; discount: number } | null {
    const code = this.couponCode.value;
    const discount = this.discount.value;

    if (code && discount > 0) {
      return { code, discount };
    }
    return null;
  }

  calculateShipping(): void {
    const total = this.totalPrice.value;
    let shippingCost = 0;

    if (total > 0) {
      if (total >= 100) {
        shippingCost = 0;
      } else if (total >= 50) {
        shippingCost = 15.9;
      } else {
        shippingCost = 25.9;
      }
    }

    this.shipping.next(shippingCost);
  }

  getCartSummary(): CartSummary {
    const subtotal = this.totalPrice.value;
    const discount = this.discount.value;
    const shipping = this.shipping.value;
    const total = subtotal - discount + shipping;
    const itemCount = this.totalItems.value;

    const originalTotal = this.cartItems.value.reduce(
      (sum, item) => sum + (item.product.oldPrice || item.product.price) * item.quantity,
      0,
    );
    const savings = originalTotal - subtotal;

    return {
      subtotal,
      discount,
      shipping,
      total: Math.max(total, 0),
      itemCount,
      savings: Math.max(savings, 0),
    };
  }

  isEmpty(): boolean {
    return this.cartItems.value.length === 0;
  }

  getUniqueItemCount(): number {
    return this.cartItems.value.length;
  }

  isProductInCart(productId: string): boolean {
    return this.cartItems.value.some((item) => item.product.id === productId);
  }

  getProductQuantity(productId: string): number {
    const item = this.cartItems.value.find((item) => item.product.id === productId);
    return item ? item.quantity : 0;
  }

  // ============================================
  // 🔥 HELPERS PARA O CHECKOUT (sellerId)
  // ============================================

  /**
   * 🔥 Extrai o sellerId do PRODUTO (lida com seller.id aninhado)
   */
  private getSellerIdFromProduct(product: Product): string {
    const p: any = product || {};
    return String(
      p.seller?.id ||       // 🔥 SEU CASO: seller.id
      p.sellerId ||         // fallback 1
      p.storeId ||          // fallback 2
      p.ownerId ||          // fallback 3
      p.userId ||           // fallback 4
      '1'                   // último recurso
    );
  }

  /**
   * 🔥 Extrai o sellerName do PRODUTO (lida com seller.name aninhado)
   */
  private getSellerNameFromProduct(product: Product): string {
    const p: any = product || {};
    return (
      p.seller?.name ||     // 🔥 SEU CASO: seller.name
      p.sellerName ||       // fallback 1
      p.storeName ||        // fallback 2
      p.ownerName ||        // fallback 3
      'Vendedor'            // último recurso
    );
  }

  /**
   * 🔥 Extrai o sellerId de um ITEM do carrinho
   */
  private getSellerIdFromItem(item: CartItem): string {
    return this.getSellerIdFromProduct(item.product);
  }

  /**
   * 🔥 Extrai o sellerName de um ITEM do carrinho
   */
  private getSellerNameFromItem(item: CartItem): string {
    return this.getSellerNameFromProduct(item.product);
  }

  // ============================================
  // MÉTODOS PRIVADOS
  // ============================================

  private updateCart(items: CartItem[]): void {
    items.forEach((item) => {
      item.subtotal = item.product.price * item.quantity;
    });

    this.cartItems.next(items);

    const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
    this.totalItems.next(totalItems);

    const totalPrice = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
    this.totalPrice.next(totalPrice);

    this.calculateShipping();
  }

  private saveToStorageAndServer(items: CartItem[]): void {
    if (this.isBrowser) {
      this.saveCartToStorage(items);
    }
    this.saveCartToServer(items);
  }

  private saveCartToStorage(items: CartItem[]): void {
    try {
      // 🔥 Salva o produto COMPLETO (inclui seller aninhado) + quantity
      const cartData = items.map((item) => ({
        product: item.product,
        quantity: item.quantity,
      }));
      localStorage.setItem('cart', JSON.stringify(cartData));
    } catch (error) {
      console.error('Erro ao salvar carrinho:', error);
    }
  }

  private saveCartToServer(items: CartItem[]): void {
    if (this.isSyncing) return;

    const cartData = items.map((item) => ({
      productId: item.product.id,
      quantity: item.quantity,
    }));

    this.http
      .get<ServerCart[]>(this.apiUrl)
      .pipe(
        switchMap((carts) => {
          if (carts && carts.length > 0) {
            const cart = carts[0];
            return this.http.put<ServerCart>(`${this.apiUrl}/${cart.id}`, {
              ...cart,
              items: cartData,
            });
          } else {
            return this.http.post<ServerCart>(this.apiUrl, {
              id: 1,
              items: cartData,
            });
          }
        }),
        catchError((error) => {
          console.warn('⚠️ Erro ao salvar carrinho:', error);
          return of(null);
        }),
      )
      .subscribe();
  }

  private loadCartFromStorage(): void {
    if (!this.isBrowser) return;

    try {
      const cartData = localStorage.getItem('cart');
      if (cartData) {
        const parsedData = JSON.parse(cartData);
        if (parsedData && parsedData.length > 0) {
          // 🔥 Reconstrói os itens com o produto completo (preserva seller)
          const items: CartItem[] = parsedData
            .filter((d: any) => d.product)
            .map((d: any) => ({
              product: d.product,
              quantity: d.quantity,
              subtotal: d.product.price * d.quantity,
            }));

          if (items.length > 0) {
            this.updateCart(items);
            console.log('🛒 Carrinho restaurado:', items.length, 'itens');
            console.log('🛒 Sellers:', items.map((i) => this.getSellerIdFromItem(i)));
          }
        }
      }

      const couponData = localStorage.getItem('appliedCoupon');
      if (couponData) {
        const coupon = JSON.parse(couponData);
        this.discount.next(coupon.discount);
        this.couponCode.next(coupon.code);
      }
    } catch (error) {
      console.error('Erro ao carregar carrinho do localStorage:', error);
    }
  }

  private syncCartWithServer(): void {
    if (!this.isBrowser) return;

    this.isSyncing = true;

    this.http
      .get<ServerCart[]>(this.apiUrl)
      .pipe(
        switchMap((carts) => {
          if (carts && carts.length > 0) {
            console.log('📦 Carrinho existente encontrado:', carts[0]);
            return of(carts[0]);
          }
          console.log('📦 Criando novo carrinho...');
          return this.http.post<ServerCart>(this.apiUrl, {
            id: 1,
            items: [],
          });
        }),
        catchError((error) => {
          console.warn('⚠️ Erro ao sincronizar carrinho:', error);
          this.isSyncing = false;
          return of(null);
        }),
      )
      .subscribe((serverCart) => {
        this.isSyncing = false;
        if (serverCart) {
          console.log('📦 Carrinho carregado:', serverCart);
        }
      });
  }

  syncCart(): void {
    if (!this.isBrowser) return;
    this.cleanupDuplicatedCarts().subscribe(() => {
      this.syncCartWithServer();
    });
  }

  private cleanupDuplicatedCarts(): Observable<void> {
    return this.http.get<ServerCart[]>(this.apiUrl).pipe(
      switchMap((carts) => {
        if (!carts || carts.length <= 1) {
          return of(void 0);
        }
        console.log(`🗑️ Removendo ${carts.length - 1} carrinhos duplicados...`);
        const deleteCarts = carts.slice(1);
        const deleteRequests = deleteCarts.map((cart) =>
          this.http.delete(`${this.apiUrl}/${cart.id}`),
        );
        return forkJoin(deleteRequests).pipe(
          map(() => {
            console.log('✅ Carrinhos duplicados removidos!');
            return void 0;
          }),
        );
      }),
      catchError((error) => {
        console.warn('⚠️ Erro ao limpar carrinhos:', error);
        return of(void 0);
      }),
    );
  }

  debugCart(): void {
    console.log('🛒 Estado atual do carrinho:');
    console.log('  - Itens:', this.cartItems.value);
    console.log('  - Total de itens:', this.totalItems.value);
    console.log('  - Preço total:', this.totalPrice.value);
    console.log('  - Desconto:', this.discount.value);
    console.log('  - Frete:', this.shipping.value);
    console.log('  - Cupom:', this.couponCode.value);
    console.log('  - Sellers:', this.cartItems.value.map((i) => ({
      produto: i.product.name,
      sellerId: this.getSellerIdFromItem(i),
      sellerName: this.getSellerNameFromItem(i),
    })));
  }
}
