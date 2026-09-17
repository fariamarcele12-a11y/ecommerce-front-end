// src/app/core/models/ProductModel/product.model.ts
export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  oldPrice?: number;
  discount?: number;
  images: string[];
  category: string;
  condition: 'new' | 'used';
  seller: {
    id: string;
    name: string;
    rating: number;
    sales: number;
    memberSince?: string;
  };
  storeId?: string;
  location: string;
  stock: number;
  freeShipping?: boolean;
  createdAt: string;
  updatedAt?: string;
  isFavorite?: boolean;
}

export interface ProductFilters {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  condition?: 'new' | 'used';
  search?: string;
  sortBy?: 'price_asc' | 'price_desc' | 'newest' | 'popular';
  page?: number;
  limit?: number;
  sellerId?: string; // 🔥 Mudado para string
  location?: string;
  hasDiscount?: boolean;
  freeShipping?: boolean;
  inStock?: boolean;
}

export interface ProductResponse {
  products: Product[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
