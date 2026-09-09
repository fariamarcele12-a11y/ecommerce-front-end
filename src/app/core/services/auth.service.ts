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
  // 🔥 Usar localhost para desenvolvimento
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

  /**
   * 🔥 Login do usuário
   */
  login(credentials: LoginCredentials): Observable<AuthResponse> {
    console.log('🔑 Tentando login...');
    console.log('📧 Email:', credentials.email);

    return this.http.get<User[]>(`${this.apiUrl}?email=${credentials.email}`).pipe(
      map((users) => {
        if (users.length === 0) {
          console.warn('⚠️ Usuário não encontrado:', credentials.email);
          return { success: false, message: 'Usuário não encontrado.' };
        }

        const user = users[0];
        console.log('👤 Usuário encontrado:', user.id);

        if (user.password !== credentials.password) {
          console.warn('⚠️ Senha incorreta para:', credentials.email);
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
          if (credentials.rememberMe) {
            localStorage.setItem('rememberMe', 'true');
          }
        }

        this.currentUserSubject.next(userToStore as User);

        console.log('✅ Login realizado com sucesso!');
        console.log('👤 ID do usuário:', user.id);

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
        return of({ success: false, message: 'Erro ao realizar login. Tente novamente.' });
      })
    );
  }

  /**
   * 🔥 Registro do usuário com ID ÚNICO
   */
  register(credentials: RegisterCredentials): Observable<AuthResponse> {
    console.log('📝 Registrando novo usuário...');
    console.log('📧 Email:', credentials.email);

    // 🔥 Gerar ID único para o usuário
    const userId = this.idGenerator.generateUUID();
    console.log('🔑 ID único gerado:', userId);

    return this.http.get<User[]>(`${this.apiUrl}?email=${credentials.email}`).pipe(
      switchMap((users) => {
        if (users.length > 0) {
          console.warn('⚠️ Email já cadastrado:', credentials.email);
          return of({ success: false, message: 'Este email já está cadastrado.' });
        }

        return this.http.get<User[]>(this.apiUrl).pipe(
          switchMap((allUsers) => {
            const docExists = allUsers.some(user => user.document === credentials.document);

            if (docExists) {
              console.warn('⚠️ Documento já cadastrado:', credentials.document);
              return of({
                success: false,
                message: credentials.documentType === 'pf'
                  ? 'Este CPF já está cadastrado.'
                  : 'Este CNPJ já está cadastrado.'
              });
            }

            // 🔥 Criar novo usuário com ID único
            const newUser: any = {
              id: userId, // 🔥 ID único gerado
              documentType: credentials.documentType,
              name: credentials.name,
              email: credentials.email,
              password: credentials.password,
              document: credentials.document,
              phone: credentials.phone,
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

            console.log('📤 Enviando usuário para API:', { ...newUser, password: '***' });

            return this.http.post<User>(this.apiUrl, newUser).pipe(
              map((createdUser) => {
                console.log('✅ Usuário criado com sucesso:', createdUser.id);
                console.log('🔑 ID do usuário:', createdUser.id);

                const { password, ...userWithoutPassword } = createdUser;

                if (this.isBrowser) {
                  localStorage.setItem('currentUser', JSON.stringify(userWithoutPassword));
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
        return of({ success: false, message: 'Erro ao realizar cadastro. Tente novamente.' });
      })
    );
  }

  /**
   * 🔥 Logout do usuário
   */
  logout(): void {
    console.log('👋 Realizando logout...');

    if (this.isBrowser) {
      localStorage.removeItem('currentUser');
      localStorage.removeItem('currentStore');
      localStorage.removeItem('rememberMe');
    }

    this.currentUserSubject.next(null);
    console.log('✅ Logout realizado com sucesso!');
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
   * 🔥 Carrega usuário do localStorage
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
        console.log('📦 ID do usuário:', user.id);
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
    console.log('🔑 ID do usuário:', currentUser.id);

    return this.http.patch<User>(`${this.apiUrl}/${currentUser.id}`, {
      ...userData,
      updatedAt: new Date().toISOString()
    }).pipe(
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
    console.log('🔑 ID do usuário:', user.id);

    if (this.isBrowser) {
      localStorage.setItem('currentUser', JSON.stringify(user));
    }
    this.currentUserSubject.next(user);
  }

  /**
   * 🔥 Força a atualização do usuário no localStorage
   */
  forceUpdateUser(user: User): void {
    console.log('🔄 Forçando atualização do usuário:', user);
    console.log('🔑 ID do usuário:', user.id);

    // 🔥 Garantir que storeId seja string ou null
    const normalizedUser = {
      ...user,
      storeId: user.storeId ? String(user.storeId) : null
    };

    if (this.isBrowser) {
      localStorage.setItem('currentUser', JSON.stringify(normalizedUser));
    }
    this.currentUserSubject.next(normalizedUser);
    console.log('✅ Usuário forçado atualizado!');
  }

  /**
   * 🔥 BUSCA USUÁRIO POR ID
   */
  getUserById(id: string | number): Observable<User | null> {
    const userId = String(id);
    console.log(`🔍 Buscando usuário ${userId}...`);

    return this.http.get<User>(`${this.apiUrl}/${userId}`).pipe(
      map((user) => {
        console.log('👤 Usuário encontrado:', user.id);
        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword as User;
      }),
      catchError((error) => {
        console.error('❌ Erro ao buscar usuário:', error);
        return of(null);
      })
    );
  }

  /**
   * 🔥 VERIFICA SE O EMAIL JÁ EXISTE
   */
  checkEmailExists(email: string): Observable<boolean> {
    return this.http.get<User[]>(`${this.apiUrl}?email=${email}`).pipe(
      map((users) => {
        const exists = users && users.length > 0;
        console.log(`📧 Email ${email} ${exists ? 'já existe' : 'está disponível'}`);
        return exists;
      }),
      catchError(() => of(false))
    );
  }

  /**
   * 🔥 BUSCA USUÁRIOS (apenas admin)
   */
  getAllUsers(): Observable<User[]> {
    return this.http.get<User[]>(this.apiUrl).pipe(
      map((users) => {
        return users.map(({ password, ...user }) => user as User);
      }),
      catchError((error) => {
        console.error('❌ Erro ao buscar usuários:', error);
        return of([]);
      })
    );
  }

  /**
   * 🔥 VERIFICA O STATUS DA API LOCAL
   */
  checkApiHealth(): Observable<{ status: string; timestamp: string }> {
    return this.http.get<{ status: string; timestamp: string }>(`http://localhost:3000/`).pipe(
      map(() => ({
        status: 'online',
        timestamp: new Date().toISOString()
      })),
      catchError((error) => {
        console.error('❌ API local não está respondendo:', error);
        return of({
          status: 'offline',
          timestamp: new Date().toISOString()
        });
      })
    );
  }
}
