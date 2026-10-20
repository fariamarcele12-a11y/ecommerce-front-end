// src/app/core/services/cart.service.ts
import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError, catchError, of } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';
import { Product } from '../models/ProductModel/product.model';
import {
  CartItem,
  CartSummary,
  CheckoutItem,
  ApiCartResponse,
} from '../models/cart.model';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/enviroment';

type Coupon = Record<string, number>;

@Injectable({
  providedIn: 'root',
})
export class CartService {
  private apiUrl = `${environment.apiUrl}/carts`;

  private cartItems = new BehaviorSubject<CartItem[]>([]);
  private totalItems = new BehaviorSubject<number>(0);
  private totalPrice = new BehaviorSubject<number>(0);
  private discount = new BehaviorSubject<number>(0);
  private shipping = new BehaviorSubject<number>(0);
  private couponCode = new BehaviorSubject<string>('');

  private isBrowser: boolean;

  // Chaves do localStorage para cupom (itens agora ficam no backend)
  private readonly COUPON_KEY_PREFIX = 'appliedCoupon_';
  private readonly GUEST_COUPON_KEY = 'appliedCoupon_guest';

  private currentUserId: string | null = null;

  private readonly platformId = inject(PLATFORM_ID);
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);

  constructor() {
    this.isBrowser = isPlatformBrowser(this.platformId);

    // Escutar mudanças de usuário
    this.authService.currentUser$.subscribe((user) => {
      const newUserId = user?.id ? String(user.id) : null;

      if (this.currentUserId !== newUserId) {
        console.log('🛒 CartService: usuário mudou', this.currentUserId, '->', newUserId);
        this.currentUserId = newUserId;

        if (user) {
          this.loadCartFromServer();
        } else {
          this.updateCart([]);
          this.removeDiscount();
        }
      }
    });
  }

  // ============================================================
  // CARREGAMENTO DO BACKEND
  // ============================================================
  private loadCartFromServer(): void {
    if (!this.isBrowser) return;

    this.http.get<ApiCartResponse>(this.apiUrl, { headers: this.authHeaders() })
      .pipe(
        catchError((error) => {
          console.warn('⚠️ Erro ao carregar carrinho:', error);
          return of({ id: '', userId: '', items: [] } as ApiCartResponse);
        })
      )
      .subscribe((cart) => {
        this.updateFromServer(cart);
        this.loadCouponFromStorage();
      });
  }

  private updateFromServer(cart: ApiCartResponse): void {
    const items: CartItem[] = (cart.items || [])
      .filter((i) => i.product !== null)
      .map((i) => ({
        product: i.product as Product,
        quantity: i.quantity,
        subtotal: (i.product?.price || 0) * i.quantity,
      }));

    this.updateCart(items);
  }

  // ============================================================
  // OBSERVABLES PÚBLICOS
  // ============================================================
  getCartItems(): Observable<CartItem[]> { return this.cartItems.asObservable(); }
  getTotalItems(): Observable<number> { return this.totalItems.asObservable(); }
  getTotalPrice(): Observable<number> { return this.totalPrice.asObservable(); }
  getDiscount(): Observable<number> { return this.discount.asObservable(); }
  getShipping(): Observable<number> { return this.shipping.asObservable(); }
  getCouponCode(): Observable<string> { return this.couponCode.asObservable(); }

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
        sellerId: this.getSellerIdFromProduct(product),
        sellerName: this.getSellerNameFromProduct(product),
      };
    });
  }

  // ============================================================
  // AÇÕES DO CARRINHO (sincronizadas com backend)
  // ============================================================
  addToCart(product: Product, quantity = 1): void {
    if (!this.currentUserId) {
      if (this.isBrowser) {
        alert('Faça login para adicionar produtos ao carrinho.');
      }
      return;
    }

    const payload = { productId: product.id, quantity };

    this.http.post<ApiCartResponse>(`${this.apiUrl}/items`, payload, { headers: this.authHeaders() })
      .pipe(
        catchError((error) => {
          if (this.isBrowser) {
            alert(error.error?.message || 'Erro ao adicionar item.');
          }
          return throwError(() => error);
        })
      )
      .subscribe((cart) => this.updateFromServer(cart));
  }

  removeFromCart(productId: string): void {
    this.http.delete<ApiCartResponse>(`${this.apiUrl}/items/${productId}`, { headers: this.authHeaders() })
      .pipe(
        catchError((error) => {
          console.error('Erro ao remover', error);
          return throwError(() => error);
        })
      )
      .subscribe((cart) => this.updateFromServer(cart));
  }

  updateQuantity(productId: string, quantity: number): void {
    if (quantity <= 0) {
      this.removeFromCart(productId);
      return;
    }

    this.http.patch<ApiCartResponse>(`${this.apiUrl}/items/${productId}`, { quantity }, { headers: this.authHeaders() })
      .pipe(
        catchError((error) => {
          if (this.isBrowser) {
            alert(error.error?.message || 'Erro ao atualizar quantidade.');
          }
          return throwError(() => error);
        })
      )
      .subscribe((cart) => this.updateFromServer(cart));
  }

  clearCart(): void {
    this.http.delete(`${this.apiUrl}`, { headers: this.authHeaders() })
      .pipe(
        catchError((error) => {
          console.warn('Erro ao limpar carrinho', error);
          return of(null);
        })
      )
      .subscribe(() => {
        this.updateCart([]);
        this.discount.next(0);
        this.couponCode.next('');
        this.removeCouponFromStorage();
      });
  }

  // ============================================================
  // CUPONS E CÁLCULOS (mantidos no frontend)
  // ============================================================
  applyCoupon(code: string): Observable<{ valid: boolean; message: string; discountAmount?: number }> {
    const currentTotal = this.totalPrice.value;
    if (currentTotal === 0) {
      return of({ valid: false, message: 'Carrinho vazio. Adicione produtos para aplicar o cupom.' });
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
          this.getCouponKey(),
          JSON.stringify({ code: upperCode, discount: discountAmount })
        );
      }

      return of({ valid: true, message: 'Cupom aplicado com sucesso!', discountAmount });
    }

    return of({ valid: false, message: 'Cupom inválido. Verifique o código digitado.' });
  }

  removeDiscount(): void {
    this.discount.next(0);
    this.couponCode.next('');
    this.removeCouponFromStorage();
  }

  hasDiscount(): boolean {
    return this.discount.value > 0;
  }

  getAppliedCoupon(): { code: string; discount: number } | null {
    const code = this.couponCode.value;
    const discount = this.discount.value;
    if (code && discount > 0) return { code, discount };
    return null;
  }

  calculateShipping(): void {
    const total = this.totalPrice.value;
    let shippingCost = 0;

    if (total > 0) {
      if (total >= 100) shippingCost = 0;
      else if (total >= 50) shippingCost = 15.9;
      else shippingCost = 25.9;
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
      0
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

  isEmpty(): boolean { return this.cartItems.value.length === 0; }
  getUniqueItemCount(): number { return this.cartItems.value.length; }

  isProductInCart(productId: string): boolean {
    return this.cartItems.value.some((item) => String(item.product.id) === String(productId));
  }

  getProductQuantity(productId: string): number {
    const item = this.cartItems.value.find((item) => String(item.product.id) === String(productId));
    return item ? item.quantity : 0;
  }

  // ============================================================
  // HELPERS INTERNOS
  // ============================================================
  private getSellerIdFromProduct(product: Product): string {
    const p: any = product || {};
    return String(p.seller?.id || p.sellerId || p.storeId || p.ownerId || p.userId || '1');
  }

  private getSellerNameFromProduct(product: Product): string {
    const p: any = product || {};
    return p.seller?.name || p.sellerName || p.storeName || p.ownerName || 'Vendedor';
  }

  private updateCart(items: CartItem[]): void {
    items.forEach((item) => {
      item.subtotal = item.product.price * item.quantity;
    });

    this.cartItems.next(items);
    this.totalItems.next(items.reduce((sum, item) => sum + item.quantity, 0));
    this.totalPrice.next(items.reduce((sum, item) => sum + item.product.price * item.quantity, 0));

    this.calculateShipping();
  }

  private getCouponKey(): string {
    return this.currentUserId
      ? `${this.COUPON_KEY_PREFIX}${this.currentUserId}`
      : this.GUEST_COUPON_KEY;
  }

  private loadCouponFromStorage(): void {
    if (!this.isBrowser) return;
    const couponData = localStorage.getItem(this.getCouponKey());
    if (couponData) {
      try {
        const coupon = JSON.parse(couponData);
        this.discount.next(coupon.discount);
        this.couponCode.next(coupon.code);
      } catch (e) {
        console.error('Erro ao carregar cupom', e);
      }
    }
  }

  private removeCouponFromStorage(): void {
    if (this.isBrowser) localStorage.removeItem(this.getCouponKey());
  }

  private authHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return new HttpHeaders({
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    });
  }
}
