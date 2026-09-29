import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ScrollService } from '../../core/services/scroll.service';

@Component({
  selector: 'app-terms',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './terms.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./terms.scss'],
})
export class Terms implements OnInit {
  lastUpdated = '10 de Agosto de 2026';

  constructor(private scrollService: ScrollService) {}

  ngOnInit(): void {
    this.scrollService.scrollToTop('smooth');
  }
}
