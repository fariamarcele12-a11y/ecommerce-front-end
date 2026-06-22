import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Category } from '../../../core/models/category.model';
import { CategoryService } from '../../../core/services/category.service';

@Component({
  selector: 'app-categories-list',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './categories-list.html',
  styleUrls: ['./categories-list.scss']
})
export class CategoriesList implements OnInit {
  @Input() limit?: number;
  @Input() showSubcategories: boolean = true;
  @Input() layout: 'grid' | 'list' = 'grid';
  @Output() categorySelected = new EventEmitter<Category>();

  categories: Category[] = [];
  loading = true;

  constructor(private categoryService: CategoryService) {}

  ngOnInit(): void {
    this.loadCategories();
  }

  loadCategories(): void {
    this.loading = true;
    this.categoryService.getCategories({ limit: this.limit }).subscribe({
      next: (categories) => {
        this.categories = categories;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  onCategoryClick(category: Category): void {
    this.categorySelected.emit(category);
  }

  getIconClass(icon?: string): string {
    return icon ? `bi ${icon}` : 'bi-tag';
  }

  getCategoryUrl(slug: string): string {
    return `/categoria/${slug}`;
  }
}
