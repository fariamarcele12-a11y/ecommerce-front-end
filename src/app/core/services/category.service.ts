import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { Category, CategoryFilter } from '../models/category.model';
import { delay } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class CategoryService {

  private mockCategories: Category[] = [
    {
      id: 1,
      name: 'Eletrônicos',
      slug: 'eletronicos',
      description: 'Smartphones, notebooks, TVs e acessórios',
      icon: 'bi-phone',
      image: 'https://picsum.photos/id/0/300/200',
      productCount: 156,
      active: true,
      createdAt: new Date('2024-01-01'),
      subcategories: [
        {
          id: 11,
          name: 'Smartphones',
          slug: 'smartphones',
          description: 'Celulares e acessórios',
          icon: 'bi-phone',
          productCount: 45,
          active: true,
          createdAt: new Date('2024-01-01'),
          parentId: 1
        },
        {
          id: 12,
          name: 'Notebooks',
          slug: 'notebooks',
          description: 'Laptops e ultrabooks',
          icon: 'bi-laptop',
          productCount: 32,
          active: true,
          createdAt: new Date('2024-01-01'),
          parentId: 1
        },
        {
          id: 13,
          name: 'TVs e Monitores',
          slug: 'tvs-monitores',
          description: 'Televisores e monitores',
          icon: 'bi-tv',
          productCount: 28,
          active: true,
          createdAt: new Date('2024-01-01'),
          parentId: 1
        }
      ]
    },
    {
      id: 2,
      name: 'Moda',
      slug: 'moda',
      description: 'Roupas, calçados e acessórios',
      icon: 'bi-bag',
      image: 'https://picsum.photos/id/1/300/200',
      productCount: 234,
      active: true,
      createdAt: new Date('2024-01-01'),
      subcategories: [
        {
          id: 21,
          name: 'Camisetas',
          slug: 'camisetas',
          description: 'Camisetas masculinas e femininas',
          icon: 'bi-hdd-stack',
          productCount: 67,
          active: true,
          createdAt: new Date('2024-01-01'),
          parentId: 2
        },
        {
          id: 22,
          name: 'Calçados',
          slug: 'calcados',
          description: 'Tênis, sapatos e sandálias',
          icon: 'bi-shoe-prints',
          productCount: 54,
          active: true,
          createdAt: new Date('2024-01-01'),
          parentId: 2
        }
      ]
    },
    {
      id: 3,
      name: 'Casa e Decoração',
      slug: 'casa-decoracao',
      description: 'Móveis, decoração e utilidades domésticas',
      icon: 'bi-house',
      image: 'https://picsum.photos/id/2/300/200',
      productCount: 189,
      active: true,
      createdAt: new Date('2024-01-01'),
      subcategories: [
        {
          id: 31,
          name: 'Móveis',
          slug: 'moveis',
          description: 'Sofás, mesas, cadeiras',
          icon: 'bi-sofa',
          productCount: 78,
          active: true,
          createdAt: new Date('2024-01-01'),
          parentId: 3
        },
        {
          id: 32,
          name: 'Decoração',
          slug: 'decoracao',
          description: 'Quadros, vasos, objetos decorativos',
          icon: 'bi-brush',
          productCount: 45,
          active: true,
          createdAt: new Date('2024-01-01'),
          parentId: 3
        }
      ]
    },
    {
      id: 4,
      name: 'Esportes',
      slug: 'esportes',
      description: 'Equipamentos e roupas esportivas',
      icon: 'bi-bicycle',
      image: 'https://picsum.photos/id/3/300/200',
      productCount: 98,
      active: true,
      createdAt: new Date('2024-01-01'),
      subcategories: [
        {
          id: 41,
          name: 'Fitness',
          slug: 'fitness',
          description: 'Equipamentos de academia',
          icon: 'bi-heart-pulse',
          productCount: 34,
          active: true,
          createdAt: new Date('2024-01-01'),
          parentId: 4
        },
        {
          id: 42,
          name: 'Esportes ao ar livre',
          slug: 'esportes-ar-livre',
          description: 'Acampamento, trilhas, pesca',
          icon: 'bi-tree',
          productCount: 28,
          active: true,
          createdAt: new Date('2024-01-01'),
          parentId: 4
        }
      ]
    },
    {
      id: 5,
      name: 'Automóveis',
      slug: 'automoveis',
      description: 'Carros, motos e acessórios automotivos',
      icon: 'bi-car-front',
      image: 'https://picsum.photos/id/4/300/200',
      productCount: 76,
      active: true,
      createdAt: new Date('2024-01-01'),
      subcategories: [
        {
          id: 51,
          name: 'Carros',
          slug: 'carros',
          description: 'Carros novos e usados',
          icon: 'bi-car-front',
          productCount: 42,
          active: true,
          createdAt: new Date('2024-01-01'),
          parentId: 5
        },
        {
          id: 52,
          name: 'Motos',
          slug: 'motos',
          description: 'Motos e scooters',
          icon: 'bi-bicycle',
          productCount: 18,
          active: true,
          createdAt: new Date('2024-01-01'),
          parentId: 5
        }
      ]
    },
    {
      id: 6,
      name: 'Imóveis',
      slug: 'imoveis',
      description: 'Casas, apartamentos e terrenos',
      icon: 'bi-building',
      image: 'https://picsum.photos/id/5/300/200',
      productCount: 45,
      active: true,
      createdAt: new Date('2024-01-01'),
      subcategories: [
        {
          id: 61,
          name: 'Apartamentos',
          slug: 'apartamentos',
          description: 'Apartamentos para venda e aluguel',
          icon: 'bi-building',
          productCount: 25,
          active: true,
          createdAt: new Date('2024-01-01'),
          parentId: 6
        },
        {
          id: 62,
          name: 'Casas',
          slug: 'casas',
          description: 'Casas para venda e aluguel',
          icon: 'bi-house-door',
          productCount: 20,
          active: true,
          createdAt: new Date('2024-01-01'),
          parentId: 6
        }
      ]
    }
  ];

  getCategories(filters?: CategoryFilter): Observable<Category[]> {
    let categories = [...this.mockCategories];

    if (filters) {
      if (filters.sortBy === 'name') {
        categories.sort((a, b) => {
          const order = filters.order === 'desc' ? -1 : 1;
          return a.name.localeCompare(b.name) * order;
        });
      }

      if (filters.sortBy === 'productCount') {
        categories.sort((a, b) => {
          const order = filters.order === 'desc' ? -1 : 1;
          return ((a.productCount || 0) - (b.productCount || 0)) * order;
        });
      }

      if (filters.limit) {
        categories = categories.slice(0, filters.limit);
      }
    }

    return of(categories).pipe(delay(300));
  }

  getCategoryById(id: number): Observable<Category | undefined> {
    const category = this.mockCategories.find(c => c.id === id);
    return of(category);
  }

  getCategoryBySlug(slug: string): Observable<Category | undefined> {
    const category = this.mockCategories.find(c => c.slug === slug);
    return of(category);
  }

  getSubcategories(parentId: number): Observable<Category[]> {
    const category = this.mockCategories.find(c => c.id === parentId);
    return of(category?.subcategories || []);
  }

  getPopularCategories(limit: number = 6): Observable<Category[]> {
    const sorted = [...this.mockCategories]
      .sort((a, b) => (b.productCount || 0) - (a.productCount || 0))
      .slice(0, limit);
    return of(sorted);
  }

  getCategoriesWithIcons(): Observable<Category[]> {
    return of(this.mockCategories.filter(c => c.icon));
  }
}
