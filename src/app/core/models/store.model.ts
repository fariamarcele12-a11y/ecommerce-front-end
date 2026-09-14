// src/app/core/models/store.model.ts

export interface Store {
  id: string;
  userId: string;
  storeName: string;
  description: string;
  category: string;
  logo?: string;
  banner?: string;
  documentType?: 'pf' | 'pj';
  cpf?: string;
  cnpj?: string;
  address: StoreAddress;
  phone: string;
  email: string;
  website?: string;
  socialMedia?: StoreSocialMedia;
  rating: number;
  totalSales: number;
  active: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface StoreAddress {
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  cep: string;
  country: string;
}

export interface StoreSocialMedia {
  instagram?: string;
  facebook?: string;
  youtube?: string;
}

export interface StoreForm {
  storeName: string;
  description: string;
  category: string;
  logo?: string;
  banner?: string;
  phone: string;
  email: string;
  website?: string;
  socialMedia?: StoreSocialMedia;
  address: StoreAddress;
}

export interface StoreSummary {
  id: string;
  storeName: string;
  logo?: string;
  banner?: string;
  category: string;
  rating: number;
  totalSales: number;
  productCount?: number;
}

export interface StoreFilters {
  category?: string;
  search?: string;
  minRating?: number;
  city?: string;
  state?: string;
  sortBy?: 'rating' | 'sales' | 'newest' | 'name';
  page?: number;
  limit?: number;
  active?: boolean;
}

export interface StoreResponse {
  stores: Store[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}