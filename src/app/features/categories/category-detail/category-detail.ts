// src/app/features/categories/category-detail/category-detail.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CategoryService } from '../../../core/services/category.service';
import { Category } from '../../../core/models/category.model';
import { Products } from '../../products/products';
import { Subscription } from 'rxjs';
import { ProductFilters } from '../../../core/models/ProductModel/product-filters.model';
import { CategoryStatsService } from '../../../core/services/category-stats.service';

@Component({
  selector: 'app-category-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, Products],
  templateUrl: './category-detail.html',
  styleUrls: ['./category-detail.scss'],
})
export class CategoryDetail implements OnInit, OnDestroy {
  category: Category | null = null;
  loading = true;
  filters: ProductFilters = {};
  private routeSub: Subscription = new Subscription();
  private categorySlug: string = '';
  private isUpdatingCount = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private categoryService: CategoryService,
    private categoryStatsService: CategoryStatsService,
  ) {}

  ngOnInit(): void {
    this.routeSub = this.route.params.subscribe((params) => {
      const slug = params['slug'];
      console.log('🔍 Slug da categoria:', slug);
      console.log('🔄 Categoria anterior:', this.categorySlug);

      if (slug) {
        if (this.categorySlug !== slug) {
          this.categorySlug = slug;
          this.loadCategory(slug);
        }
      }
    });
  }

  ngOnDestroy(): void {
    this.routeSub.unsubscribe();
  }

  loadCategory(slug: string): void {
    this.loading = true;
    console.log(`🔍 Buscando categoria com slug: ${slug}`);

    this.filters = {};

    this.categoryService.getCategoryBySlug(slug).subscribe({
      next: (category) => {
        console.log('📦 Categoria encontrada:', category);
        if (category) {
          this.category = category;

          // 🔥 Atualizar a contagem de produtos da categoria
          this.updateCategoryCount(category);

          const categoryName = category.name;
          console.log(`📌 Nome da categoria para filtro: "${categoryName}"`);

          this.filters = {
            category: categoryName,
            sortBy: 'newest',
            page: 1,
            limit: 12
          };

          console.log('🔍 Filtros aplicados no CategoryDetail:', this.filters);
        } else {
          console.warn('⚠️ Categoria não encontrada, redirecionando para home');
          this.router.navigate(['/home']);
        }
        this.loading = false;
      },
      error: (error) => {
        console.error('❌ Erro ao carregar categoria:', error);
        this.loading = false;
        this.router.navigate(['/home']);
      },
    });
  }

  /**
   * 🔥 Atualiza a contagem de produtos da categoria
   */
  private updateCategoryCount(category: Category): void {
    if (this.isUpdatingCount) return;
    this.isUpdatingCount = true;

    console.log(`🔄 Atualizando contagem da categoria: ${category.name}`);

    this.categoryStatsService.updateCategoryCount(category.id).subscribe({
      next: (updatedCategory) => {
        this.isUpdatingCount = false;
        if (updatedCategory) {
          console.log(`✅ Contagem atualizada: ${updatedCategory.productCount} produtos`);
          this.category = updatedCategory;
        }
      },
      error: (error) => {
        this.isUpdatingCount = false;
        console.error('❌ Erro ao atualizar contagem:', error);
        // Não mostrar erro para o usuário, apenas log
      }
    });
  }

  getIconClass(icon?: string): string {
    return icon ? `bi ${icon}` : 'bi-tag';
  }
}
