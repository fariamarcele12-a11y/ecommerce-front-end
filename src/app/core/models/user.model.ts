// src/app/core/models/user.model.ts
export interface User {
  id: string | number; // 🔥 Aceitar string ou number (JSON Server usa string)
  name: string;
  email: string;
  password?: string;
  document?: string;
  documentType?: 'pf' | 'pj';
  phone?: string;
  address?: {
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
    state: string;
    cep: string;
    country: string;
  };
  hasStore?: boolean;
  storeId?: string | number | null; // 🔥 Aceitar string, number ou null
  companyName?: string;
  tradeName?: string;
  birthDate?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  documentType: 'pf' | 'pj';
  name: string;
  email: string;
  password: string;
  confirmPassword?: string;
  document: string;
  phone: string;
  address?: {
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
    state: string;
    cep: string;
    country: string;
  };
  companyName?: string;
  tradeName?: string;
  birthDate?: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  user?: User;
  token?: string;
}
