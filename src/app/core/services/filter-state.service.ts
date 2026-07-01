import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { ProductFilters } from '../models/ProductModel/product-filters.model';

@Injectable({
  providedIn: 'root'
})
export class FilterStateService {
  private filtersSubject = new BehaviorSubject<ProductFilters>({
    sortBy: 'newest',
    hasDiscount: false,
    freeShipping: false,
    inStock: false
  });

  filters$ = this.filtersSubject.asObservable();

  setFilters(filters: ProductFilters): void {
    this.filtersSubject.next(filters);
  }

  resetFilters(): void {
    this.filtersSubject.next({
      sortBy: 'newest',
      hasDiscount: false,
      freeShipping: false,
      inStock: false
    });
  }

  getCurrentFilters(): ProductFilters {
    return this.filtersSubject.value;
  }
}
