export interface Store {
  id: number;
  userId: number;
  storeName: string;
  description: string;
  category: string;
  logo: string;
  banner: string;
  cnpj?: string; // Para PJ
  cpf?: string; // Para PF
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
  createdAt: Date;
  updatedAt?: Date;
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
