// src/app/core/services/coupon.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, of, throwError, catchError, tap, map } from 'rxjs';
import { Coupon, CouponValidation, CouponFilter, CreateCouponDTO, UpdateCouponDTO } from '../models/coupon.model';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/enviroment';

@Injectable({
  providedIn: 'root'
})
export class CouponService {
  private apiUrl = `${environment.apiUrl}/coupons`;
  private validCoupons = new BehaviorSubject<Coupon[]>([]);

  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);

  // ============================================================
  // LISTAR
  // ============================================================
  getCoupons(filters?: CouponFilter): Observable<Coupon[]> {
    let params = new HttpParams();
    if (filters) {
      if (filters.code) params = params.set('code', filters.code);
      if (filters.activeOnly !== undefined) params = params.set('activeOnly', String(filters.activeOnly));
    }

    return this.http.get<Coupon[]>(this.apiUrl, { params, headers: this.authHeaders() }).pipe(
      tap((coupons) => {
        const valid = coupons.filter(c => this.isCouponValid(c));
        this.validCoupons.next(valid);
      }),
      catchError(this.handleError)
    );
  }

  // ============================================================
  // BUSCAR POR CÓDIGO
  // ============================================================
  getCouponByCode(code: string): Observable<Coupon | null> {
    const upperCode = code.toUpperCase().trim();
    return this.getCoupons({ code: upperCode }).pipe(
      map((coupons) => (coupons.length > 0 ? coupons[0] : null)),
      catchError(() => of(null))
    );
  }

  // ============================================================
  // VALIDAR CUPOM (via backend)
  // ============================================================
  validateCoupon(code: string, subtotal: number): Observable<CouponValidation> {
    const payload = {
      code: code.toUpperCase().trim(),
      cartTotal: subtotal,
    };

    return this.http.post<CouponValidation>(
      `${this.apiUrl}/validate`,
      payload,
      { headers: this.authHeaders() }
    ).pipe(
      catchError((error) => {
        // Se o backend retornar 400 com a mensagem de erro
        const msg = error?.error?.message || 'Erro ao validar cupom.';
        return of({ valid: false, message: msg });
      })
    );
  }

  // ============================================================
  // APLICAR CUPOM (valida e retorna)
  // ============================================================
  applyCoupon(code: string, subtotal: number): Observable<CouponValidation> {
    return this.validateCoupon(code, subtotal);
  }

  // ============================================================
  // ADMIN: CRIAR / ATUALIZAR / EXCLUIR
  // ============================================================
  createCoupon(coupon: CreateCouponDTO): Observable<Coupon> {
    return this.http.post<Coupon>(this.apiUrl, coupon, { headers: this.authHeaders() }).pipe(
      tap(() => this.getCoupons().subscribe()),
      catchError(this.handleError)
    );
  }

  updateCoupon(id: string, coupon: UpdateCouponDTO): Observable<Coupon> {
    return this.http.put<Coupon>(`${this.apiUrl}/${id}`, coupon, { headers: this.authHeaders() }).pipe(
      tap(() => this.getCoupons().subscribe()),
      catchError(this.handleError)
    );
  }

  deleteCoupon(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`, { headers: this.authHeaders() }).pipe(
      tap(() => this.getCoupons().subscribe()),
      catchError(this.handleError)
    );
  }

  // ============================================================
  // HELPERS
  // ============================================================
  getValidCoupons(): Observable<Coupon[]> {
    return this.validCoupons.asObservable();
  }

  private isCouponValid(coupon: Coupon): boolean {
    const now = new Date();

    if (coupon.validFrom && new Date(coupon.validFrom) > now) return false;
    if (coupon.validUntil && new Date(coupon.validUntil) < now) return false;
    if (coupon.maxUses && coupon.currentUses >= coupon.maxUses) return false;

    return coupon.active;
  }

  private authHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return new HttpHeaders({
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    });
  }

  private handleError(error: any) {
    console.error('❌ Erro no CouponService:', error);
    const msg = error?.error?.message || 'Erro ao processar cupom.';
    return throwError(() => new Error(msg));
  }
}
