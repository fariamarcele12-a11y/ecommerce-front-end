import { Routes } from '@angular/router';

export const routes: Routes = [
    { path: '', redirectTo: '/home', pathMatch: 'full'},
    { path: 'home', loadComponent: () => import('./features/home/home').then(m => m.Home)},
    { path: 'produto/:id', loadComponent: () => import('./features/products/product-detail/product-detail').then(m => m.ProductDetail)},
    { path: 'carrinho', loadComponent: () => import('./features/cart/cart').then(m => m.Cart)},
    { path: 'checkout', loadComponent: () => import('./features/checkout/checkout').then(m => m.Checkout) },
    { path: '**', redirectTo: '/home'}
];
