// src/app/core/models/category.model.ts
export interface Category {
  id: string | number;
  name: string;        // Ex: "Eletrônicos"
  slug: string;        // Ex: "eletronicos" - usado na URL
  description?: string;
  image?: string;
  icon?: string;       // Classe do Bootstrap Icons
  productCount?: number;
  subcategories?: Category[];
  parentId?: string | number;
  active?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CategoryFilter {
  limit?: number;
  sortBy?: 'name' | 'productCount' | 'createdAt';
  order?: 'asc' | 'desc';
  categoryId?: string | number;
  active?: boolean;
  search?: string;
}
