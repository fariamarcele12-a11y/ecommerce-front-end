// src/app/core/models/ProductModel/product.model.ts
export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;

  // 🔥 Preço original antes do desconto (backend: OriginalPrice)
  originalPrice?: number | null;

  // Mantido para compatibilidade com o código legado
  oldPrice?: number;
  discount?: number;

  // 🔥 Imagem principal (backend: MainImage) + lista de imagens
  mainImage?: string | null;
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

  // 🔥 Campos do backend para a loja e vendedor
  storeName?: string;
  sellerId?: string;
  sellerName?: string;

  location: string;
  stock: number;
  freeShipping?: boolean;

  // 🔥 Status do produto no backend
  active?: boolean;
  featured?: boolean;

  // 🔥 Métricas
  rating?: number;
  reviewCount?: number;
  sales?: number;

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
  sellerId?: string;
  location?: string;
  hasDiscount?: boolean;
  freeShipping?: boolean;
  inStock?: boolean;
  storeId?: string; // 🔥 NOVO — filtro por loja
}

export interface ProductResponse {
  products: Product[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
