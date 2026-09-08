// src/app/shared/components/cookie-consent/cookie-consent.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CookieService, CookieConsentSettings } from '../../../core/services/cookie.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-cookie-consent',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './cookie-consent.html',
  styleUrls: ['./cookie-consent.scss']
})
export class CookieConsent implements OnInit, OnDestroy {
  showBanner = false;
  showPreferences = false;

  // 🔥 Usando CookieConsentSettings em vez de CookieConsent
  consent: CookieConsentSettings = {
    necessary: true,
    preferences: false,
    analytics: false,
    marketing: false,
    accepted: false
  };

  private subscriptions: Subscription = new Subscription();

  constructor(private cookieService: CookieService) {}

  ngOnInit(): void {
    const existingConsent = this.cookieService.getConsent();

    if (!existingConsent || !existingConsent.accepted) {
      this.showBanner = true;
      this.consent = {
        necessary: true,
        preferences: false,
        analytics: false,
        marketing: false,
        accepted: false
      };
    } else {
      this.consent = existingConsent;
      this.showBanner = false;
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  /**
   * 🔥 Aceita todos os cookies
   */
  acceptAll(): void {
    this.cookieService.acceptAll();
    this.showBanner = false;
    this.showPreferences = false;
  }

  /**
   * 🔥 Recusa todos os cookies (exceto necessários)
   */
  rejectAll(): void {
    this.cookieService.rejectAll();
    this.showBanner = false;
    this.showPreferences = false;
  }

  /**
   * 🔥 Salva preferências personalizadas
   */
  savePreferences(): void {
    this.cookieService.savePreferences(this.consent);
    this.showBanner = false;
    this.showPreferences = false;
  }

  /**
   * 🔥 Abre o modal de preferências
   */
  openPreferences(): void {
    const currentConsent = this.cookieService.getConsent();
    if (currentConsent) {
      this.consent = currentConsent;
    }
    this.showPreferences = true;
  }

  /**
   * 🔥 Fecha o modal de preferências
   */
  closePreferences(): void {
    this.showPreferences = false;
  }

  /**
   * 🔥 Verifica se o cookie de uma categoria é permitido
   */
  isCategoryAllowed(category: 'necessary' | 'preferences' | 'analytics' | 'marketing'): boolean {
    return this.cookieService.isCategoryAllowed(category);
  }
}
