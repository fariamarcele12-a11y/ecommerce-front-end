// src/app/core/services/user.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of, catchError, map } from 'rxjs';
import { User } from '../models/user.model';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/enviroment';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private apiUrl = `${environment.apiUrl}/users`;

  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);

  // 🔥 SEMPRE vai ao backend
  getUserById(id: string | number): Observable<User | null> {
    const userId = String(id);

    return this.http.get<User>(`${this.apiUrl}/${userId}`, {
      headers: this.authHeaders()
    }).pipe(
      catchError((error) => {
        console.error(`❌ Erro ao buscar usuário ${userId}:`, error);
        return of(null);
      })
    );
  }

  updateUser(id: string | number, data: Partial<User>): Observable<User> {
    const userId = String(id);
    console.log('📝 UserService.updateUser:', userId, data);

    return this.http.patch<User>(`${this.apiUrl}/${userId}`, data, {
      headers: this.authHeaders()
    }).pipe(
      map((user) => {
        console.log('✅ Resposta da API:', user);
        return user;
      }),
      catchError((error) => {
        console.error('❌ Erro ao atualizar usuário:', error);
        throw error;
      })
    );
  }

  // ============================================================
  // 🔥 UPLOAD DE AVATAR — envia base64 ao backend, que manda ao Cloudinary
  // ============================================================
  uploadAvatar(base64Image: string): Observable<{ avatarUrl: string }> {
    return this.http.post<{ avatarUrl: string }>(
      `${this.apiUrl}/avatar`,
      { base64Image },
      { headers: this.authHeaders() }
    ).pipe(
      catchError((error) => {
        console.error('❌ Erro ao enviar avatar:', error);
        throw error;
      })
    );
  }

  // ============================================================
  // 🔥 REMOVER AVATAR
  // ============================================================
  deleteAvatar(): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(
      `${this.apiUrl}/avatar`,
      { headers: this.authHeaders() }
    ).pipe(
      catchError((error) => {
        console.error('❌ Erro ao remover avatar:', error);
        throw error;
      })
    );
  }

  getMemberSince(userId: string | number): Observable<string> {
    return this.getUserById(userId).pipe(
      map((user) => {
        if (user?.createdAt) {
          const date = new Date(user.createdAt);
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const year = date.getFullYear();
          return `${month}/${year}`;
        }
        return '2024';
      }),
      catchError(() => of('2024'))
    );
  }

  getAllUsers(): Observable<User[]> {
    return this.http.get<User[]>(this.apiUrl, {
      headers: this.authHeaders()
    }).pipe(
      catchError(() => of([]))
    );
  }

  searchUsers(term: string): Observable<User[]> {
    return of([]);
  }

  private authHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return new HttpHeaders({
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    });
  }
}
