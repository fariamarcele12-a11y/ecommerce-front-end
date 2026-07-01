import { Component, EventEmitter, Output, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CategoryService } from '../../../core/services/category.service';
import { Category } from '../../../core/models/category.model';
import { ProductFilters } from '../../../core/models/ProductModel/product-filters.model';

@Component({
  selector: 'app-search-filters',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './search-filters.html',
  styleUrls: ['./search-filters.scss']
})
export class SearchFilters implements OnInit {
  @Input() filters: ProductFilters = {};
  @Output() filtersChange = new EventEmitter<ProductFilters>();
  @Output() clearFilters = new EventEmitter<void>();

  categories: Category[] = [];
  minPrice: number = 0;
  maxPrice: number = 10000;
  priceRange: number[] = [0, 10000];

  sortOptions = [
    { value: 'newest', label: 'Mais recentes' },
    { value: 'popular', label: 'Mais populares' },
    { value: 'price_asc', label: 'Menor preço' },
    { value: 'price_desc', label: 'Maior preço' }
  ];

  conditionOptions = [
    { value: 'all', label: 'Todos' },
    { value: 'new', label: 'Novo' },
    { value: 'used', label: 'Usado' }
  ];

  constructor(private categoryService: CategoryService) {}

  ngOnInit(): void {
    this.loadCategories();
    this.initializeFilters();
  }

  loadCategories(): void {
    this.categoryService.getCategories().subscribe({
      next: (categories) => {
        this.categories = categories;
        console.log('📂 Categorias carregadas:', categories.length); // Debug
      },
      error: (error) => {
        console.error('❌ Erro ao carregar categorias:', error);
      }
    });
  }

  initializeFilters(): void {
    this.filters = {
      sortBy: 'newest',
      hasDiscount: false,
      freeShipping: false,
      inStock: false,
      ...this.filters
    };
    this.priceRange = [this.filters.minPrice || 0, this.filters.maxPrice || 10000];
    console.log('🔧 Filtros inicializados:', this.filters); // Debug
  }

  onFilterChange(): void {
    this.filters = {
      ...this.filters,
      minPrice: this.priceRange[0],
      maxPrice: this.priceRange[1]
    };
    console.log('💰 Filtro de preço alterado:', this.filters); // Debug
    this.filtersChange.emit(this.filters);
  }

  onCategoryChange(categoryId: string): void {
    this.filters.category = categoryId || undefined;
    console.log('📂 Categoria alterada:', categoryId); // Debug
    this.filtersChange.emit(this.filters);
  }

  onSortChange(sortBy: string): void {
    this.filters.sortBy = sortBy as ProductFilters['sortBy'];
    console.log('📊 Ordenação alterada:', sortBy); // Debug
    this.filtersChange.emit(this.filters);
  }

  onConditionChange(condition: string): void {
    if (condition === 'all') {
      delete this.filters.condition;
    } else {
      this.filters.condition = condition as 'new' | 'used';
    }
    console.log('🏷️ Condição alterada para:', this.filters.condition); // Debug
    // Emitir a mudança imediatamente
    this.filtersChange.emit(this.filters);
  }

  onHasDiscountChange(hasDiscount: boolean): void {
    this.filters.hasDiscount = hasDiscount;
    console.log('🏷️ Promoção alterada:', hasDiscount); // Debug
    this.filtersChange.emit(this.filters);
  }

  onFreeShippingChange(freeShipping: boolean): void {
    this.filters.freeShipping = freeShipping;
    console.log('🚚 Frete grátis alterado:', freeShipping); // Debug
    this.filtersChange.emit(this.filters);
  }

  onInStockChange(inStock: boolean): void {
    this.filters.inStock = inStock;
    console.log('📦 Estoque alterado:', inStock); // Debug
    this.filtersChange.emit(this.filters);
  }

  clearAllFilters(): void {
    this.priceRange = [0, 10000];
    this.filters = {
      sortBy: 'newest',
      hasDiscount: false,
      freeShipping: false,
      inStock: false
    };
    console.log('🧹 Filtros limpos'); // Debug
    this.clearFilters.emit();
    this.filtersChange.emit(this.filters);
  }

  getActiveFiltersCount(): number {
    let count = 0;
    if (this.filters.category) count++;
    if (this.filters.minPrice && this.filters.minPrice > 0) count++;
    if (this.filters.maxPrice && this.filters.maxPrice < 10000) count++;
    if (this.filters.condition) count++;
    if (this.filters.hasDiscount) count++;
    if (this.filters.freeShipping) count++;
    if (this.filters.inStock) count++;
    if (this.filters.search) count++;
    return count;
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price);
  }
}
