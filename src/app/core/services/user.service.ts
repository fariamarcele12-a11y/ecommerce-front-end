// src/app/core/services/user.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, catchError, map } from 'rxjs';
import { User } from '../models/user.model';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private apiUrl = 'http://localhost:3000/users';

  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);

  /**
   * 🔥 Busca um usuário pelo ID
   */
  getUserById(id: string | number): Observable<User | null> {
    const userId = String(id);

    // 🔥 Se for o usuário atual, retorna do cache
    const currentUser = this.authService.getCurrentUser();
    if (currentUser && String(currentUser.id) === userId) {
      return of(currentUser);
    }

    return this.http.get<User>(`${this.apiUrl}/${userId}`).pipe(
      map((user) => {
        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword as User;
      }),
      catchError((error) => {
        console.error(`❌ Erro ao buscar usuário ${userId}:`, error);
        return of(null);
      })
    );
  }

  /**
   * 🔥 Atualiza usuário (PATCH - preserva dados não enviados)
   */
  updateUser(id: string | number, data: Partial<User>): Observable<User> {
    const userId = String(id);
    console.log('📝 UserService.updateUser:', userId, data);

    return this.http.patch<User>(`${this.apiUrl}/${userId}`, {
      ...data,
      updatedAt: new Date().toISOString()
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

  /**
   * 🔥 Busca a data de cadastro formatada
   */
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
    return this.http.get<User[]>(this.apiUrl).pipe(
      catchError(() => of([]))
    );
  }

  searchUsers(term: string): Observable<User[]> {
    return this.http.get<User[]>(`${this.apiUrl}?q=${term}`).pipe(
      catchError(() => of([]))
    );
  }
}
