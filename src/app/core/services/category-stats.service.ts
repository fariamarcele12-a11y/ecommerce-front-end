// src/app/core/services/category-stats.service.ts
import { Injectable } from '@angular/core';
import { CategoryService } from './category.service';
import { ProductService } from './product.service';
import { map, switchMap, forkJoin, Observable, of } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class CategoryStatsService {
  constructor(
    private categoryService: CategoryService,
    private productService: ProductService
  ) {}

  /**
   * 🔥 Atualiza a contagem de produtos para todas as categorias
   */
  updateAllCategoryCounts(): Observable<any> {
    console.log('🔄 Atualizando contagem de todas as categorias...');

    return this.categoryService.getCategories().pipe(
      switchMap((categories) => {
        const updateObservables = categories.map((category) => {
          return this.productService.getProductsByCategory(category.name).pipe(
            map((products) => ({
              categoryId: category.id,
              count: products.length
            }))
          );
        });

        return forkJoin(updateObservables);
      }),
      switchMap((results) => {
        const updateObservables = results.map((result) => {
          return this.categoryService.updateCategory(result.categoryId, {
            productCount: result.count
          });
        });

        return forkJoin(updateObservables);
      })
    );
  }

  /**
   * 🔥 Atualiza a contagem de uma categoria específica
   */
  updateCategoryCount(categoryId: string | number): Observable<any> {
    console.log(`🔄 Atualizando contagem da categoria ${categoryId}...`);

    return this.categoryService.getCategoryById(categoryId).pipe(
      switchMap((category) => {
        if (!category) {
          console.warn(`⚠️ Categoria ${categoryId} não encontrada`);
          return of(null);
        }

        return this.productService.getProductsByCategory(category.name).pipe(
          switchMap((products) => {
            const count = products.length;
            console.log(`📊 Categoria "${category.name}" tem ${count} produtos`);

            return this.categoryService.updateCategory(categoryId, {
              productCount: count
            });
          })
        );
      })
    );
  }

  /**
   * 🔥 Atualiza a contagem de uma categoria pelo nome
   */
  updateCategoryCountByName(categoryName: string): Observable<any> {
    console.log(`🔄 Atualizando contagem da categoria "${categoryName}"...`);

    return this.categoryService.getCategories().pipe(
      switchMap((categories) => {
        const category = categories.find(c => c.name === categoryName);
        if (!category) {
          console.warn(`⚠️ Categoria "${categoryName}" não encontrada`);
          return of(null);
        }

        return this.productService.getProductsByCategory(category.name).pipe(
          switchMap((products) => {
            const count = products.length;
            console.log(`📊 Categoria "${category.name}" tem ${count} produtos`);

            return this.categoryService.updateCategory(category.id, {
              productCount: count
            });
          })
        );
      })
    );
  }

  /**
   * 🔥 Incrementa a contagem de uma categoria (quando um produto é adicionado)
   */
  incrementCategoryCount(categoryName: string): Observable<any> {
    console.log(`📈 Incrementando contagem da categoria "${categoryName}"...`);

    return this.categoryService.getCategories().pipe(
      switchMap((categories) => {
        const category = categories.find(c => c.name === categoryName);
        if (!category) {
          console.warn(`⚠️ Categoria "${categoryName}" não encontrada`);
          return of(null);
        }

        const newCount = (category.productCount || 0) + 1;
        console.log(`📊 Nova contagem: ${newCount}`);

        return this.categoryService.updateCategory(category.id, {
          productCount: newCount
        });
      })
    );
  }

  /**
   * 🔥 Decrementa a contagem de uma categoria (quando um produto é removido)
   */
  decrementCategoryCount(categoryName: string): Observable<any> {
    console.log(`📉 Decrementando contagem da categoria "${categoryName}"...`);

    return this.categoryService.getCategories().pipe(
      switchMap((categories) => {
        const category = categories.find(c => c.name === categoryName);
        if (!category) {
          console.warn(`⚠️ Categoria "${categoryName}" não encontrada`);
          return of(null);
        }

        const newCount = Math.max(0, (category.productCount || 0) - 1);
        console.log(`📊 Nova contagem: ${newCount}`);

        return this.categoryService.updateCategory(category.id, {
          productCount: newCount
        });
      })
    );
  }
}
