import { Routes } from '@angular/router';
import { Home } from './features/home/home';
import { ProductDetail } from './features/products/product-detail/product-detail';
import { Cart } from './features/cart/cart';
import { Checkout } from './features/checkout/checkout';

export const routes: Routes = [
  // Rota principal
  { path: '', redirectTo: '/home', pathMatch: 'full' },

  // Home
  { path: 'home', component: Home },

  // Detalhe do Produto
  { path: 'produto/:id', component: ProductDetail },

  // Carrinho
  { path: 'carrinho', component: Cart },

  // Checkout
  { path: 'checkout', component: Checkout },

  // Categoria
  { path: 'categoria/:id', component: Home },

  // Features futuras
  { path: 'vender', redirectTo: '/home' },
  { path: 'favoritos', redirectTo: '/home' },
  { path: 'perfil', redirectTo: '/home' },
  { path: 'pedidos', redirectTo: '/home' },
  { path: 'produtos', redirectTo: '/home' },
  { path: 'sobre', redirectTo: '/home' },
  { path: 'contato', redirectTo: '/home' },

  // Qualquer rota não encontrada
  { path: '**', redirectTo: '/home' }
];
