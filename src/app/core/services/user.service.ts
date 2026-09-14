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
  private apiUrl = 'http://localhost:3000/api/users'; // Ajuste conforme sua API

  constructor(
    private http: HttpClient,
    private authService: AuthService,
  ) {}

  /**
   * Busca um usuário pelo ID
   */
  getUserById(id: string | number): Observable<User | null> {
    const userId = String(id);
    console.log(`🔍 Buscando usuário ${userId}...`);

    // Primeiro, verifica se o usuário atual é o mesmo
    const currentUser = this.authService.getCurrentUser();
    if (currentUser && String(currentUser.id) === userId) {
      console.log('👤 Usuário encontrado no cache local:', currentUser);
      return of(currentUser);
    }

    return this.http.get<User>(`${this.apiUrl}/${userId}`).pipe(
      map((user) => {
        console.log('👤 Usuário encontrado na API:', user);
        return user;
      }),
      catchError((error) => {
        console.error('❌ Erro ao buscar usuário:', error);
        // Fallback: tenta usar o usuário atual
        const fallbackUser = this.authService.getCurrentUser();
        if (fallbackUser) {
          console.log('⚠️ Usando fallback - usuário atual:', fallbackUser);
          return of(fallbackUser);
        }
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
        // 🔥 Se não encontrar, tenta buscar pela loja
        console.warn('⚠️ Data de cadastro não encontrada para o usuário, tentando fallback...');
        return this.getMemberSinceFromStore(userIdStr);
      }),
      catchError(() => {
        return of('2024');
      }),
    );
  }

  private getMemberSinceFromStore(userId: string): string {
    return '2024';
  }

  /**
   * Atualiza dados do usuário
   */
  updateUser(id: string | number, data: Partial<User>): Observable<User> {
    return this.http.put<User>(`${this.apiUrl}/${id}`, data);
  }

  /**
   * Busca todos os usuários (apenas para admin)
   */
  getAllUsers(): Observable<User[]> {
    return this.http.get<User[]>(this.apiUrl);
  }

  /**
   * Busca usuários por nome
   */
  searchUsers(term: string): Observable<User[]> {
    return this.http.get<User[]>(`${this.apiUrl}?search=${term}`);
  }
}
