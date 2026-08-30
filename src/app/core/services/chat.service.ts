// src/app/core/services/chat.service.ts
import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of, throwError, catchError, tap, map } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';
import { Message, ChatConversation } from '../models/message.model';

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  // 🔥 URL da API local apenas
  private apiUrl = 'http://localhost:3000/messages';

  private conversations = new BehaviorSubject<ChatConversation[]>([]);
  private isBrowser: boolean;
  private readonly http = inject(HttpClient);

  constructor() {
    const platformId = inject(PLATFORM_ID);
    this.isBrowser = isPlatformBrowser(platformId);
  }

  /**
   * Busca todas as conversas do usuário
   */
  getConversations(userId: number | string): Observable<ChatConversation[]> {
    const id = String(userId);
    return this.http.get<Message[]>(`${this.apiUrl}?userId=${id}&_sort=createdAt&_order=desc`).pipe(
      map((messages) => {
        const grouped = this.groupMessagesByProduct(messages);
        return this.buildConversations(grouped);
      }),
      tap((conversations) => {
        this.conversations.next(conversations);
      }),
      catchError((error) => {
        console.warn('⚠️ Erro ao carregar conversas, retornando array vazio:', error);
        return of([]);
      })
    );
  }

  /**
   * Busca conversas do vendedor
   */
  getSellerConversations(sellerId: number | string): Observable<ChatConversation[]> {
    const id = String(sellerId);
    return this.http.get<Message[]>(`${this.apiUrl}?sellerId=${id}&_sort=createdAt&_order=desc`).pipe(
      map((messages) => {
        const grouped = this.groupMessagesByProduct(messages);
        return this.buildConversations(grouped);
      }),
      tap((conversations) => {
        this.conversations.next(conversations);
      }),
      catchError((error) => {
        console.warn('⚠️ Erro ao carregar conversas do vendedor:', error);
        return of([]);
      })
    );
  }

  /**
   * Busca mensagens de um produto específico
   */
  getProductMessages(productId: number | string, userId: number | string): Observable<Message[]> {
    const productIdStr = String(productId);
    const userIdStr = String(userId);
    return this.http.get<Message[]>(
      `${this.apiUrl}?productId=${productIdStr}&userId=${userIdStr}&_sort=createdAt&_order=asc`
    ).pipe(
      catchError((error) => {
        console.warn('⚠️ Erro ao carregar mensagens do produto:', error);
        return of([]);
      })
    );
  }

  /**
   * Busca mensagens entre usuário e vendedor para um produto
   */
  getProductChat(productId: number | string, userId: number | string, sellerId: number | string): Observable<Message[]> {
    const productIdStr = String(productId);
    const userIdStr = String(userId);
    const sellerIdStr = String(sellerId);

    return this.http.get<Message[]>(
      `${this.apiUrl}?productId=${productIdStr}&userId=${userIdStr}&sellerId=${sellerIdStr}&_sort=createdAt&_order=asc`
    ).pipe(
      tap((messages) => {
        messages.forEach(msg => {
          if (!msg.read && msg.sellerId === sellerId) {
            // 🔥 Converter para número antes de chamar
            const msgId = typeof msg.id === 'string' ? parseInt(msg.id, 10) : (msg.id as number);
            if (!isNaN(msgId)) {
              this.markAsRead(msgId).subscribe();
            }
          }
        });
      }),
      catchError((error) => {
        console.warn('⚠️ Erro ao carregar chat do produto:', error);
        return of([]);
      })
    );
  }

  /**
   * Envia uma nova mensagem
   */
  sendMessage(message: Partial<Message>): Observable<Message> {
    const newMessage: Message = {
      id: Date.now(),
      productId: message.productId!,
      productName: message.productName || '',
      sellerId: message.sellerId!,
      sellerName: message.sellerName || '',
      userId: message.userId!,
      userName: message.userName || '',
      content: message.content!,
      createdAt: new Date(),
      read: false,
      isFromSeller: message.isFromSeller || false,
      ...message
    };

    return this.http.post<Message>(this.apiUrl, newMessage).pipe(
      tap(() => {
        if (newMessage.userId) {
          // 🔥 Converter para número antes de chamar
          const userId = typeof newMessage.userId === 'string' ? parseInt(String(newMessage.userId), 10) : (newMessage.userId as number);
          if (!isNaN(userId)) {
            this.refreshConversations(userId);
          }
        }
      }),
      catchError((error) => {
        console.error('❌ Erro ao enviar mensagem:', error);
        return throwError(() => new Error('Erro ao enviar mensagem.'));
      })
    );
  }

  /**
   * Marca uma mensagem como lida
   */
  markAsRead(messageId: number | string): Observable<Message> {
    const id = String(messageId);
    return this.http.patch<Message>(`${this.apiUrl}/${id}`, { read: true }).pipe(
      catchError((error) => {
        console.warn('⚠️ Erro ao marcar mensagem como lida:', error);
        return of({} as Message);
      })
    );
  }

  /**
   * Marca todas as mensagens de uma conversa como lidas
   */
  markConversationAsRead(productId: number | string, userId: number | string, sellerId: number | string): Observable<void> {
    const productIdStr = String(productId);
    const userIdStr = String(userId);
    const sellerIdStr = String(sellerId);

    return this.http.get<Message[]>(
      `${this.apiUrl}?productId=${productIdStr}&userId=${userIdStr}&sellerId=${sellerIdStr}&read=false`
    ).pipe(
      map((messages) => {
        messages.forEach(msg => {
          if (!msg.read && msg.sellerId === sellerId) {
            const msgId = typeof msg.id === 'string' ? parseInt(msg.id, 10) : (msg.id as number);
            if (!isNaN(msgId)) {
              this.markAsRead(msgId).subscribe();
            }
          }
        });
        return;
      }),
      catchError((error) => {
        console.warn('⚠️ Erro ao marcar conversa como lida:', error);
        return of(undefined);
      })
    );
  }

  /**
   * Obtém o número de mensagens não lidas
   */
  getUnreadCount(userId: number | string): Observable<number> {
    const id = String(userId);
    return this.http.get<Message[]>(`${this.apiUrl}?userId=${id}&read=false`).pipe(
      map((messages) => messages.length),
      catchError((error) => {
        console.warn('⚠️ Erro ao buscar mensagens não lidas:', error);
        return of(0);
      })
    );
  }

  /**
   * 🔥 Agrupa mensagens por produto - USANDO string como chave
   */
  private groupMessagesByProduct(messages: Message[]): Map<string, Message[]> {
    const grouped = new Map<string, Message[]>();
    messages.forEach(msg => {
      const key = String(msg.productId);
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(msg);
    });
    return grouped;
  }

  /**
   * 🔥 Constrói objetos de conversa a partir das mensagens agrupadas
   */
  private buildConversations(grouped: Map<string, Message[]>): ChatConversation[] {
    const conversations: ChatConversation[] = [];
    grouped.forEach((messages, productId) => {
      const lastMessage = messages[messages.length - 1];
      const firstMessage = messages[0];

      // 🔥 Converter productId para número
      const productIdNum = parseInt(productId, 10);

      // 🔥 Converter sellerId para número
      const sellerIdNum = typeof firstMessage.sellerId === 'string'
        ? parseInt(firstMessage.sellerId as string, 10)
        : (firstMessage.sellerId as number);

      conversations.push({
        productId: isNaN(productIdNum) ? 0 : productIdNum,
        productName: firstMessage.productName || 'Produto',
        productImage: 'https://picsum.photos/seed/' + productId + '/100/100',
        sellerId: isNaN(sellerIdNum) ? 0 : sellerIdNum,
        sellerName: firstMessage.sellerName || 'Vendedor',
        lastMessage: lastMessage.content,
        lastMessageDate: lastMessage.createdAt,
        unreadCount: messages.filter(m => !m.read && m.sellerId === firstMessage.sellerId).length,
        messages: messages
      });
    });
    return conversations;
  }

  /**
   * Atualiza as conversas
   */
  private refreshConversations(userId: number | string): void {
    this.getConversations(userId).subscribe();
  }
}
