import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ProductCard } from './shared/components/product-card/product-card';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ProductCard],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('ecommerce-front-end');
}
