import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Products } from '../products/products';
import { CategoriesList } from '../categories/categories-list/categories-list';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, Products, CategoriesList],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  banners = [
    { image: 'https://picsum.photos/id/20/1200/300', title: 'Ofertas Imperdíveis', subtitle: 'Até 50% OFF' },
    { image: 'https://picsum.photos/id/21/1200/300', title: 'Produtos Exclusivos', subtitle: 'Frete Grátis' }
  ];
}
