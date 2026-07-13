import { Component, OnInit, OnChanges, Input, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProductService, ProductResponse } from '../../core/services/product.service';
import { Product } from '../../core/models/ProductModel/product.model';
import { ProductCard } from '../../shared/components/product-card/product-card';
import { Pagination } from '../../shared/components/pagination/pagination';
import { ProductFilters } from '../../core/models/ProductModel/product-filters.model';

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [CommonModule, ProductCard, Pagination],
  templateUrl: './products.html',
  styleUrls: ['./products.scss']
})
export class Products implements OnInit, OnChanges {
  @Input() filters: ProductFilters = {};
  @Input() limit?: number;
  @Input() showPagination: boolean = false;

  products: Product[] = [];
  totalProducts: number = 0;
  currentPage: number = 1;
  itemsPerPage: number = 12;
  totalPages: number = 1;
  loading = true;

  constructor(private productService: ProductService) {}

  ngOnInit(): void {
    this.loadProducts();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['filters'] && !changes['filters'].firstChange) {
      console.log('🔄 Filtros do Products mudaram:', this.filters);
      this.loadProducts(true);
    }
  }

  loadProducts(forceRefresh: boolean = false): void {
    this.loading = true;

    const filters = { ...this.filters };
    if (this.limit) {
      filters.limit = this.limit;
    }
    if (!filters.limit) {
      filters.limit = this.itemsPerPage;
    }

    console.log('🚀 Products carregando com filtros:', filters);

    this.productService.getProducts(filters, !forceRefresh).subscribe({
      next: (response: ProductResponse) => {
        this.products = response.products;
        this.totalProducts = response.total;
        this.currentPage = response.page;
        this.itemsPerPage = response.limit;
        this.totalPages = response.totalPages;
        this.loading = false;
        console.log(`✅ ${this.products.length} produtos carregados (Total: ${this.totalProducts})`);
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

  onFavoriteToggle(productId: number): void {
    this.productService.toggleFavorite(productId);
    const product = this.products.find(p => p.id === productId);
    if (product) {
      product.isFavorite = !product.isFavorite;
    }
  }

  applyFilters(newFilters: ProductFilters): void {
    this.filters = { ...this.filters, ...newFilters };
    this.currentPage = 1;
    this.loadProducts(true);
  }

  onPageChange(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.filters.page = page;
      this.loadProducts(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }
}
