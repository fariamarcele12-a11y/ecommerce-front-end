// src/app/features/categories/category-detail/category-detail.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CategoryService } from '../../../core/services/category.service';
import { Category } from '../../../core/models/category.model';
import { Products } from '../../products/products';
import { Subscription } from 'rxjs';
import { ProductFilters } from '../../../core/models/ProductModel/product-filters.model';

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
  private categorySlug: string = ''; // 🔥 NOVO: Guardar o slug atual

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private categoryService: CategoryService,
  ) {}

  ngOnInit(): void {
    this.routeSub = this.route.params.subscribe((params) => {
      const slug = params['slug'];
      console.log('🔍 Slug da categoria:', slug);
      console.log('🔄 Categoria anterior:', this.categorySlug);

      if (slug) {
        // 🔥 Se o slug mudou, recarregar
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

    // 🔥 Limpar os filtros antes de carregar nova categoria
    this.filters = {};

    this.categoryService.getCategoryBySlug(slug).subscribe({
      next: (category) => {
        console.log('📦 Categoria encontrada:', category);
        if (category) {
          this.category = category;

          const categoryName = category.name;
          console.log(`📌 Nome da categoria para filtro: "${categoryName}"`);

          // 🔥 Forçar novos filtros
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

  getIconClass(icon?: string): string {
    return icon ? `bi ${icon}` : 'bi-tag';
  }
}
