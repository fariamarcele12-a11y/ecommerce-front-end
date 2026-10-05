// src/app/core/services/auth.service.ts
import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, of, catchError, map } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';
import { User, LoginCredentials, RegisterCredentials, AuthResponse } from '../models/user.model';
import { environment } from '../../../environments/enviroment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private authUrl = `${environment.apiUrl}/auth`;
  private usersUrl = `${environment.apiUrl}/users`;

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

  // ============================================================
  // LOGIN
  // ============================================================
  login(credentials: LoginCredentials): Observable<AuthResponse> {
    const payload = {
      email: credentials.email,
      password: credentials.password,
      rememberMe: credentials.rememberMe ?? false
    };

    return this.http.post<AuthResponse>(`${this.authUrl}/login`, payload).pipe(
      map((response) => {
        if (!response.success || !response.user) {
          return response;
        }

        const userToStore: User = {
          ...response.user,
          hasStore: response.user.hasStore ?? false,
          storeId: response.user.storeId ?? null,
          token: response.token ?? null
        };

        if (this.isBrowser) {
          localStorage.setItem('currentUser', JSON.stringify(userToStore));
          localStorage.setItem('userBackup', JSON.stringify(userToStore));

          if (response.token) {
            localStorage.setItem('accessToken', response.token);
          }

          if (credentials.rememberMe) {
            localStorage.setItem('rememberMe', 'true');
          } else {
            localStorage.removeItem('rememberMe');
          }
        }

        this.currentUserSubject.next(userToStore);

        return {
          success: true,
          message: response.message || 'Login realizado com sucesso!',
          user: userToStore,
          token: response.token,
          expiresIn: response.expiresIn ?? (credentials.rememberMe ? 604800 : 86400)
        };
      }),
      catchError((error) => {
        console.error('❌ Erro no login:', error);
        const message =
          error?.error?.message ||
          (error?.status === 401 ? 'Email ou senha inválidos.' : 'Erro ao realizar login.');
        return of({ success: false, message });
      })
    );
  }

  // ============================================================
  // REGISTER
  // ============================================================
  register(credentials: RegisterCredentials): Observable<AuthResponse> {
    const payload = {
      documentType: credentials.documentType,
      name: credentials.name,
      email: credentials.email,
      password: credentials.password,
      confirmPassword: credentials.confirmPassword ?? credentials.password,
      document: credentials.document,
      phone: credentials.phone,
      birthDate: credentials.birthDate ?? null,
      companyName: credentials.companyName ?? null,
      tradeName: credentials.tradeName ?? null,
      termsAccepted: credentials.termsAccepted ?? true,
      address: credentials.address
        ? {
            street: credentials.address.street ?? '',
            number: credentials.address.number ?? '',
            complement: credentials.address.complement ?? null,
            neighborhood: credentials.address.neighborhood ?? '',
            city: credentials.address.city ?? '',
            state: credentials.address.state ?? '',
            cep: credentials.address.cep ?? '',
            country: credentials.address.country ?? 'Brasil'
          }
        : null
    };

    return this.http.post<AuthResponse>(`${this.authUrl}/register`, payload).pipe(
      map((response) => {
        if (!response.success || !response.user) {
          return response;
        }

        const userToStore: User = {
          ...response.user,
          hasStore: response.user.hasStore ?? false,
          storeId: response.user.storeId ?? null,
          token: response.token ?? null
        };

        if (this.isBrowser) {
          localStorage.setItem('currentUser', JSON.stringify(userToStore));
          localStorage.setItem('userBackup', JSON.stringify(userToStore));

          if (response.token) {
            localStorage.setItem('accessToken', response.token);
          }
        }

        this.currentUserSubject.next(userToStore);

        return {
          success: true,
          message: response.message || 'Cadastro realizado com sucesso!',
          user: userToStore,
          token: response.token,
          expiresIn: response.expiresIn ?? 86400
        };
      }),
      catchError((error) => {
        console.error('❌ Erro no registro:', error);
        const message = error?.error?.message || 'Erro ao realizar cadastro.';
        return of({ success: false, message });
      })
    );
  }

  // ============================================================
  // LOGOUT
  // ============================================================
  logout(): void {
    if (this.isBrowser) {
      localStorage.removeItem('currentUser');
      localStorage.removeItem('currentStore');
      localStorage.removeItem('rememberMe');
      localStorage.removeItem('accessToken');
      // 🔥 NÃO remover userBackup (preserva para próxima sessão)
    }

    this.currentUserSubject.next(null);
  }

  isLoggedIn(): boolean {
    return this.currentUserSubject.value !== null;
  }

  /**
   * 🔥 Retorna o usuário atual de forma síncrona
   */
  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  getToken(): string | null {
    if (!this.isBrowser) return null;
    return localStorage.getItem('accessToken');
  }

  private loadUserFromStorage(): void {
    if (!this.isBrowser) return;

    try {
      const userData = localStorage.getItem('currentUser');
      if (userData) {
        const user = JSON.parse(userData);
        if (user?.id) {
          if (user.hasStore === undefined) user.hasStore = false;
          if (user.storeId === undefined) user.storeId = null;

          this.currentUserSubject.next(user);
          return;
        }
      }

      const backupData = localStorage.getItem('userBackup');
      if (backupData) {
        const backupUser = JSON.parse(backupData);
        if (backupUser?.id) {
          localStorage.setItem('currentUser', JSON.stringify(backupUser));
          this.currentUserSubject.next(backupUser);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar usuário:', error);
    }
  }

  // ============================================================
  // ATUALIZAR USUÁRIO
  // ============================================================
  updateUser(userData: Partial<User>): Observable<AuthResponse> {
    const currentUser = this.currentUserSubject.value;
    if (!currentUser) {
      return of({ success: false, message: 'Usuário não está logado.' });
    }

    return this.http.patch<User>(`${this.usersUrl}/${currentUser.id}`, userData, {
      headers: this.authHeaders()
    }).pipe(
      map((updatedUser) => {
        // 🔥 backend sempre retorna o UserResponse completo → substitui tudo
        const mergedUser: User = {
          ...currentUser,
          ...updatedUser,
          id: updatedUser.id || currentUser.id,
          token: currentUser.token,
        };

        if (this.isBrowser) {
          localStorage.setItem('currentUser', JSON.stringify(mergedUser));
          localStorage.setItem('userBackup', JSON.stringify(mergedUser));
        }

        this.currentUserSubject.next(mergedUser);

        return {
          success: true,
          message: 'Dados atualizados com sucesso!',
          user: mergedUser
        };
      }),
      catchError((error) => {
        console.error('❌ Erro ao atualizar:', error);
        const message = error?.error?.message || 'Erro ao atualizar dados.';
        return of({ success: false, message });
      })
    );
  }

  syncUser(user: User): void {
    if (this.isBrowser) {
      localStorage.setItem('currentUser', JSON.stringify(user));
      localStorage.setItem('userBackup', JSON.stringify(user));
    }
    this.currentUserSubject.next(user);
  }

  forceUpdateUser(user: Partial<User>): void {
    const currentUser = this.currentUserSubject.value;

    // 🔥 MESCLAR com o usuário atual (NUNCA substituir)
    const mergedUser: User = {
      ...(currentUser || {}),
      ...user,
      id: user.id || currentUser?.id || '',
      name: user.name || currentUser?.name || '',
      email: user.email || currentUser?.email || '',
      document: user.document !== undefined ? user.document : currentUser?.document,
      documentType: user.documentType || currentUser?.documentType,
      phone: user.phone !== undefined ? user.phone : currentUser?.phone,
      avatar: user.avatar !== undefined ? user.avatar : currentUser?.avatar,
      address: user.address !== undefined ? user.address : currentUser?.address,
      addresses: user.addresses !== undefined ? user.addresses : currentUser?.addresses,
      hasStore: user.hasStore !== undefined ? user.hasStore : (currentUser?.hasStore || false),
      storeId: user.storeId !== undefined
        ? (user.storeId ? String(user.storeId) : null)
        : (currentUser?.storeId || null),
      birthDate: user.birthDate !== undefined ? user.birthDate : currentUser?.birthDate,
      companyName: user.companyName !== undefined ? user.companyName : currentUser?.companyName,
      tradeName: user.tradeName !== undefined ? user.tradeName : currentUser?.tradeName,
      createdAt: user.createdAt || currentUser?.createdAt,
      updatedAt: user.updatedAt || currentUser?.updatedAt,
      token: currentUser?.token ?? null,
    } as User;

    if (this.isBrowser) {
      localStorage.setItem('currentUser', JSON.stringify(mergedUser));
      localStorage.setItem('userBackup', JSON.stringify(mergedUser));
    }
    this.currentUserSubject.next(mergedUser);
  }

  // ============================================================
  // GET USER BY ID — sempre do backend (dados frescos)
  // ============================================================
  getUserById(id: string | number): Observable<User | null> {
    const userId = String(id);
    return this.http.get<User>(`${this.usersUrl}/${userId}`, {
      headers: this.authHeaders()
    }).pipe(
      map((user) => {
        if (!user) return null;

        // Se for o usuário atual, sincroniza o estado local
        const current = this.currentUserSubject.value;
        if (current && String(current.id) === userId) {
          const merged: User = { ...current, ...user, token: current.token };
          if (this.isBrowser) {
            localStorage.setItem('currentUser', JSON.stringify(merged));
            localStorage.setItem('userBackup', JSON.stringify(merged));
          }
          this.currentUserSubject.next(merged);
          return merged;
        }

        return user;
      }),
      catchError((error) => {
        console.error(`❌ Erro ao buscar usuário ${userId}:`, error);
        return of(null);
      })
    );
  }

  // ============================================================
  // CHECK EMAIL
  // ============================================================
  checkEmailExists(email: string): Observable<boolean> {
    // Backend valida email duplicado no /register.
    return of(false);
  }

  // ============================================================
  // GET ALL USERS
  // ============================================================
  getAllUsers(): Observable<User[]> {
    return this.http.get<User[]>(this.usersUrl, {
      headers: this.authHeaders()
    }).pipe(
      catchError(() => of([]))
    );
  }

  // ============================================================
  // HEALTH CHECK
  // ============================================================
  checkApiHealth(): Observable<{ status: string; timestamp: string }> {
    return this.http.get(`${environment.apiUrl.replace('/api', '')}/swagger/index.html`).pipe(
      map(() => ({ status: 'online', timestamp: new Date().toISOString() })),
      catchError(() => of({ status: 'offline', timestamp: new Date().toISOString() }))
    );
  }

  // ============================================================
  // HEADERS
  // ============================================================
  private authHeaders(): HttpHeaders {
    const token = this.getToken();
    return new HttpHeaders({
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    });
  }
}
