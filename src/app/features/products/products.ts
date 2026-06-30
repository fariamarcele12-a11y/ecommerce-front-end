import { Component, OnInit } from '@angular/core';
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
export class Products implements OnInit {
  products: Product[] = [];
  loading = true;
  filters: ProductFilters = {};

  constructor(private productService: ProductService) {}

  ngOnInit(): void {
    this.loadProducts();
  }

  loadProducts(): void {
    this.loading = true;
    this.productService.getProducts(this.filters).subscribe({
      next: (products) => {
        this.products = products;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
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
    this.loadProducts();
  }
}
