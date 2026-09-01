// src/app/features/home/home.ts
import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Products } from '../products/products';
import { CategoriesList } from '../categories/categories-list/categories-list';
import { RouterLink } from '@angular/router';
import { ProductFilters } from '../../core/models/ProductModel/product-filters.model';
import { CategoryService } from '../../core/services/category.service';
import { Category } from '../../core/models/category.model';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, Products, CategoriesList, RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home implements OnInit {
  banners = [
    {
      image: 'https://picsum.photos/id/20/1200/300',
      title: 'Ofertas Imperdíveis',
      subtitle: 'Até 50% OFF',
    },
    {
      image: 'https://picsum.photos/id/21/1200/300',
      title: 'Produtos Exclusivos',
      subtitle: 'Frete Grátis',
    },
    {
      image: 'https://picsum.photos/id/22/1200/300',
      title: 'Novidades',
      subtitle: 'Lançamentos 2024',
    },
  ];

  featuredFilters: ProductFilters = {
    sortBy: 'popular',
    limit: 8
  };

  // 🔥 Categorias populares (vindas do banco)
  popularCategories: Category[] = [];
  loadingCategories = true;

  constructor(private categoryService: CategoryService) {}

  ngOnInit(): void {
    this.loadPopularCategories();
  }

  /**
   * 🔥 Carrega categorias populares do banco de dados
   */
  loadPopularCategories(): void {
    this.loadingCategories = true;
    this.categoryService.getPopularCategories(4).subscribe({
      next: (categories) => {
        this.popularCategories = categories;
        this.loadingCategories = false;
        console.log('📦 Categorias populares carregadas:', this.popularCategories);
      },
      error: (error) => {
        console.error('❌ Erro ao carregar categorias populares:', error);
        this.loadingCategories = false;
        // 🔥 Fallback: categorias padrão
        this.popularCategories = this.getDefaultCategories();
      }
    });
  }

  /**
   * 🔥 Categorias padrão para fallback
   */
  private getDefaultCategories(): Category[] {
    const now = new Date().toISOString();
    return [
      { id: 1, name: 'Eletrônicos', slug: 'eletronicos', active: true, createdAt: now, description: 'Produtos eletrônicos e tecnologia', icon: 'bi-phone', productCount: 156 },
      { id: 2, name: 'Moda', slug: 'moda', active: true, createdAt: now, description: 'Roupas, calçados e acessórios', icon: 'bi-bag', productCount: 234 },
      { id: 3, name: 'Casa e Decoração', slug: 'casa-decoracao', active: true, createdAt: now, description: 'Móveis, decoração e utensílios', icon: 'bi-house', productCount: 189 },
      { id: 4, name: 'Esportes', slug: 'esportes', active: true, createdAt: now, description: 'Equipamentos e acessórios esportivos', icon: 'bi-bicycle', productCount: 98 }
    ];
  }

  /**
   * 🔥 Obtém a classe de cor para o ícone da categoria
   */
  getIconColor(index: number): string {
    const colors = ['text-primary', 'text-success', 'text-warning', 'text-danger'];
    return colors[index % colors.length];
  }

  /**
   * 🔥 Obtém a classe de fundo para o ícone da categoria
   */
  getIconBgClass(index: number): string {
    const colors = ['bg-primary', 'bg-success', 'bg-warning', 'bg-danger'];
    return colors[index % colors.length];
  }

  /**
   * 🔥 Formata o número de produtos
   */
  formatProductCount(count: number | undefined): string {
    if (!count) return '0 produtos';
    if (count > 1000) return (count / 1000).toFixed(1) + 'k produtos';
    return count + ' produtos';
  }
}
