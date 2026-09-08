// src/app/core/models/store.model.ts
export interface Store {
  id: string; // 🔥 Mudado para string
  userId: string | number; // 🔥 Mudado para string | number
  storeName: string;
  description: string;
  category: string;
  logo: string;
  banner: string;
  cnpj?: string;
  cpf?: string;
  documentType: 'pf' | 'pj';
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
  phone: string;
  email: string;
  website?: string;
  socialMedia?: {
    instagram?: string;
    facebook?: string;
    youtube?: string;
  };
  rating: number;
  totalSales: number;
  active: boolean;
  createdAt: string; // 🔥 Mudado para string
  updatedAt?: string; // 🔥 Mudado para string
}

export interface StoreForm {
  storeName: string;
  description: string;
  category: string;
  logo: string;
  banner: string;
  phone: string;
  email: string;
  website?: string;
  socialMedia: {
    instagram?: string;
    facebook?: string;
    youtube?: string;
  };
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
}// src/app/core/models/store.model.ts
export interface Store {
  id: string; // 🔥 Mudado para string
  userId: string | number; // 🔥 Mudado para string | number
  storeName: string;
  description: string;
  category: string;
  logo: string;
  banner: string;
  cnpj?: string;
  cpf?: string;
  documentType: 'pf' | 'pj';
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
  phone: string;
  email: string;
  website?: string;
  socialMedia?: {
    instagram?: string;
    facebook?: string;
    youtube?: string;
  };
  rating: number;
  totalSales: number;
  active: boolean;
  createdAt: string; // 🔥 Mudado para string
  updatedAt?: string; // 🔥 Mudado para string
}

export interface StoreForm {
  storeName: string;
  description: string;
  category: string;
  logo: string;
  banner: string;
  phone: string;
  email: string;
  website?: string;
  socialMedia: {
    instagram?: string;
    facebook?: string;
    youtube?: string;
  };
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
