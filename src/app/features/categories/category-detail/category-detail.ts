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

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private categoryService: CategoryService,
  ) {}

  ngOnInit(): void {
    this.routeSub = this.route.params.subscribe((params) => {
      const slug = params['slug'];
      if (slug) {
        this.loadCategory(slug);
      }
    });
  }

  ngOnDestroy(): void {
    this.routeSub.unsubscribe();
  }

  loadCategory(slug: string): void {
    this.loading = true;
    this.categoryService.getCategoryBySlug(slug).subscribe({
      next: (category) => {
        if(category){
          this.category = category;
          this.filters = {
          category: category?.slug,
          sortBy: 'newest'
         };
        }else{
          this.router.navigate(['/home']);
        }
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.router.navigate(['/home']);
      },
    });
  }

  getIconClass(icon?: string): string {
    return icon ? `bi ${icon}` : 'bi-tag';
  }
}
