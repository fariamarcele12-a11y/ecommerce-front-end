export interface Category {
  id: number;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  image?: string;
  parentId?: number;
  subcategories?: Category[];
  productCount?: number;
  active: boolean;
  createdAt: Date;
  updatedAt?: Date;
}

export interface CategoryFilter {
  categoryId?: number;
  sortBy?: 'name' | 'productCount' | 'newest';
  order?: 'asc' | 'desc';
  limit?: number;
}
