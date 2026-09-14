// src/app/core/services/user.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { User } from '../models/user.model';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root',
})
export class UserService {
  // 🔥 CORRIGIDO: URL sem /api
  private apiUrl = 'http://localhost:3000/users';

  constructor(
    private http: HttpClient,
    private authService: AuthService,
  ) {}

  /**
   * 🔥 Busca um usuário pelo ID (SEMPRE da API para dados atualizados)
   */
  getUserById(id: string | number): Observable<User | null> {
    const userId = String(id);
    console.log(`🔍 Buscando usuário ${userId}...`);

    // 🔥 Se for o usuário atual, retornar dados do cache local
    const currentUser = this.authService.getCurrentUser();
    if (currentUser && String(currentUser.id) === userId) {
      console.log('👤 Usuário atual (cache):', currentUser.name);
      console.log('📸 Avatar:', (currentUser as any).avatar || 'SEM AVATAR');
      return of(currentUser);
    }

    // 🔥 Buscar da API
    return this.http.get<User>(`${this.apiUrl}/${userId}`).pipe(
      map((user) => {
        console.log('👤 Usuário encontrado na API:', user.name);
        console.log('📸 Avatar:', (user as any).avatar || 'SEM AVATAR');
        return user;
      }),
      catchError((error) => {
        console.error(`❌ Erro ao buscar usuário ${userId}:`, error);
        return of(null);
      }),
    );
  }

  /**
   * 🔥 Busca a data de cadastro formatada de um usuário
   */
  getMemberSince(userId: string | number): Observable<string> {
    const userIdStr = String(userId);
    console.log(`📅 Buscando data de cadastro do usuário ${userIdStr}...`);

    return this.getUserById(userIdStr).pipe(
      map((user) => {
        if (user?.createdAt) {
          const date = new Date(user.createdAt);
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const year = date.getFullYear();
          return `${month}/${year}`;
        }
        console.warn('⚠️ Data de cadastro não encontrada');
        return '2024';
      }),
      catchError(() => {
        return of('2024');
      }),
    );
  }

  /**
   * 🔥 Atualiza dados do usuário
   */
  updateUser(id: string | number, data: Partial<User>): Observable<User> {
    const userId = String(id);
    return this.http.put<User>(`${this.apiUrl}/${userId}`, data).pipe(
      catchError((error) => {
        console.error('❌ Erro ao atualizar usuário:', error);
        throw error;
      })
    );
  }

  /**
   * 🔥 Busca todos os usuários
   */
  getAllUsers(): Observable<User[]> {
    return this.http.get<User[]>(this.apiUrl).pipe(
      catchError((error) => {
        console.error('❌ Erro ao buscar usuários:', error);
        return of([]);
      })
    );
  }

  /**
   * 🔥 Busca usuários por nome
   */
  searchUsers(term: string): Observable<User[]> {
    return this.http.get<User[]>(`${this.apiUrl}?q=${term}`).pipe(
      catchError((error) => {
        console.error('❌ Erro ao buscar usuários:', error);
        return of([]);
      })
    );
  }
}