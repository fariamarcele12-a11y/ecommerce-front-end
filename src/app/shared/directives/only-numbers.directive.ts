import { Directive, ElementRef, HostListener } from '@angular/core';

@Directive({
  selector: '[appOnlyNumbers]',
  standalone: true
})
export class OnlyNumbersDirective {
  constructor(private el: ElementRef) {}

  @HostListener('input', ['$event'])
  onInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    // Remove tudo que não for número
    input.value = input.value.replace(/\D/g, '');
  }

  @HostListener('keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    // Permite: backspace, delete, tab, escape, enter, setas, etc.
    const allowedKeys = [
      'Backspace', 'Delete', 'Tab', 'Escape', 'Enter',
      'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
      'Home', 'End'
    ];
    
    if (allowedKeys.includes(event.key)) {
      return;
    }

    // Permite Ctrl+C, Ctrl+V, Ctrl+A
    if (event.ctrlKey && ['c', 'v', 'a'].includes(event.key.toLowerCase())) {
      return;
    }

    // Impede qualquer caractere que não seja número
    if (!/^[0-9]$/.test(event.key)) {
      event.preventDefault();
    }
  }

  @HostListener('paste', ['$event'])
  onPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const pastedText = event.clipboardData?.getData('text') || '';
    const numbersOnly = pastedText.replace(/\D/g, '');
    const input = this.el.nativeElement as HTMLInputElement;
    input.value = numbersOnly;
    input.dispatchEvent(new Event('input'));
  }
}