// src/app/core/guards/debug.guard.ts
import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class DebugGuard implements CanActivate {
  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): boolean {
    console.log('🔍 DebugGuard - Rota:', state.url);
    console.log('🔍 DebugGuard - Parâmetros:', route.params);
    return true;
  }
}
