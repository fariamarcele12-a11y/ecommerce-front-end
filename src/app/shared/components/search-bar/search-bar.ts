import { Component, EventEmitter, Output, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  selector: 'app-search-bar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './search-bar.html',
  styleUrls: ['./search-bar.scss']
})
export class SearchBar {
  @Input() placeholder: string = 'Buscar produtos, marcas e vendedores...';
  @Output() search = new EventEmitter<string>();

  searchTerm: string = '';
  isFocused: boolean = false;
  suggestions: string[] = [];
  showSuggestions: boolean = false;

  constructor(private router: Router) {}

  onSearch(): void {
    if (this.searchTerm.trim()) {
      this.search.emit(this.searchTerm);
      this.router.navigate(['/busca'], {
        queryParams: { q: this.searchTerm }
      });
      this.showSuggestions = false;
    }
  }

  onKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      this.onSearch();
    }
  }

  onFocus(): void {
    this.isFocused = true;
    this.showSuggestions = true;
    this.loadSuggestions();
  }

  onBlur(): void {
    setTimeout(() => {
      this.isFocused = false;
      this.showSuggestions = false;
    }, 200);
  }

  loadSuggestions(): void {
    const allSuggestions = [
      'iPhone', 'Samsung', 'Notebook', 'Camiseta', 'Tênis',
      'Sofá', 'Bicicleta', 'TV', 'Fone de ouvido', 'Monitor'
    ];
    this.suggestions = allSuggestions.filter(s =>
      s.toLowerCase().includes(this.searchTerm.toLowerCase())
    ).slice(0, 5);
  }

  selectSuggestion(suggestion: string): void {
    this.searchTerm = suggestion;
    this.onSearch();
  }
}
