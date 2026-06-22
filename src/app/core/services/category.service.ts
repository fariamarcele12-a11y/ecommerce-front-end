import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { Category } from '../models/category.model';

@Injectable({
  providedIn: 'root',
})
export class CategoryService {
   private apiUrl = 'http://localhost:3000/categories'; // Local
  //private apiUrl = 'https://ecommerce-api-mf.vercel.app/categories'; // Produção

  constructor(private http: HttpClient) {}

  getCategories(): Observable<Category[]> {
    return this.http.get<Category[]>(`${this.apiUrl}/categories`);
  }

  getCategoryById(id: number): Observable<Category> {
    return this.http.get<Category>(`${this.apiUrl}/${id}`);
  }

  getCategoryBySlug(slug: string): Observable<Category | null> {
    return this.http
      .get<Category[]>(`${this.apiUrl}?slug=${slug}`)
      .pipe(map((categories) => (categories.length ? categories[0] : null)));
  }

  getPopularCategories(limit = 6): Observable<Category[]> {
    return this.http.get<Category[]>(
      `${this.apiUrl}?_sort=productCount&_order=desc&_limit=${limit}`,
    );
  }
}
