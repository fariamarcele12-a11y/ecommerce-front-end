// src/app/core/models/user.model.ts

export interface UserAddress {
  id?: string;
  label?: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  cep: string;
  country: string;
  isDefault?: boolean;
  createdAt?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  avatar?: string;

  /** Documento MASCARADO para LGPD. Ex: 123.***.***-10 */
  document?: string;

  documentType?: 'pf' | 'pj';
  phone?: string;

  /** Endereço principal (compatibilidade) */
  address?: UserAddress;

  /** Lista completa de endereços */
  addresses?: UserAddress[];

  hasStore?: boolean;
  storeId?: string | null;
  companyName?: string;
  tradeName?: string;
  birthDate?: string;
  createdAt?: string;
  updatedAt?: string;

  /** Token JWT — usado apenas no client para chamadas autenticadas */
  token?: string | null;
}

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterCredentials {
  documentType: 'pf' | 'pj';
  name: string;
  email: string;
  password: string;
  confirmPassword?: string;
  document: string;
  phone: string;
  address?: UserAddress;
  companyName?: string;
  tradeName?: string;
  birthDate?: string;
  termsAccepted?: boolean;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  user?: User;
  token?: string;
  expiresIn?: number;
}
