// src/app/core/services/password-reset.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError, catchError, tap, map, switchMap } from 'rxjs';
import {
  PasswordResetRequest,
  PasswordResetConfirm,
  PasswordResetResponse,
  PasswordResetToken
} from '../models/password-reset.model';

@Injectable({
  providedIn: 'root'
})
export class PasswordResetService {
  private apiUrl = 'http://localhost:3000';
  private resetTokensUrl = `${this.apiUrl}/passwordResetTokens`;

  constructor(private http: HttpClient) {}

  /**
   * 🔥 Solicita reset de senha
   */
  requestReset(email: string): Observable<PasswordResetResponse> {
    console.log(`📧 Solicitando reset de senha para: ${email}`);

    // 🔥 Verificar se o usuário existe
    return this.http.get<any[]>(`${this.apiUrl}/users?email=${email}`).pipe(
      switchMap((users) => {
        if (users.length === 0) {
          // 🔥 Não revelar se o usuário existe ou não (segurança)
          return of({
            success: true,
            message: 'Se o email estiver cadastrado, você receberá as instruções para redefinir sua senha.'
          } as PasswordResetResponse);
        }

        const user = users[0];

        // 🔥 Criar token de reset
        const tokenData = {
          userId: user.id,
          token: this.generateToken(),
          expiresAt: new Date(Date.now() + 3600000).toISOString(), // 1 hora
          used: false,
          createdAt: new Date().toISOString()
        };

        // 🔥 Salvar token no servidor (JSON Server)
        return this.http.post(this.resetTokensUrl, tokenData).pipe(
          map(() => {
            // 🔥 Simular envio de email
            console.log(`📧 Token de reset gerado para ${user.email}: ${tokenData.token}`);
            console.log(`🔗 Link de reset: http://localhost:4200/redefinir-senha?token=${tokenData.token}`);

            return {
              success: true,
              message: 'Se o email estiver cadastrado, você receberá as instruções para redefinir sua senha.'
            } as PasswordResetResponse;
          })
        );
      }),
      catchError((error) => {
        console.error('❌ Erro ao solicitar reset:', error);
        return of({
          success: false,
          message: 'Erro ao processar sua solicitação. Tente novamente mais tarde.'
        } as PasswordResetResponse);
      })
    );
  }

  /**
   * 🔥 Valida token de reset
   */
  validateToken(token: string): Observable<{ valid: boolean; message: string; userId?: string | number }> {
    console.log(`🔍 Validando token: ${token}`);

    return this.http.get<PasswordResetToken[]>(`${this.resetTokensUrl}?token=${token}`).pipe(
      map((tokens) => {
        if (tokens.length === 0) {
          return { valid: false, message: 'Token inválido ou expirado.' };
        }

        const tokenData = tokens[0];

        // 🔥 Verificar se o token foi usado
        if (tokenData.used) {
          return { valid: false, message: 'Este token já foi utilizado.' };
        }

        // 🔥 Verificar se o token expirou
        const expiresAt = new Date(tokenData.expiresAt);
        if (expiresAt < new Date()) {
          return { valid: false, message: 'Token expirado. Solicite um novo reset.' };
        }

        return {
          valid: true,
          message: 'Token válido.',
          userId: tokenData.userId
        };
      }),
      catchError((error) => {
        console.error('❌ Erro ao validar token:', error);
        return of({ valid: false, message: 'Erro ao validar token.' });
      })
    );
  }

  /**
   * 🔥 Confirma reset de senha
   */
  confirmReset(data: PasswordResetConfirm): Observable<PasswordResetResponse> {
    console.log(`🔐 Confirmando reset de senha com token: ${data.token}`);

    // 🔥 Buscar o token
    return this.http.get<PasswordResetToken[]>(`${this.resetTokensUrl}?token=${data.token}`).pipe(
      switchMap((tokens) => {
        if (tokens.length === 0) {
          return of({
            success: false,
            message: 'Token inválido.'
          } as PasswordResetResponse);
        }

        const tokenData = tokens[0];

        // 🔥 Verificar se o token é válido
        if (tokenData.used) {
          return of({
            success: false,
            message: 'Este token já foi utilizado.'
          } as PasswordResetResponse);
        }

        const expiresAt = new Date(tokenData.expiresAt);
        if (expiresAt < new Date()) {
          return of({
            success: false,
            message: 'Token expirado. Solicite um novo reset.'
          } as PasswordResetResponse);
        }

        // 🔥 Atualizar a senha do usuário
        return this.http.patch(`${this.apiUrl}/users/${tokenData.userId}`, {
          password: data.newPassword,
          updatedAt: new Date().toISOString()
        }).pipe(
          switchMap(() => {
            // 🔥 Marcar token como usado
            return this.http.patch(`${this.resetTokensUrl}/${tokenData.id}`, {
              used: true
            }).pipe(
              map(() => {
                console.log('✅ Senha atualizada com sucesso!');
                return {
                  success: true,
                  message: 'Senha redefinida com sucesso! Você já pode fazer login com sua nova senha.'
                } as PasswordResetResponse;
              })
            );
          })
        );
      }),
      catchError((error) => {
        console.error('❌ Erro ao confirmar reset:', error);
        return of({
          success: false,
          message: error.message || 'Erro ao redefinir senha. Tente novamente.'
        } as PasswordResetResponse);
      })
    );
  }

  /**
   * 🔥 Gera token aleatório
   */
  private generateToken(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < 32; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
  }
}
