// src/app/features/products/products.ts
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
  private previousCategory: string = ''; // 🔥 NOVO: Guardar categoria anterior

  constructor(private productService: ProductService) {}

  ngOnInit(): void {
    this.loadProducts();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['filters']) {
      const currentFilters = changes['filters'].currentValue;
      const previousFilters = changes['filters'].previousValue;

      const currentCategory = currentFilters?.category || '';
      const previousCategory = previousFilters?.category || '';

      if (currentCategory !== previousCategory) {
        this.previousCategory = currentCategory;
        this.currentPage = 1;
        this.loadProducts(true);
      } else if (!changes['filters'].firstChange) {
        this.loadProducts(true);
      }
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
    if (!filters.page) {
      filters.page = this.currentPage;
    }

    const shouldForceRefresh = forceRefresh || this.previousCategory !== filters.category;

    this.productService.getProducts(filters, !shouldForceRefresh).subscribe({
      next: (response: ProductResponse) => {
        this.products = response.products || [];
        this.totalProducts = response.total || 0;
        this.currentPage = response.page || 1;
        this.itemsPerPage = response.limit || 12;
        this.totalPages = response.totalPages || 1;
        this.loading = false;

        if (this.products.length === 0) {
          console.warn('⚠️ Nenhum produto encontrado para os filtros:', filters);
          console.warn('⚠️ Verifique se a categoria "' + filters.category + '" existe nos produtos');
        }
      },
      error: (error: any) => {
        console.error('❌ Erro ao carregar produtos:', error);
        this.loading = false;
        this.products = [];
        this.totalProducts = 0;
        this.totalPages = 1;
      }
    });
  }

  onFavoriteToggle(productId: string): void {
    this.productService.toggleFavorite(productId).subscribe({
      next: () => {
        const product = this.products.find(p => String(p.id) === productId);
        if (product) {
          product.isFavorite = !product.isFavorite;
        }
      },
      error: (error) => {
        console.error('❌ Erro ao alternar favorito:', error);
      }
    });
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
