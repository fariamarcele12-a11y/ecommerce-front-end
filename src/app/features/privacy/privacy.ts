import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ScrollService } from '../../core/services/scroll.service';

@Component({
  selector: 'app-privacy',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './privacy.html',
  styleUrls: ['./privacy.scss'],
})
export class Privacy implements OnInit {
  lastUpdated = '10 de Agosto de 2026';

  constructor(private scrollService: ScrollService) {}

  ngOnInit(): void {
    this.scrollService.scrollToTop('smooth');
  }
}
