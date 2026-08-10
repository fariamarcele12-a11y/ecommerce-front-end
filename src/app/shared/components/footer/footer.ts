import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { ScrollService } from '../../../core/services/scroll.service';

@Component({
  selector: 'app-footer',
  imports: [CommonModule, RouterLink],
  templateUrl: './footer.html',
  styleUrl: './footer.scss',
})
export class Footer {
  constructor(private scrollService: ScrollService) {}

  scrollToTop(): void {
    this.scrollService.scrollToTop('smooth');
  }
}
