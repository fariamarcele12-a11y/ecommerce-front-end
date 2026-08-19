export interface User {
  id: number;
  name: string;
  email: string;
  password?: string;
  documentType: 'pf' | 'pj';
  document: string;
  phone: string;
  address: {
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
    state: string;
    cep: string;
    country: string;
  };
  createdAt: Date;
  updatedAt?: Date;
  companyName?: string;
  tradeName?: string;
  birthDate?: string;
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
  confirmPassword: string;
  document: string;
  phone: string;
  companyName?: string;
  tradeName?: string;
  birthDate?: string;
  address: {
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
    state: string;
    cep: string;
    country: string;
  };
}

export interface AuthResponse {
  success: boolean;
  message: string;
  user?: User;
  token?: string;
}
