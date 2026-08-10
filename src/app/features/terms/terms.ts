import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-terms',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './terms.html',
  styleUrls: ['./terms.scss']
})
export class Terms {
  lastUpdated = '10 de Agosto de 2026';
}
