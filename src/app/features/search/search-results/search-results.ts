import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Product } from '../../../core/models/ProductModel/product.model';
import { ProductService, ProductResponse } from '../../../core/services/product.service';
import { ProductCard } from '../../../shared/components/product-card/product-card';
import { SearchFilters } from '../search-filters/search-filters';
import { Pagination } from '../../../shared/components/pagination/pagination';
import { Subscription } from 'rxjs';
import { ProductFilters } from '../../../core/models/ProductModel/product-filters.model';

@Component({
  selector: 'app-search-results',
  standalone: true,
  imports: [CommonModule, FormsModule, ProductCard, SearchFilters, Pagination, RouterLink],
  templateUrl: './search-results.html',
  styleUrls: ['./search-results.scss'],
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
    inStock: false,
  };

  showFilters = false;
  private routeSub: Subscription = new Subscription();
  private filterSub: Subscription = new Subscription();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private productService: ProductService,
  ) {}

  ngOnInit(): void {
    this.routeSub = this.route.queryParams.subscribe((params) => {
      console.log('📋 Query params recebidos:', params);

      // 🔥 RESETAR filtros corretamente
      this.filters = {
        sortBy: 'newest',
        limit: this.itemsPerPage,
        page: 1,
        hasDiscount: false,
        freeShipping: false,
        inStock: false,
      };

      if (params['q']) this.filters.search = params['q'];
      if (params['category']) this.filters.category = params['category'];
      if (params['page']) {
        this.currentPage = +params['page'];
        this.filters.page = this.currentPage;
      }
      if (params['sort']) this.filters.sortBy = params['sort'];
      if (params['limit']) {
        this.itemsPerPage = +params['limit'];
        this.filters.limit = this.itemsPerPage;
      }

      console.log('🔍 Filtros aplicados:', this.filters);
      this.loadProducts();
    });
  }

  ngOnDestroy(): void {
    this.routeSub.unsubscribe();
    this.filterSub.unsubscribe();
    this.productService.invalidateCache();
    console.log('🧹 Filtros limpos ao sair da página');
  }

  loadProducts(): void {
    this.loading = true;

    // 🔥 Garantir que page e limit estão corretos
    this.filters.page = this.currentPage;
    this.filters.limit = this.itemsPerPage;

    console.log('🚀 Carregando produtos com filtros:', this.filters);
    console.log('🔢 Página atual:', this.currentPage);

    if (this.filterSub) {
      this.filterSub.unsubscribe();
    }

    this.filterSub = this.productService.getProducts(this.filters, false).subscribe({
      next: (response: ProductResponse) => {
        console.log('📦 Resposta recebida:', response);

        this.products = response.products;
        this.totalProducts = response.total;
        this.totalPages = response.totalPages;
        this.currentPage = response.page;
        this.itemsPerPage = response.limit;
        this.loading = false;

        console.log(
          `✅ ${this.products.length} produtos carregados (Total: ${this.totalProducts})`,
        );
        console.log(`📄 Página ${this.currentPage} de ${this.totalPages}`);

        // 🔥 SE A PÁGINA ATUAL FOR MAIOR QUE O TOTAL, REDIRECIONAR PARA A ÚLTIMA PÁGINA
        if (this.currentPage > this.totalPages && this.totalPages > 0) {
          console.warn(
            `⚠️ Página ${this.currentPage} não existe. Redirecionando para página ${this.totalPages}`,
          );
          this.currentPage = this.totalPages;
          this.filters.page = this.totalPages;
          this.updateUrlParams();
          this.loadProducts(); // Recarregar com a página correta
        }
      },
      error: (error) => {
        console.error('❌ Erro ao carregar produtos:', error);
        this.loading = false;
        this.products = [];
        this.totalProducts = 0;
        this.totalPages = 1;
        this.currentPage = 1;
      },
    });
  }

  onFiltersChange(newFilters: ProductFilters): void {
    console.log('🔄 Filtros alterados recebidos:', newFilters);

    // 🔥 Resetar para página 1 ao mudar filtros
    this.currentPage = 1;
    this.filters = {
      ...this.filters,
      ...newFilters,
      page: 1,
      limit: this.itemsPerPage,
    };

    console.log('📋 Filtros mesclados:', this.filters);
    this.updateUrlParams();
    this.loadProducts();
  }

  onClearFilters(): void {
    console.log('🧹 Limpando filtros');
    this.currentPage = 1;
    this.filters = {
      sortBy: 'newest',
      limit: this.itemsPerPage,
      page: 1,
      hasDiscount: false,
      freeShipping: false,
      inStock: false,
    };
    this.updateUrlParams();
    this.loadProducts();
  }

  onPageChange(page: number): void {
    console.log('🔄 Mudando para página:', page);
    console.log('📊 Total de páginas:', this.totalPages);
    console.log('📊 Página atual:', this.currentPage);

    if (page < 1) {
      console.warn('⚠️ Página menor que 1, redirecionando para página 1');
      page = 1;
    }

    if (page > this.totalPages) {
      console.warn(
        `⚠️ Página ${page} maior que total (${this.totalPages}), redirecionando para última página`,
      );
      page = this.totalPages;
    }

    if (page >= 1 && page <= this.totalPages && page !== this.currentPage) {
      this.currentPage = page;
      this.filters.page = page;

      this.updateUrlParams();
      this.productService.invalidateCache();
      this.loadProducts();
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
    if (this.itemsPerPage !== 12) queryParams['limit'] = this.itemsPerPage;

    console.log('🔗 Atualizando URL com params:', queryParams);

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
    });
  }

  toggleFilters(): void {
    this.showFilters = !this.showFilters;
  }
}
