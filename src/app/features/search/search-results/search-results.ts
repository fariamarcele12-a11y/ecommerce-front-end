import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Product } from '../../../core/models/ProductModel/product.model';
import { ProductService } from '../../../core/services/product.service';
import { ProductCard } from '../../../shared/components/product-card/product-card';
import { SearchFilters } from '../search-filters/search-filters';
import { Subscription } from 'rxjs';
import { ProductFilters } from '../../../core/models/ProductModel/product-filters.model';

@Component({
  selector: 'app-search-results',
  standalone: true,
  imports: [CommonModule, FormsModule, ProductCard, SearchFilters, RouterLink],
  templateUrl: './search-results.html',
  styleUrls: ['./search-results.scss']
})
export class SearchResults implements OnInit, OnDestroy {
  products: Product[] = [];
  loading = true;
  totalProducts = 0;
  currentPage = 1;
  itemsPerPage = 12;
  totalPages = 1;

  filters: ProductFilters = {
    sortBy: 'newest',
    limit: 12,
    page: 1,
    hasDiscount: false,
    freeShipping: false,
    inStock: false
  };

  showFilters = false;
  private routeSub: Subscription = new Subscription();
  private filterSub: Subscription = new Subscription();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private productService: ProductService
  ) {}

  ngOnInit(): void {
    this.routeSub = this.route.queryParams.subscribe(params => {
      console.log('📋 Query params recebidos:', params);

      // Resetar filtros
      this.resetFilters();

      if (params['q']) {
        this.filters.search = params['q'];
      }
      if (params['category']) {
        this.filters.category = params['category'];
      }
      if (params['page']) {
        this.currentPage = +params['page'];
        this.filters.page = this.currentPage;
      }
      if (params['sort']) {
        this.filters.sortBy = params['sort'];
      }

      console.log('🔍 Filtros aplicados:', this.filters);
      this.loadProducts();
    });
  }

  ngOnDestroy(): void {
    this.routeSub.unsubscribe();
    this.filterSub.unsubscribe();
    // Limpar filtros ao sair da página
    this.resetFilters();
    // Invalidar cache do ProductService
    this.productService.invalidateCache();
    console.log('🧹 Filtros limpos ao sair da página');
  }

  resetFilters(): void {
    this.filters = {
      sortBy: 'newest',
      limit: 12,
      page: 1,
      hasDiscount: false,
      freeShipping: false,
      inStock: false
    };
    this.currentPage = 1;
    this.showFilters = false;
  }

  loadProducts(): void {
    this.loading = true;

    this.filters.page = this.currentPage;
    this.filters.limit = this.itemsPerPage;

    console.log('🚀 Carregando produtos com filtros:', this.filters);

    if (this.filterSub) {
      this.filterSub.unsubscribe();
    }

    this.filterSub = this.productService.getProducts(this.filters, false).subscribe({
      next: (products) => {
        this.products = products;
        this.totalProducts = products.length;
        this.totalPages = Math.ceil(this.totalProducts / this.itemsPerPage) || 1;
        this.loading = false;
        console.log(`✅ ${products.length} produtos carregados`);
      },
      error: (error) => {
        console.error('❌ Erro ao carregar produtos:', error);
        this.loading = false;
        this.products = [];
        this.totalProducts = 0;
        this.totalPages = 1;
      }
    });
  }

  onFiltersChange(newFilters: ProductFilters): void {
    console.log('🔄 Filtros alterados recebidos:', newFilters);

    this.currentPage = 1;

    this.filters = {
      ...this.filters,
      ...newFilters,
      page: 1,
      limit: this.itemsPerPage
    };

    console.log('📋 Filtros mesclados:', this.filters);
    this.updateUrlParams();
    this.loadProducts();
  }

  onClearFilters(): void {
    console.log('🧹 Limpando filtros');
    this.resetFilters();
    this.updateUrlParams();
    this.loadProducts();
  }

  onPageChange(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.filters.page = page;
      this.updateUrlParams();
      this.loadProducts();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  updateUrlParams(): void {
    const queryParams: any = {};
    if (this.filters.search) queryParams['q'] = this.filters.search;
    if (this.filters.category) queryParams['category'] = this.filters.category;
    if (this.currentPage > 1) queryParams['page'] = this.currentPage;
    if (this.filters.sortBy && this.filters.sortBy !== 'newest') {
      queryParams['sort'] = this.filters.sortBy;
    }

    console.log('🔗 Atualizando URL com params:', queryParams);

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge'
    });
  }

  toggleFilters(): void {
    this.showFilters = !this.showFilters;
  }

  getPages(): number[] {
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, this.currentPage - 2);
    let end = Math.min(this.totalPages, start + maxVisible - 1);

    if (end - start < maxVisible - 1) {
      start = Math.max(1, end - maxVisible + 1);
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  }
}
