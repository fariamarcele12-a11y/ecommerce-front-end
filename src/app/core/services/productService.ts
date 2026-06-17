import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { Product } from '../models/ProductModel/product.model';
import { ProductFilters } from '../models/ProductModel/product-filters.model';

@Injectable({
  providedIn: 'root'
})
export class ProductService{
  
  private mockProducts: Product[] = [
    {
      id: 1,
      name: 'iPhone 15 Pro Max - 256GB',
      description: 'Novo iPhone com chip A17 Pro, câmera de 48MP e bateria de longa duração',
      price: 7999,
      oldPrice: 8999,
      discount: 11,
      images: ['https://picsum.photos/id/0/300/300'],
      category: 'Eletronicos',
      condition: 'new',
      seller: { id: 1, name: 'Apple Store BR', rating: 4.9, sales: 1234 },
      location: 'São Paulo - SP',
      stock: 10,
      createdAt: new Date('2024-01-15'),
      isFavorite: false
    },
    {
      id: 2,
      name: 'Notebook Dell XPS 13',
      description: 'Intel Core i7, 16GB RAM, SSD 512GB, Tela InfinityEdge 4K',
      price: 8999,
      oldPrice: 10999,
      discount: 18,
      images: ['https://picsum.photos/id/1/300/300'],
      category: 'Eletronicos',
      condition: 'new',
      seller: { id: 2, name: 'Dell Oficial', rating: 4.8, sales: 856 },
      location: 'Rio de Janeiro - RJ',
      stock: 5,
      createdAt: new Date('2024-02-01'),
      isFavorite: false
    },
    {
      id: 3,
      name: 'TV Samsung 65" 4K',
      description: 'Smart TV Crystal UHD 4K, Processador Crystal 4K, Alexa Built-in',
      price: 3499,
      oldPrice: 4499,
      discount: 22,
      images: ['https://picsum.photos/id/2/300/300'],
      category: 'Eletronicos',
      condition: 'new',
      seller: { id: 3, name: 'Samsung Brasil', rating: 4.9, sales: 2341 },
      location: 'São Paulo - SP',
      stock: 15,
      createdAt: new Date('2024-01-20'),
      isFavorite: false
    },
    {
      id: 4,
      name: 'Camisa Social Masculina',
      description: 'Camisa Slim Fit, 100% algodão, diversas cores',
      price: 129.90,
      oldPrice: 199.90,
      discount: 35,
      images: ['https://picsum.photos/id/3/300/300'],
      category: 'moda',
      condition: 'new',
      seller: { id: 4, name: 'Moda Fashion', rating: 4.7, sales: 5432 },
      location: 'Belo Horizonte - MG',
      stock: 50,
      createdAt: new Date('2024-02-10'),
      isFavorite: false
    },
    {
      id: 5,
      name: 'Sofá Retrátil e Reclinável',
      description: 'Sofá 3 lugares, revestimento em couro, ideal para sua sala',
      price: 1899,
      oldPrice: 2499,
      discount: 24,
      images: ['https://picsum.photos/id/4/300/300'],
      category: 'casa',
      condition: 'new',
      seller: { id: 5, name: 'Móveis Top', rating: 4.6, sales: 890 },
      location: 'Curitiba - PR',
      stock: 8,
      createdAt: new Date('2024-01-05'),
      isFavorite: false
    },
    {
      id: 6,
      name: 'Bicicleta Aro 29',
      description: 'Mountain bike com suspensão, 21 marchas, freio a disco',
      price: 1299,
      oldPrice: 1899,
      discount: 31,
      images: ['https://picsum.photos/id/5/300/300'],
      category: 'esporte',
      condition: 'new',
      seller: { id: 6, name: 'Bike World', rating: 4.8, sales: 456 },
      location: 'Porto Alegre - RS',
      stock: 12,
      createdAt: new Date('2024-02-15'),
      isFavorite: false
    },
    {
      id: 7,
      name: 'iPhone 13 - 128GB (Usado)',
      description: 'Aparelho em ótimo estado, sem marcas de uso, bateria 92%',
      price: 3299,
      oldPrice: 4999,
      discount: 34,
      images: ['https://picsum.photos/id/6/300/300'],
      category: 'Eletronicos',
      condition: 'used',
      seller: { id: 7, name: 'Tech Usados', rating: 4.5, sales: 234 },
      location: 'São Paulo - SP',
      stock: 3,
      createdAt: new Date('2024-02-18'),
      isFavorite: false
    },
    {
      id: 8,
      name: 'Tênis Nike Air Max',
      description: 'Conforto e estilo, tecnologia Air Max, diversas cores',
      price: 599.90,
      oldPrice: 899.90,
      discount: 33,
      images: ['https://picsum.photos/id/7/300/300'],
      category: 'moda',
      condition: 'new',
      seller: { id: 8, name: 'Nike Store', rating: 4.9, sales: 3456 },
      location: 'Rio de Janeiro - RJ',
      stock: 30,
      createdAt: new Date('2024-02-12'),
      isFavorite: false
    }
  ];

  getProducts(filters?: ProductFilters): Observable<Product[]> {
    let products = [...this.mockProducts];
    
    if (filters) {
      if (filters.category) {
        products = products.filter(p => p.category === filters.category);
      }
      if (filters.minPrice) {
        products = products.filter(p => p.price >= filters.minPrice!);
      }
      if (filters.maxPrice) {
        products = products.filter(p => p.price <= filters.maxPrice!);
      }
      if (filters.condition) {
        products = products.filter(p => p.condition === filters.condition);
      }
      if (filters.search) {
        const search = filters.search.toLowerCase();
        products = products.filter(p => 
          p.name.toLowerCase().includes(search) || 
          p.description.toLowerCase().includes(search)
        );
      }
      if (filters.sortBy) {
        switch (filters.sortBy) {
          case 'price_asc':
            products.sort((a, b) => a.price - b.price);
            break;
          case 'price_desc':
            products.sort((a, b) => b.price - a.price);
            break;
          case 'newest':
            products.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
            break;
          case 'popular':
            products.sort((a, b) => b.seller.sales - a.seller.sales);
            break;
        }
      }
    }
    
    return of(products);
  }

  getProductById(id: number): Observable<Product | undefined> {
    const product = this.mockProducts.find(p => p.id === id);
    return of(product);
  }

  getRelatedProducts(category: string, productId: number): Observable<Product[]> {
    const related = this.mockProducts.filter(p => p.category === category && p.id !== productId);
    return of(related.slice(0, 4));
  }

  toggleFavorite(productId: number): void {
    const product = this.mockProducts.find(p => p.id === productId);
    if (product) {
      product.isFavorite = !product.isFavorite;
    }
  }
}