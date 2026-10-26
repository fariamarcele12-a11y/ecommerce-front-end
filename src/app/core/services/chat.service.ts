// src/app/core/services/chat.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, of, forkJoin, catchError, tap, map, throwError } from 'rxjs';
import { Message, ChatConversation } from '../models/message.model';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/enviroment';

@Injectable({
  providedIn: 'root',
})
export class ChatService {
  private apiUrl = `${environment.apiUrl}/messages`;

  private conversations = new BehaviorSubject<ChatConversation[]>([]);
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);

  // ============================================================
  // CONVERSAS UNIFICADAS (comprador + vendedor)
  // ============================================================
  getAllConversations(userId: number | string, isSeller: boolean): Observable<ChatConversation[]> {
    const buyerReq = this.http
      .get<Message[]>(`${this.apiUrl}/my-conversations`, { headers: this.authHeaders() })
      .pipe(catchError(() => of([])));

    const sellerReq = this.http
      .get<Message[]>(`${this.apiUrl}/seller-conversations`, { headers: this.authHeaders() })
      .pipe(catchError(() => of([])));

    // Se não for vendedor, só busca como comprador
    if (!isSeller) {
      return buyerReq.pipe(
        map((messages) => this.processMessages(messages, userId)),
        tap((convs) => this.conversations.next(convs))
      );
    }

    // Se for vendedor, busca os dois e mescla
    return forkJoin([buyerReq, sellerReq]).pipe(
      map(([buyerMessages, sellerMessages]) => {
        // Junta as duas listas e remove duplicatas pelo ID da mensagem
        const allMessages = [...buyerMessages, ...sellerMessages];
        const uniqueMessages = Array.from(new Map(allMessages.map((m) => [m.id, m])).values());
        return this.processMessages(uniqueMessages, userId);
      }),
      tap((convs) => this.conversations.next(convs)),
      catchError((error) => {
        console.warn('⚠️ Erro ao carregar conversas unificadas:', error);
        return of([]);
      })
    );
  }

  // ============================================================
  // CHAT DE UM PRODUTO (ou loja, se productId = 'empty')
  // ============================================================
  getProductChat(
    productId: number | string,
    userId: number | string,
    sellerId: number | string,
  ): Observable<Message[]> {
    const productIdParam =
      productId && productId !== 'empty' && productId !== ''
        ? productId
        : '00000000-0000-0000-0000-000000000000';

    return this.http
      .get<Message[]>(
        `${this.apiUrl}/product/${productIdParam}/chat?sellerId=${sellerId}&userId=${userId}`,
        { headers: this.authHeaders() },
      )
      .pipe(
        map((messages) => this.sortMessagesByDate(messages)),
        catchError((error) => {
          console.warn('⚠️ Erro ao carregar chat:', error);
          return of([]);
        }),
      );
  }

  // ============================================================
  // ENVIAR MENSAGEM
  // ============================================================
  sendMessage(message: Partial<Message>): Observable<Message> {
    const productId =
      message.productId && message.productId !== 'empty' && message.productId !== ''
        ? String(message.productId)
        : '00000000-0000-0000-0000-000000000000';

    const payload = {
      productId: productId,
      productName: message.productName || 'Conversa com a Loja',
      productImage: message.productImage || '',
      sellerId: String(message.sellerId || ''),
      sellerName: message.sellerName || '',
      userId: String(message.userId || ''),
      userName: message.userName || '',
      content: message.content || '',
      isFromSeller: message.isFromSeller || false,
    };

    return this.http
      .post<Message>(this.apiUrl, payload, { headers: this.authHeaders() })
      .pipe(
        tap(() => {
          const user = this.authService.getCurrentUser();
          if (user) {
            const isSeller = user.hasStore === true;
            this.getAllConversations(user.id, isSeller).subscribe();
          }
        }),
        catchError((error) => {
          console.error('❌ Erro ao enviar mensagem:', error);
          return throwError(() => new Error('Erro ao enviar mensagem.'));
        }),
      );
  }

  // ============================================================
  // MARCAR MENSAGEM COMO LIDA
  // ============================================================
  markAsRead(messageId: number | string): Observable<void> {
    return this.http
      .patch<void>(`${this.apiUrl}/${messageId}/read`, {}, { headers: this.authHeaders() })
      .pipe(
        catchError((error) => {
          console.warn('⚠️ Erro ao marcar mensagem como lida:', error);
          return of(void 0);
        }),
      );
  }

  // ============================================================
  // MARCAR CONVERSA COMO LIDA
  // ============================================================
  markConversationAsRead(
    productId: number | string,
    userId: number | string,
    sellerId: number | string,
  ): Observable<void> {
    return this.getProductChat(productId, userId, sellerId).pipe(
      tap((messages) => {
        messages.forEach((msg) => {
          if (!msg.read) {
            this.markAsRead(msg.id).subscribe();
          }
        });
      }),
      map(() => void 0),
      catchError((error) => {
        console.warn('⚠️ Erro ao marcar conversa como lida:', error);
        return of(void 0);
      }),
    );
  }

  // ============================================================
  // NÃO LIDAS
  // ============================================================
  getUnreadCount(userId: number | string): Observable<number> {
    return this.http
      .get<{ count: number }>(`${this.apiUrl}/unread-count`, { headers: this.authHeaders() })
      .pipe(
        map((res) => res.count || 0),
        catchError(() => of(0)),
      );
  }

  // ============================================================
  // Helpers
  // ============================================================
  private sortMessagesByDate(messages: Message[]): Message[] {
    if (!messages?.length) return [];
    return [...messages].sort((a, b) => {
      const dateA = this.parseDate(a.createdAt);
      const dateB = this.parseDate(b.createdAt);
      if (dateA === null && dateB === null) return 0;
      if (dateA === null) return -1;
      if (dateB === null) return 1;
      return dateA - dateB;
    });
  }

  private parseDate(date: Date | string | undefined | null): number | null {
    if (!date) return null;
    if (date instanceof Date) {
      const t = date.getTime();
      return isNaN(t) ? null : t;
    }
    if (typeof date === 'string') {
      let safe = date;
      if (!safe.endsWith('Z') && !/[+-]\d{2}:\d{2}$/.test(safe)) safe += 'Z';
      const t = new Date(safe).getTime();
      return isNaN(t) ? null : t;
    }
    return null;
  }

  // 🔥 Chave única: productId + userId + sellerId
  private groupMessages(messages: Message[]): Map<string, Message[]> {
    const grouped = new Map<string, Message[]>();
    messages.forEach((msg) => {
      const key = `${msg.productId}_${msg.userId}_${msg.sellerId}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(msg);
    });
    return grouped;
  }

  private processMessages(messages: Message[], currentUserId: string | number): ChatConversation[] {
    const sorted = this.sortMessagesByDate(messages);
    const grouped = this.groupMessages(sorted);
    return this.buildConversations(grouped, String(currentUserId));
  }

  private buildConversations(
    grouped: Map<string, Message[]>,
    currentUserId: string,
  ): ChatConversation[] {
    const conversations: ChatConversation[] = [];

    grouped.forEach((messages) => {
      const sortedMessages = this.sortMessagesByDate(messages);
      const lastMessage = sortedMessages[sortedMessages.length - 1];
      const firstMessage = sortedMessages[0];
      const messageWithImage = sortedMessages.find(
        (m) => m.productImage && m.productImage.trim() !== '',
      );

      const productImage =
        messageWithImage?.productImage ||
        firstMessage.productImage ||
        'https://via.placeholder.com/100x100/667eea/ffffff?text=Produto';

      // 🔥 Lógica de quem é o vendedor nesta conversa específica
      const isSellerOfThisChat = currentUserId === String(firstMessage.sellerId);

      // Se eu sou o vendedor, exibo o nome do cliente. Senão, exibo o nome da loja.
      const displayName = isSellerOfThisChat
        ? firstMessage.userName || 'Cliente'
        : firstMessage.sellerName || 'Vendedor';

      conversations.push({
        productId: firstMessage.productId,
        productName: firstMessage.productName || 'Produto',
        productImage,
        sellerId: String(firstMessage.sellerId || ''),
        sellerName: firstMessage.sellerName || 'Vendedor',
        buyerId: String(firstMessage.userId || ''),
        buyerName: firstMessage.userName || 'Cliente',
        displayName,
        lastMessage: lastMessage.content,
        lastMessageDate: lastMessage.createdAt,
        unreadCount: sortedMessages.filter(
          (m) => !m.read && (isSellerOfThisChat ? m.isFromSeller === false : m.isFromSeller === true),
        ).length,
        messages: sortedMessages,
      } as ChatConversation);
    });

    return conversations.sort((a, b) => {
      const dateA = this.parseDate(a.lastMessageDate) || 0;
      const dateB = this.parseDate(b.lastMessageDate) || 0;
      return dateB - dateA;
    });
  }

  private authHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return new HttpHeaders({
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    });
  }
}