export interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  oldPrice?: number;
  discount?: number;
  images: string[];
  category: string;
  condition: 'new' | 'used';
  seller: {
    id: number;
    name: string;
    rating: number;
    sales: number;
  };
  storeId?: number;
  location: string;
  stock: number;
  freeShipping?: boolean;
  createdAt: string;
  updatedAt?: string;
  isFavorite?: boolean;
}
