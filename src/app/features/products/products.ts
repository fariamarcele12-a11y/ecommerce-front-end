import { Component, OnInit, OnChanges, Input, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProductService } from '../../core/services/product.service';
import { Product } from '../../core/models/ProductModel/product.model';
import { ProductCard } from '../../shared/components/product-card/product-card';
import { ProductFilters } from '../../core/models/ProductModel/product-filters.model';

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [CommonModule, ProductCard],
  templateUrl: './products.html',
  styleUrls: ['./products.scss']
})
export class Products implements OnInit, OnChanges {
  @Input() filters: ProductFilters = {};
  @Input() limit?: number;

  products: Product[] = [];
  loading = true;

  constructor(private productService: ProductService) {}

  ngOnInit(): void {
    this.loadProducts();
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Quando os filtros mudarem, recarregar produtos
    if (changes['filters']) {
      console.log('🔄 Filtros do Products mudaram:', this.filters);
      // Forçar recarga sem cache
      this.loadProducts(true);
    }
  }

  loadProducts(forceRefresh: boolean = false): void {
    this.loading = true;

    // Aplicar limite se definido
    const filters = { ...this.filters };
    if (this.limit) {
      filters.limit = this.limit;
    }

    console.log('🚀 Products carregando com filtros:', filters);

    // Forçar recarga sem cache se necessário
    this.productService.getProducts(filters, !forceRefresh).subscribe({
      next: (products) => {
        this.products = products;
        this.loading = false;
        console.log(`✅ ${products.length} produtos carregados no Products`);
      },
      error: () => {
        this.loading = false;
        this.products = [];
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
    this.loadProducts(true);
  }
}
