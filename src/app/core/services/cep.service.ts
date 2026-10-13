// src/app/core/services/cep.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map, timeout } from 'rxjs/operators';

export interface Endereco {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  ibge: string;
  gia: string;
  ddd: string;
  siafi: string;
  erro?: boolean;
}

export interface Estado {
  id: number;
  sigla: string;
  nome: string;
  regiao?: { id: number; sigla: string; nome: string };
}

export interface Cidade {
  id: number;
  nome: string;
  microrregiao?: any;
  regiaoImediata?: any;
}

@Injectable({
  providedIn: 'root'
})
export class CepService {
  private readonly viaCepUrl = 'https://viacep.com.br/ws';
  private readonly ibgeUrl = 'https://servicodados.ibge.gov.br/api/v1/localidades';

  constructor(private http: HttpClient) {}

  // ============================================================
  // CEP (ViaCEP)
  // ============================================================
  buscarCep(cep: string): Observable<Endereco> {
    const cepLimpo = cep.replace(/\D/g, '');

    if (cepLimpo.length !== 8) {
      return throwError(() => new Error('CEP inválido. Deve conter 8 dígitos.'));
    }

    return this.http.get<Endereco>(`${this.viaCepUrl}/${cepLimpo}/json/`).pipe(
      timeout(10000),
      map((response) => {
        if (response.erro) {
          throw new Error('CEP não encontrado');
        }
        return response;
      }),
      catchError((error) => {
        console.error('❌ Erro ao buscar CEP:', error);
        return throwError(() => new Error('Erro ao buscar CEP. Tente novamente.'));
      })
    );
  }

  formatarCep(cep: string): string {
    const cepLimpo = cep.replace(/\D/g, '');
    if (cepLimpo.length <= 5) return cepLimpo;
    return cepLimpo.replace(/(\d{5})(\d{1,3})$/, '$1-$2');
  }

  validarCep(cep: string): boolean {
    const cepLimpo = cep.replace(/\D/g, '');
    return cepLimpo.length === 8;
  }

  // ============================================================
  // 🔥 ESTADOS (IBGE) — cache em memória
  // ============================================================
  private estadosCache: Estado[] | null = null;
  private cidadesCache = new Map<string, Cidade[]>();

  buscarEstados(): Observable<Estado[]> {
    if (this.estadosCache) {
      return new Observable((subscriber) => {
        subscriber.next(this.estadosCache!);
        subscriber.complete();
      });
    }

    return this.http
      .get<Estado[]>(`${this.ibgeUrl}/estados?orderBy=nome`)
      .pipe(
        timeout(10000),
        map((estados) => {
          this.estadosCache = estados;
          return estados;
        }),
        catchError((error) => {
          console.error('❌ Erro ao buscar estados:', error);
          return throwError(() => new Error('Erro ao buscar estados.'));
        })
      );
  }

  // ============================================================
  // 🔥 CIDADES POR UF (IBGE) — cache por UF
  // ============================================================
  buscarCidadesPorUF(uf: string): Observable<Cidade[]> {
    const ufUpper = uf.toUpperCase().trim();

    if (!ufUpper || ufUpper.length !== 2) {
      return throwError(() => new Error('UF inválida.'));
    }

    const cached = this.cidadesCache.get(ufUpper);
    if (cached) {
      return new Observable((subscriber) => {
        subscriber.next(cached);
        subscriber.complete();
      });
    }

    return this.http
      .get<Cidade[]>(`${this.ibgeUrl}/estados/${ufUpper}/municipios`)
      .pipe(
        timeout(10000),
        map((cidades) => {
          const sorted = cidades.sort((a, b) => a.nome.localeCompare(b.nome));
          this.cidadesCache.set(ufUpper, sorted);
          return sorted;
        }),
        catchError((error) => {
          console.error(`❌ Erro ao buscar cidades de ${ufUpper}:`, error);
          return throwError(() => new Error('Erro ao buscar cidades.'));
        })
      );
  }
}
