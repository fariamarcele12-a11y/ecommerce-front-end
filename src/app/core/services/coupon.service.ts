import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of, throwError, catchError, tap, map } from 'rxjs';
import { Coupon, CouponValidation, CouponFilter } from '../models/coupon.model';

@Injectable({
  providedIn: 'root'
})
export class CouponService {
  private apiUrl = 'https://ecommerce-api-mf.vercel.app/coupons';
  private localApiUrl = 'http://localhost:3000/coupons';

  // Cache local de cupons válidos
  private validCoupons = new BehaviorSubject<Coupon[]>([]);

  constructor(private http: HttpClient) {}

  /**
   * Busca todos os cupons
   */
  getCoupons(filters?: CouponFilter): Observable<Coupon[]> {
    let url = this.apiUrl;
    const params: string[] = [];

    if (filters) {
      if (filters.code) params.push(`code=${filters.code}`);
      if (filters.active !== undefined) params.push(`active=${filters.active}`);
      if (filters.minPurchase) params.push(`minPurchase_lte=${filters.minPurchase}`);
    }

    if (params.length > 0) {
      url += `?${params.join('&')}`;
    }

    return this.http.get<Coupon[]>(url).pipe(
      tap((coupons) => {
        // Atualizar cache com cupons válidos
        const valid = coupons.filter(c => this.isCouponValid(c));
        this.validCoupons.next(valid);
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Busca cupom por código
   */
  getCouponByCode(code: string): Observable<Coupon | null> {
    return this.http.get<Coupon[]>(`${this.apiUrl}?code=${code.toUpperCase()}`).pipe(
      map((coupons) => coupons.length > 0 ? coupons[0] : null),
      catchError(this.handleError)
    );
  }

  /**
   * Valida um cupom para um carrinho
   */
  validateCoupon(code: string, subtotal: number, category?: string, productId?: number): Observable<CouponValidation> {
    // Buscar cupom pelo código
    return this.getCouponByCode(code).pipe(
      map((coupon) => {
        if (!coupon) {
          return { valid: false, message: 'Cupom inválido ou não encontrado.' };
        }

        // Verificar se o cupom está ativo
        if (!coupon.active) {
          return { valid: false, message: 'Este cupom não está mais ativo.' };
        }

        // Verificar se o cupom já expirou
        const now = new Date();
        const startDate = new Date(coupon.startDate);
        const endDate = new Date(coupon.endDate);

        if (now < startDate) {
          return { valid: false, message: 'Este cupom ainda não está disponível.' };
        }

        if (now > endDate) {
          return { valid: false, message: 'Este cupom já expirou.' };
        }

        // Verificar limite de uso
        if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
          return { valid: false, message: 'Este cupom já atingiu o limite de uso.' };
        }

        // Verificar valor mínimo de compra
        if (coupon.minPurchase && subtotal < coupon.minPurchase) {
          return {
            valid: false,
            message: `Valor mínimo de compra: ${this.formatPrice(coupon.minPurchase)}`
          };
        }

        // Verificar categorias aplicáveis
        if (coupon.applicableCategories && coupon.applicableCategories.length > 0) {
          if (category && !coupon.applicableCategories.includes(category)) {
            return {
              valid: false,
              message: 'Este cupom não é válido para esta categoria.'
            };
          }
        }

        // Verificar produtos excluídos
        if (coupon.excludedProducts && productId && coupon.excludedProducts.includes(productId)) {
          return {
            valid: false,
            message: 'Este cupom não é válido para este produto.'
          };
        }

        // Calcular desconto
        let discountAmount = 0;
        if (coupon.discountType === 'percentage') {
          discountAmount = (subtotal * coupon.discountValue) / 100;
          if (coupon.maxDiscount && discountAmount > coupon.maxDiscount) {
            discountAmount = coupon.maxDiscount;
          }
        } else {
          discountAmount = coupon.discountValue;
        }

        // Não permitir desconto maior que o subtotal
        if (discountAmount > subtotal) {
          discountAmount = subtotal;
        }

        return {
          valid: true,
          message: 'Cupom aplicado com sucesso!',
          discountAmount: Math.round(discountAmount * 100) / 100,
          coupon: coupon
        };
      }),
      catchError((error) => {
        console.error('❌ Erro ao validar cupom:', error);
        return of({ valid: false, message: 'Erro ao validar cupom. Tente novamente.' });
      })
    );
  }

  /**
   * Aplica um cupom ao carrinho
   */
  applyCoupon(code: string, subtotal: number): Observable<CouponValidation> {
    return this.validateCoupon(code, subtotal).pipe(
      tap((validation) => {
        if (validation.valid && validation.coupon) {
          // Incrementar uso do cupom
          this.incrementCouponUsage(validation.coupon.id).subscribe();
        }
      })
    );
  }

  /**
   * Incrementa o uso de um cupom
   */
  incrementCouponUsage(couponId: number): Observable<Coupon> {
    return this.http.patch<Coupon>(`${this.apiUrl}/${couponId}`, {
      usedCount: 1,
      updatedAt: new Date()
    }).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Cria um novo cupom
   */
  createCoupon(coupon: Partial<Coupon>): Observable<Coupon> {
    const newCoupon: Coupon = {
      id: Date.now(),
      code: coupon.code?.toUpperCase() || '',
      description: coupon.description || '',
      discountType: coupon.discountType || 'percentage',
      discountValue: coupon.discountValue || 0,
      minPurchase: coupon.minPurchase || 0,
      maxDiscount: coupon.maxDiscount,
      startDate: coupon.startDate || new Date(),
      endDate: coupon.endDate || new Date(),
      usageLimit: coupon.usageLimit,
      usedCount: 0,
      active: coupon.active !== undefined ? coupon.active : true,
      applicableCategories: coupon.applicableCategories || [],
      applicableProducts: coupon.applicableProducts || [],
      excludedProducts: coupon.excludedProducts || [],
      createdAt: new Date(),
      ...coupon
    };

    return this.http.post<Coupon>(this.apiUrl, newCoupon).pipe(
      tap(() => this.getCoupons().subscribe()),
      catchError(this.handleError)
    );
  }

  /**
   * Atualiza um cupom
   */
  updateCoupon(id: number, coupon: Partial<Coupon>): Observable<Coupon> {
    return this.http.patch<Coupon>(`${this.apiUrl}/${id}`, {
      ...coupon,
      updatedAt: new Date()
    }).pipe(
      tap(() => this.getCoupons().subscribe()),
      catchError(this.handleError)
    );
  }

  /**
   * Remove um cupom
   */
  deleteCoupon(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      tap(() => this.getCoupons().subscribe()),
      catchError(this.handleError)
    );
  }

  /**
   * Verifica se um cupom é válido
   */
  private isCouponValid(coupon: Coupon): boolean {
    const now = new Date();
    const startDate = new Date(coupon.startDate);
    const endDate = new Date(coupon.endDate);

    return coupon.active &&
           now >= startDate &&
           now <= endDate &&
           (!coupon.usageLimit || coupon.usedCount < coupon.usageLimit);
  }

  /**
   * Formata preço para exibição
   */
  private formatPrice(price: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price);
  }

  /**
   * Tratamento de erros
   */
  private handleError(error: any) {
    console.error('❌ Erro no CouponService:', error);
    return throwError(() => new Error('Erro ao processar cupom.'));
  }
}
