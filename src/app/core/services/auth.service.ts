// src/app/core/services/auth.service.ts
import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of, throwError, catchError, tap, map, switchMap } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';
import { User, LoginCredentials, RegisterCredentials, AuthResponse } from '../models/user.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  // 🔥 Usar localhost para desenvolvimento
  private apiUrl = 'http://localhost:3000/users';

  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  private isBrowser: boolean;
  private readonly http = inject(HttpClient);

  constructor() {
    const platformId = inject(PLATFORM_ID);
    this.isBrowser = isPlatformBrowser(platformId);

    if (this.isBrowser) {
      this.loadUserFromStorage();
    }
  }

  /**
   * 🔥 Login do usuário
   */
  login(credentials: LoginCredentials): Observable<AuthResponse> {
    return this.http.get<User[]>(`${this.apiUrl}?email=${credentials.email}`).pipe(
      map((users) => {
        if (users.length === 0) {
          return { success: false, message: 'Usuário não encontrado.' };
        }

        const user = users[0];
        if (user.password !== credentials.password) {
          return { success: false, message: 'Senha incorreta.' };
        }

        const { password, ...userWithoutPassword } = user;

        // 🔥 Garantir que hasStore e storeId existam
        const userToStore = {
          ...userWithoutPassword,
          hasStore: userWithoutPassword.hasStore || false,
          storeId: userWithoutPassword.storeId || null
        };

        if (this.isBrowser) {
          localStorage.setItem('currentUser', JSON.stringify(userToStore));
        }

        this.currentUserSubject.next(userToStore as User);

        return {
          success: true,
          message: 'Login realizado com sucesso!',
          user: userToStore as User,
          token: 'fake-jwt-token-' + Date.now()
        };
      }),
      catchError((error) => {
        console.error('❌ Erro no login:', error);
        return of({ success: false, message: 'Erro ao realizar login. Tente novamente.' });
      })
    );
  }

  /**
   * 🔥 Registro do usuário
   */
  register(credentials: RegisterCredentials): Observable<AuthResponse> {
    return this.http.get<User[]>(`${this.apiUrl}?email=${credentials.email}`).pipe(
      switchMap((users) => {
        if (users.length > 0) {
          return of({ success: false, message: 'Este email já está cadastrado.' });
        }

        return this.http.get<User[]>(this.apiUrl).pipe(
          switchMap((allUsers) => {
            const docExists = allUsers.some(user => user.document === credentials.document);

            if (docExists) {
              return of({
                success: false,
                message: credentials.documentType === 'pf'
                  ? 'Este CPF já está cadastrado.'
                  : 'Este CNPJ já está cadastrado.'
              });
            }

            const newUser: any = {
              documentType: credentials.documentType,
              name: credentials.name,
              email: credentials.email,
              password: credentials.password,
              document: credentials.document,
              phone: credentials.phone,
              address: credentials.address || {
                street: '',
                number: '',
                neighborhood: '',
                city: '',
                state: '',
                cep: '',
                country: 'Brasil'
              },
              hasStore: false,
              storeId: null,
              createdAt: new Date().toISOString()
            };

            if (credentials.documentType === 'pj') {
              newUser.companyName = credentials.companyName;
              newUser.tradeName = credentials.tradeName;
            } else {
              newUser.birthDate = credentials.birthDate;
            }

            return this.http.post<User>(this.apiUrl, newUser).pipe(
              map((createdUser) => {
                const { password, ...userWithoutPassword } = createdUser;

                if (this.isBrowser) {
                  localStorage.setItem('currentUser', JSON.stringify(userWithoutPassword));
                }

                this.currentUserSubject.next(userWithoutPassword as User);

                return {
                  success: true,
                  message: 'Cadastro realizado com sucesso!',
                  user: userWithoutPassword as User,
                  token: 'fake-jwt-token-' + Date.now()
                };
              })
            );
          })
        );
      }),
      catchError((error) => {
        console.error('❌ Erro no registro:', error);
        return of({ success: false, message: 'Erro ao realizar cadastro. Tente novamente.' });
      })
    );
  }

  /**
   * 🔥 Logout do usuário
   */
  logout(): void {
    if (this.isBrowser) {
      localStorage.removeItem('currentUser');
      localStorage.removeItem('currentStore');
    }
    this.currentUserSubject.next(null);
  }

  /**
   * 🔥 Verifica se o usuário está logado
   */
  isLoggedIn(): boolean {
    return this.currentUserSubject.value !== null;
  }

  /**
   * 🔥 Retorna o usuário atual
   */
  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  /**
   * 🔥 Carrega usuário do localStorage - VERSÃO CORRIGIDA
   */
  private loadUserFromStorage(): void {
    if (!this.isBrowser) return;

    try {
      const userData = localStorage.getItem('currentUser');
      if (userData) {
        const user = JSON.parse(userData);

        // 🔥 Garantir que hasStore e storeId existam
        if (user.hasStore === undefined) {
          user.hasStore = false;
        }
        if (user.storeId === undefined) {
          user.storeId = null;
        }

        console.log('📦 Usuário carregado do localStorage:', user);
        console.log('📦 hasStore:', user.hasStore);
        console.log('📦 storeId:', user.storeId);

        this.currentUserSubject.next(user);
      }
    } catch (error) {
      console.error('Erro ao carregar usuário:', error);
    }
  }

  /**
   * 🔥 ATUALIZA O USUÁRIO
   */
  updateUser(userData: Partial<User>): Observable<AuthResponse> {
    const currentUser = this.currentUserSubject.value;
    if (!currentUser) {
      console.error('❌ Usuário não está logado para atualizar');
      return of({ success: false, message: 'Usuário não está logado.' });
    }

    console.log('🔄 Atualizando usuário com dados:', userData);
    console.log('👤 Usuário atual antes da atualização:', currentUser);

    return this.http.patch<User>(`${this.apiUrl}/${currentUser.id}`, userData).pipe(
      map((updatedUser) => {
        console.log('✅ Usuário atualizado na API:', updatedUser);

        // 🔥 Garantir que hasStore e storeId sejam preservados
        const mergedUser = {
          ...updatedUser,
          hasStore: userData.hasStore !== undefined ? userData.hasStore : (updatedUser.hasStore || false),
          storeId: userData.storeId !== undefined ? userData.storeId : (updatedUser.storeId || null)
        };

        console.log('📦 Usuário mesclado:', mergedUser);

        const { password, ...userWithoutPassword } = mergedUser;

        if (this.isBrowser) {
          localStorage.setItem('currentUser', JSON.stringify(userWithoutPassword));
        }

        this.currentUserSubject.next(userWithoutPassword as User);
        console.log('✅ Usuário atualizado no Subject:', userWithoutPassword);

        return {
          success: true,
          message: 'Dados atualizados com sucesso!',
          user: userWithoutPassword as User
        };
      }),
      catchError((error) => {
        console.error('❌ Erro ao atualizar usuário:', error);

        // 🔥 Fallback: mesmo se falhar na API, atualizar localmente
        const fallbackUser = {
          ...currentUser,
          ...userData,
          hasStore: userData.hasStore !== undefined ? userData.hasStore : (currentUser.hasStore || false),
          storeId: userData.storeId !== undefined ? userData.storeId : (currentUser.storeId || null)
        };

        console.log('🔄 Fallback: atualizando localmente:', fallbackUser);

        if (this.isBrowser) {
          localStorage.setItem('currentUser', JSON.stringify(fallbackUser));
        }
        this.currentUserSubject.next(fallbackUser);

        return of({
          success: true,
          message: 'Dados atualizados localmente (fallback)!',
          user: fallbackUser
        });
      })
    );
  }

  /**
   * 🔥 Sincroniza o usuário localmente
   */
  syncUser(user: User): void {
    console.log('🔄 Sincronizando usuário localmente:', user);
    if (this.isBrowser) {
      localStorage.setItem('currentUser', JSON.stringify(user));
    }
    this.currentUserSubject.next(user);
  }

  /**
   * 🔥 Força a atualização do usuário no localStorage - VERSÃO CORRIGIDA
   */
  forceUpdateUser(user: User): void {
    console.log('🔄 Forçando atualização do usuário:', user);

    // 🔥 Garantir que storeId seja string ou null
    const normalizedUser = {
      ...user,
      storeId: user.storeId ? String(user.storeId) : null
    };

    if (this.isBrowser) {
      localStorage.setItem('currentUser', JSON.stringify(normalizedUser));
    }
    this.currentUserSubject.next(normalizedUser);
  }
}
