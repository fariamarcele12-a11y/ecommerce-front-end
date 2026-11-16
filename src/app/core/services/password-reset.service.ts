// src/app/core/services/password-reset.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
  PasswordResetConfirm,
  PasswordResetResponse,
  ValidateTokenResponse,
} from '../models/password-reset.model';
import { environment } from '../../../environments/enviroment';

@Injectable({
  providedIn: 'root'
})
export class PasswordResetService {
  private apiUrl = `${environment.apiUrl}/password-reset`;
  private readonly http = inject(HttpClient);

  requestReset(email: string): Observable<PasswordResetResponse> {
    return this.http
      .post<PasswordResetResponse>(`${this.apiUrl}/request`, { email })
      .pipe(
        catchError((error: HttpErrorResponse) => {
          console.error('❌ Erro ao solicitar reset:', error);
          return throwError(() => error);
        })
      );
  }

  validateToken(token: string): Observable<ValidateTokenResponse> {
    return this.http
      .get<ValidateTokenResponse>(`${this.apiUrl}/validate/${token}`)
      .pipe(
        catchError((error: HttpErrorResponse) => {
          console.error('❌ Erro ao validar token:', error);
          const backendMessage = error.error?.message;
          return throwError(() => ({
            ...error,
            error: {
              ...error.error,
              message: backendMessage ?? 'Erro ao validar token.'
            }
          }));
        })
      );
  }

  confirmReset(data: PasswordResetConfirm): Observable<PasswordResetResponse> {
    return this.http
      .post<PasswordResetResponse>(`${this.apiUrl}/confirm`, {
        token: data.token,
        newPassword: data.newPassword,
      })
      .pipe(
        catchError((error: HttpErrorResponse) => {
          console.error('❌ Erro ao confirmar reset:', error);
          const backendMessage = error.error?.message;
          return throwError(() => ({
            ...error,
            error: {
              ...error.error,
              message: backendMessage ?? 'Erro ao redefinir senha. Tente novamente.'
            }
          }));
        })
      );
  }
}
