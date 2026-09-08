// src/app/core/services/chat.service.ts
import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of, throwError, catchError, tap, map } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';
import { Message, ChatConversation } from '../models/message.model';
import { IdGeneratorService } from './id-generator.service';

@Injectable({
  providedIn: 'root',
})
export class ChatService {
  private apiUrl = 'http://localhost:3000/messages';

  private conversations = new BehaviorSubject<ChatConversation[]>([]);
  private isBrowser: boolean;
  private readonly http = inject(HttpClient);
  private readonly idGenerator = inject(IdGeneratorService);

  constructor() {
    const platformId = inject(PLATFORM_ID);
    this.isBrowser = isPlatformBrowser(platformId);
  }

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
      }),
    );
  }

  getSellerConversations(sellerId: number | string): Observable<ChatConversation[]> {
    const id = String(sellerId);
    return this.http
      .get<Message[]>(`${this.apiUrl}?sellerId=${id}&_sort=createdAt&_order=desc`)
      .pipe(
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
        }),
      );
  }

  getProductMessages(productId: number | string, userId: number | string): Observable<Message[]> {
    const productIdStr = String(productId);
    const userIdStr = String(userId);
    return this.http
      .get<
        Message[]
      >(`${this.apiUrl}?productId=${productIdStr}&userId=${userIdStr}&_sort=createdAt&_order=asc`)
      .pipe(
        catchError((error) => {
          console.warn('⚠️ Erro ao carregar mensagens do produto:', error);
          return of([]);
        }),
      );
  }

  getProductChat(
    productId: number | string,
    userId: number | string,
    sellerId: number | string,
  ): Observable<Message[]> {
    const productIdStr = String(productId);
    const userIdStr = String(userId);
    const sellerIdStr = String(sellerId);

    return this.http
      .get<
        Message[]
      >(`${this.apiUrl}?productId=${productIdStr}&userId=${userIdStr}&sellerId=${sellerIdStr}&_sort=createdAt&_order=asc`)
      .pipe(
        tap((messages) => {
          messages.forEach((msg) => {
            if (!msg.read && msg.sellerId === sellerId) {
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
        }),
      );
  }

  /**
   * 🔥 Envia uma nova mensagem com ID único
   */
  sendMessage(message: Partial<Message>): Observable<Message> {
    const newMessage: Message = {
      id: this.idGenerator.generateMessageId(), // 🔥 ID único
      productId: String(message.productId || ''),
      productName: message.productName || '',
      sellerId: message.sellerId || '',
      sellerName: message.sellerName || '',
      userId: message.userId || '',
      userName: message.userName || '',
      content: message.content || '',
      createdAt: new Date(),
      read: false,
      isFromSeller: message.isFromSeller || false,
      ...message,
    };

    return this.http.post<Message>(this.apiUrl, newMessage).pipe(
      tap(() => {
        if (newMessage.userId) {
          const userId =
            typeof newMessage.userId === 'string'
              ? parseInt(String(newMessage.userId), 10)
              : (newMessage.userId as number);
          if (!isNaN(userId)) {
            this.refreshConversations(userId);
          }
        }
      }),
      catchError((error) => {
        console.error('❌ Erro ao enviar mensagem:', error);
        return throwError(() => new Error('Erro ao enviar mensagem.'));
      }),
    );
  }

  markAsRead(messageId: number | string): Observable<Message> {
    const id = String(messageId);
    return this.http.patch<Message>(`${this.apiUrl}/${id}`, { read: true }).pipe(
      catchError((error) => {
        console.warn('⚠️ Erro ao marcar mensagem como lida:', error);
        return of({} as Message);
      }),
    );
  }

  markConversationAsRead(
    productId: number | string,
    userId: number | string,
    sellerId: number | string,
  ): Observable<void> {
    const productIdStr = String(productId);
    const userIdStr = String(userId);
    const sellerIdStr = String(sellerId);

    return this.http
      .get<
        Message[]
      >(`${this.apiUrl}?productId=${productIdStr}&userId=${userIdStr}&sellerId=${sellerIdStr}&read=false`)
      .pipe(
        map((messages) => {
          messages.forEach((msg) => {
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
        }),
      );
  }

  getUnreadCount(userId: number | string): Observable<number> {
    const id = String(userId);
    return this.http.get<Message[]>(`${this.apiUrl}?userId=${id}&read=false`).pipe(
      map((messages) => messages.length),
      catchError((error) => {
        console.warn('⚠️ Erro ao buscar mensagens não lidas:', error);
        return of(0);
      }),
    );
  }

  private groupMessagesByProduct(messages: Message[]): Map<string, Message[]> {
    const grouped = new Map<string, Message[]>();
    messages.forEach((msg) => {
      const key = String(msg.productId);
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(msg);
    });
    return grouped;
  }

  private buildConversations(grouped: Map<string, Message[]>): ChatConversation[] {
    const conversations: ChatConversation[] = [];
    grouped.forEach((messages, productId) => {
      const lastMessage = messages[messages.length - 1];
      const firstMessage = messages[0];

      // 🔥 CORRIGIDO: productId como string
      conversations.push({
        productId: productId, // 🔥 Manter como string
        productName: firstMessage.productName || 'Produto',
        productImage: 'https://picsum.photos/seed/' + productId + '/100/100',
        sellerId: String(firstMessage.sellerId || ''),
        sellerName: firstMessage.sellerName || 'Vendedor',
        lastMessage: lastMessage.content,
        lastMessageDate: lastMessage.createdAt,
        unreadCount: messages.filter((m) => !m.read && m.sellerId === firstMessage.sellerId).length,
        messages: messages,
      });
    });
    return conversations;
  }

  private refreshConversations(userId: number | string): void {
    this.getConversations(userId).subscribe();
  }
}
