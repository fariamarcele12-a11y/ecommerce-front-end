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
  // private apiUrl = 'https://ecommerce-api-mf.vercel.app/users'; // Produção

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

        if (this.isBrowser) {
          localStorage.setItem('currentUser', JSON.stringify(userWithoutPassword));
        }

        this.currentUserSubject.next(userWithoutPassword as User);

        return {
          success: true,
          message: 'Login realizado com sucesso!',
          user: userWithoutPassword as User,
          token: 'fake-jwt-token-' + Date.now()
        };
      }),
      catchError((error) => {
        console.error('❌ Erro no login:', error);
        return of({ success: false, message: 'Erro ao realizar login. Tente novamente.' });
      })
    );
  }

  register(credentials: RegisterCredentials): Observable<AuthResponse> {
    // 🔥 Verificar se email já existe
    return this.http.get<User[]>(`${this.apiUrl}?email=${credentials.email}`).pipe(
      switchMap((users) => {
        if (users.length > 0) {
          return of({ success: false, message: 'Este email já está cadastrado.' });
        }

        // 🔥 Verificar se documento (CPF/CNPJ) já existe - buscando todos os usuários
        return this.http.get<User[]>(this.apiUrl).pipe(
          switchMap((allUsers) => {
            // 🔥 Verificar se o documento já existe na lista de usuários
            const docExists = allUsers.some(user => user.document === credentials.document);
            
            if (docExists) {
              return of({
                success: false,
                message: credentials.documentType === 'pf'
                  ? 'Este CPF já está cadastrado.'
                  : 'Este CNPJ já está cadastrado.'
              });
            }

            // 🔥 Removido o campo 'type' - todos são compradores e vendedores
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

  logout(): void {
    if (this.isBrowser) {
      localStorage.removeItem('currentUser');
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
        this.currentUserSubject.next(user);
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

    return this.http.patch<User>(`${this.apiUrl}/${currentUser.id}`, userData).pipe(
      map((updatedUser) => {
        const { password, ...userWithoutPassword } = updatedUser;

        if (this.isBrowser) {
          localStorage.setItem('currentUser', JSON.stringify(userWithoutPassword));
        }

        this.currentUserSubject.next(userWithoutPassword as User);

        return {
          success: true,
          message: 'Dados atualizados com sucesso!',
          user: userWithoutPassword as User
        };
      }),
      catchError((error) => {
        console.error('❌ Erro ao atualizar usuário:', error);
        return of({ success: false, message: 'Erro ao atualizar dados.' });
      })
    );
  }
}