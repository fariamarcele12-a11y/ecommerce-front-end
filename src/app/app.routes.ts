import { Routes } from '@angular/router';
import { Home } from './features/home/home';
import { ProductDetail } from './features/products/product-detail/product-detail';
import { Cart } from './features/cart/cart';
import { Checkout } from './features/checkout/checkout';

export const routes: Routes = [
  { path: '', redirectTo: '/home', pathMatch: 'full' },
  { path: 'home', component: Home },
  { path: 'produto/:id', component: ProductDetail },
  { path: 'carrinho', component: Cart },
  { path: 'checkout', component: Checkout },
  { path: 'categoria/:id', component: Home },
  { path: 'vender', redirectTo: '/home' },
  { path: 'favoritos', redirectTo: '/home' },
  { path: 'perfil', redirectTo: '/home' },
  { path: 'pedidos', redirectTo: '/home' },
  { path: '**', redirectTo: '/home' }
];
