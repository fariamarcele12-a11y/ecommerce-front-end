// src/app/core/services/password-reset.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, catchError, map } from 'rxjs';
import {
  PasswordResetRequest,
  PasswordResetConfirm,
  PasswordResetResponse,
  PasswordResetToken
} from '../models/password-reset.model';
import { environment } from '../../../environments/enviroment';

@Injectable({
  providedIn: 'root'
})
export class PasswordResetService {
  private apiUrl = `${environment.apiUrl}/password-reset`;

  private readonly http = inject(HttpClient);

  // ============================================================
  // SOLICITAR RESET
  // ============================================================
  requestReset(email: string): Observable<PasswordResetResponse> {
    return this.http.post<PasswordResetResponse>(`${this.apiUrl}/request`, { email }).pipe(
      catchError((error) => {
        console.error('❌ Erro ao solicitar reset:', error);
        return of({
          success: false,
          message: 'Erro ao processar sua solicitação. Tente novamente mais tarde.'
        } as PasswordResetResponse);
      })
    );
  }

  // ============================================================
  // VALIDAR TOKEN
  // ============================================================
  validateToken(token: string): Observable<{ valid: boolean; message: string; userId?: string }> {
    return this.http.get<{ valid: boolean; message: string; userId?: string }>(
      `${this.apiUrl}/validate/${token}`
    ).pipe(
      catchError((error) => {
        console.error('❌ Erro ao validar token:', error);
        return of({ valid: false, message: 'Erro ao validar token.' });
      })
    );
  }

  // ============================================================
  // CONFIRMAR RESET
  // ============================================================
  confirmReset(data: PasswordResetConfirm): Observable<PasswordResetResponse> {
    return this.http.post<PasswordResetResponse>(`${this.apiUrl}/confirm`, {
      token: data.token,
      newPassword: data.newPassword
    }).pipe(
      catchError((error) => {
        console.error('❌ Erro ao confirmar reset:', error);
        const msg = error?.error?.message || 'Erro ao redefinir senha. Tente novamente.';
        return of({ success: false, message: msg } as PasswordResetResponse);
      })
    );
  }
}