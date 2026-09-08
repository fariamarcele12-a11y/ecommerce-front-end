// src/app/app.ts
import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Navbar } from './shared/components/navbar/navbar';
import { Footer } from './shared/components/footer/footer';
import { ScrollService } from './core/services/scroll.service';
import { CookieConsent } from './shared/components/cookie-consent/cookie-consent';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Navbar, Footer, CookieConsent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  title = 'E-commerce';

  constructor(private scrollService: ScrollService) {}

  ngOnInit(): void {
    // Inicializa o ScrollService se necessário
    // this.scrollService.init();
  }
}
