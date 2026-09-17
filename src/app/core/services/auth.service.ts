// src/app/core/services/auth.service.ts
import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of, throwError, catchError, tap, map, switchMap } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';
import { User, LoginCredentials, RegisterCredentials, AuthResponse } from '../models/user.model';
import { IdGeneratorService } from './id-generator.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = 'http://localhost:3000/users';

  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  private isBrowser: boolean;
  private readonly http = inject(HttpClient);
  private readonly idGenerator = inject(IdGeneratorService);

  constructor() {
    const platformId = inject(PLATFORM_ID);
    this.isBrowser = isPlatformBrowser(platformId);

    if (this.isBrowser) {
      this.loadUserFromStorage();
    }
  }

  login(credentials: LoginCredentials): Observable<AuthResponse> {
    return this.http.get<User[]>(`${this.apiUrl}?email=${credentials.email}`).pipe(
      map((users) => {
        if (users.length === 0) {
          console.warn('⚠️ Usuário não encontrado');
          return { success: false, message: 'Usuário não encontrado.' };
        }

        const user = users[0];
        if (user.password !== credentials.password) {
          console.warn('⚠️ Senha incorreta');
          return { success: false, message: 'Senha incorreta.' };
        }

        const { password, ...userWithoutPassword } = user;

        const userToStore = {
          ...userWithoutPassword,
          hasStore: userWithoutPassword.hasStore || false,
          storeId: userWithoutPassword.storeId || null
        };

        if (this.isBrowser) {
          localStorage.setItem('currentUser', JSON.stringify(userToStore));
          localStorage.setItem('userBackup', JSON.stringify(userToStore));
        }

        this.currentUserSubject.next(userToStore as User);

        return {
          success: true,
          message: 'Login realizado com sucesso!',
          user: userToStore as User,
          token: `token_${user.id}_${Date.now()}`,
          expiresIn: credentials.rememberMe ? 604800 : 86400
        };
      }),
      catchError((error) => {
        console.error('❌ Erro no login:', error);
        return of({ success: false, message: 'Erro ao realizar login.' });
      })
    );
  }

  register(credentials: RegisterCredentials): Observable<AuthResponse> {
    const userId = this.idGenerator.generateUUID();

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
              id: userId,
              documentType: credentials.documentType,
              name: credentials.name,
              email: credentials.email,
              password: credentials.password,
              document: credentials.document,
              phone: credentials.phone,
              avatar: '',
              address: credentials.address || {
                street: '',
                number: '',
                complement: '',
                neighborhood: '',
                city: '',
                state: '',
                cep: '',
                country: 'Brasil'
              },
              addresses: [],
              hasStore: false,
              storeId: null,
              createdAt: new Date().toISOString()
            };

            if (credentials.documentType === 'pj') {
              newUser.companyName = credentials.companyName || '';
              newUser.tradeName = credentials.tradeName || '';
            } else {
              newUser.birthDate = credentials.birthDate || '';
            }

            return this.http.post<User>(this.apiUrl, newUser).pipe(
              map((createdUser) => {
                const { password, ...userWithoutPassword } = createdUser;

                if (this.isBrowser) {
                  localStorage.setItem('currentUser', JSON.stringify(userWithoutPassword));
                  localStorage.setItem('userBackup', JSON.stringify(userWithoutPassword));
                }

                this.currentUserSubject.next(userWithoutPassword as User);

                return {
                  success: true,
                  message: 'Cadastro realizado com sucesso!',
                  user: userWithoutPassword as User,
                  token: `token_${createdUser.id}_${Date.now()}`,
                  expiresIn: 86400
                };
              })
            );
          })
        );
      }),
      catchError((error) => {
        console.error('❌ Erro no registro:', error);
        return of({ success: false, message: 'Erro ao realizar cadastro.' });
      })
    );
  }

  logout(): void {
    if (this.isBrowser) {
      localStorage.removeItem('currentUser');
      localStorage.removeItem('currentStore');
      localStorage.removeItem('rememberMe');
      // 🔥 NÃO remover userBackup (preserva para próxima sessão)
    }

    this.currentUserSubject.next(null);
  }

  isLoggedIn(): boolean {
    return this.currentUserSubject.value !== null;
  }

  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
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

  updateUser(userData: Partial<User>): Observable<AuthResponse> {
    const currentUser = this.currentUserSubject.value;
    if (!currentUser) {
      return of({ success: false, message: 'Usuário não está logado.' });
    }

    return this.http.patch<User>(`${this.apiUrl}/${currentUser.id}`, {
      ...userData,
      updatedAt: new Date().toISOString()
    }).pipe(
      map((updatedUser) => {
        const mergedUser: User = {
          ...currentUser,
          ...updatedUser,
          id: updatedUser.id || currentUser.id,
          name: updatedUser.name || currentUser.name,
          email: updatedUser.email || currentUser.email,
          document: updatedUser.document || currentUser.document,
          documentType: updatedUser.documentType || currentUser.documentType,
          phone: updatedUser.phone || currentUser.phone,
          avatar: updatedUser.avatar !== undefined ? updatedUser.avatar : currentUser.avatar,
          address: updatedUser.address || currentUser.address,
          addresses: updatedUser.addresses || currentUser.addresses,
          hasStore: updatedUser.hasStore !== undefined ? updatedUser.hasStore : currentUser.hasStore,
          storeId: updatedUser.storeId !== undefined ? updatedUser.storeId : currentUser.storeId,
        };

        const { password, ...userWithoutPassword } = mergedUser;

        if (this.isBrowser) {
          localStorage.setItem('currentUser', JSON.stringify(userWithoutPassword));
          localStorage.setItem('userBackup', JSON.stringify(userWithoutPassword));
        }

        this.currentUserSubject.next(userWithoutPassword as User);

        return {
          success: true,
          message: 'Dados atualizados com sucesso!',
          user: userWithoutPassword as User
        };
      }),
      catchError((error) => {
        console.error('❌ Erro ao atualizar:', error);

        // 🔥 Fallback: mesclar localmente
        const fallbackUser: User = {
          ...currentUser,
          ...userData,
        };

        if (this.isBrowser) {
          localStorage.setItem('currentUser', JSON.stringify(fallbackUser));
          localStorage.setItem('userBackup', JSON.stringify(fallbackUser));
        }
        this.currentUserSubject.next(fallbackUser);

        return of({
          success: true,
          message: 'Dados atualizados localmente!',
          user: fallbackUser
        });
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
    } as User;

    if (this.isBrowser) {
      localStorage.setItem('currentUser', JSON.stringify(mergedUser));
      localStorage.setItem('userBackup', JSON.stringify(mergedUser));
    }
    this.currentUserSubject.next(mergedUser);
  }

  getUserById(id: string | number): Observable<User | null> {
    const userId = String(id);
    return this.http.get<User>(`${this.apiUrl}/${userId}`).pipe(
      map((user) => {
        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword as User;
      }),
      catchError(() => of(null))
    );
  }

  checkEmailExists(email: string): Observable<boolean> {
    return this.http.get<User[]>(`${this.apiUrl}?email=${email}`).pipe(
      map((users) => users && users.length > 0),
      catchError(() => of(false))
    );
  }

  getAllUsers(): Observable<User[]> {
    return this.http.get<User[]>(this.apiUrl).pipe(
      map((users) => users.map(({ password, ...user }) => user as User)),
      catchError(() => of([]))
    );
  }

  checkApiHealth(): Observable<{ status: string; timestamp: string }> {
    return this.http.get<{ status: string; timestamp: string }>(`http://localhost:3000/`).pipe(
      map(() => ({ status: 'online', timestamp: new Date().toISOString() })),
      catchError(() => of({ status: 'offline', timestamp: new Date().toISOString() }))
    );
  }
}
