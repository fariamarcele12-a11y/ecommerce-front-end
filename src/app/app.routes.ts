import { Routes } from '@angular/router';
import { Home } from './features/home/home';
import { Checkout } from './features/checkout/checkout';
import { Cart } from './features/cart/cart';
import { ProductDetail } from './features/products/product-detail/product-detail';

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

  // Categoria (redireciona para home com filtro - implementar depois)
  { path: 'categoria/:id', component: Home },

  // Vender (feature futura)
  { path: 'vender', redirectTo: '/home' },

  // Favoritos (feature futura)
  { path: 'favoritos', redirectTo: '/home' },

  // Perfil (feature futura)
  { path: 'perfil', redirectTo: '/home' },

  // Pedidos (feature futura)
  { path: 'pedidos', redirectTo: '/home' },

  // Qualquer rota não encontrada redireciona para home
  { path: '**', redirectTo: '/home' }
];
