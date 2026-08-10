import { Injectable } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class ScrollService {
  constructor(private router: Router) {
    // Scroll para o topo em toda navegação
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  /**
   * Scroll para o topo da página
   */
  scrollToTop(behavior: ScrollBehavior = 'smooth'): void {
    window.scrollTo({ top: 0, behavior });
  }

  /**
   * Scroll para um elemento específico
   */
  scrollToElement(elementId: string, behavior: ScrollBehavior = 'smooth'): void {
    const element = document.getElementById(elementId);
    if (element) {
      element.scrollIntoView({ behavior, block: 'start' });
    }
  }

  /**
   * Scroll para uma posição específica
   */
  scrollToPosition(y: number, behavior: ScrollBehavior = 'smooth'): void {
    window.scrollTo({ top: y, behavior });
  }
}