// src/app/features/chat/chat.ts
import { Component, OnInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { ChatService } from '../../core/services/chat.service';
import { AlertService } from '../../core/services/alert.service';
import { AuthService } from '../../core/services/auth.service';
import { ChatConversation, Message } from '../../core/models/message.model';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './chat.html',
  styleUrls: ['./chat.scss']
})
export class Chat implements OnInit, OnDestroy {
  @ViewChild('messagesContainer') messagesContainer!: ElementRef;

  conversations: ChatConversation[] = [];
  messages: Message[] = [];
  selectedConversation: ChatConversation | null = null;
  newMessage = '';
  loading = true;
  userId: number = 0;
  userName: string = '';
  isSeller = false;

  // Parâmetros recebidos da URL
  private productIdParam: number | null = null;
  private sellerIdParam: number | null = null;
  private productNameParam: string | null = null;
  private sellerNameParam: string | null = null;
  private isStoreChat: boolean = false;

  private routeSub: Subscription = new Subscription();
  private chatSub: Subscription = new Subscription();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private chatService: ChatService,
    private alertService: AlertService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    // 🔥 Buscar usuário logado
    const user = this.authService.getCurrentUser();
    if (!user) {
      this.alertService.warning('Login necessário', 'Faça login para acessar o chat.');
      this.router.navigate(['/login']);
      return;
    }

    this.userId = typeof user.id === 'string' ? parseInt(user.id, 10) : user.id;
    this.userName = user.name || 'Usuário';

    this.routeSub = this.route.queryParams.subscribe(params => {
      this.productIdParam = params['productId'] ? +params['productId'] : null;
      this.sellerIdParam = params['sellerId'] ? +params['sellerId'] : null;
      this.productNameParam = params['productName'] || null;
      this.sellerNameParam = params['sellerName'] || null;
      this.isStoreChat = params['store'] === 'true';

      console.log('📋 Parâmetros do chat:', {
        productId: this.productIdParam,
        sellerId: this.sellerIdParam,
        productName: this.productNameParam,
        sellerName: this.sellerNameParam,
        isStoreChat: this.isStoreChat
      });

      if (this.productIdParam && this.sellerIdParam) {
        this.loadProductChat(this.productIdParam, this.sellerIdParam);
      } else if (this.sellerIdParam && this.isStoreChat) {
        this.loadStoreChat(this.sellerIdParam);
      } else {
        this.loadConversations();
      }
    });
  }

  ngOnDestroy(): void {
    this.routeSub.unsubscribe();
    this.chatSub.unsubscribe();
  }

  loadConversations(): void {
    this.loading = true;
    const observable = this.isSeller
      ? this.chatService.getSellerConversations(this.userId)
      : this.chatService.getConversations(this.userId);

    this.chatSub = observable.subscribe({
      next: (conversations: ChatConversation[]) => {
        this.conversations = conversations;
        this.loading = false;
        console.log('💬 Conversas carregadas:', conversations.length);
      },
      error: (error: Error) => {
        console.error('❌ Erro ao carregar conversas:', error);
        this.loading = false;
        this.conversations = [];
        this.alertService.error('Erro', 'Não foi possível carregar as conversas.');
      }
    });
  }

  loadProductChat(productId: number, sellerId: number): void {
    this.loading = true;
    this.chatService.getProductChat(productId, this.userId, sellerId).subscribe({
      next: (messages: Message[]) => {
        this.messages = messages;
        this.loading = false;

        const productName = this.productNameParam || (messages.length > 0 ? messages[0].productName : 'Produto');
        const sellerName = this.sellerNameParam || (messages.length > 0 ? messages[0].sellerName : 'Vendedor');

        this.selectedConversation = {
          productId: productId,
          productName: productName,
          productImage: 'https://picsum.photos/seed/' + productId + '/100/100',
          sellerId: sellerId,
          sellerName: sellerName,
          lastMessage: messages.length > 0 ? messages[messages.length - 1]?.content || '' : '',
          lastMessageDate: messages.length > 0 ? messages[messages.length - 1]?.createdAt || new Date() : new Date(),
          unreadCount: 0,
          messages: messages || [],
          isStoreChat: false
        };

        this.scrollToBottom();
        console.log('💬 Chat do produto carregado:', { productName, sellerName, messages: messages.length });
      },
      error: (error: Error) => {
        console.error('❌ Erro ao carregar mensagens:', error);
        this.loading = false;
        this.messages = [];

        const productName = this.productNameParam || 'Produto';
        const sellerName = this.sellerNameParam || 'Vendedor';

        this.selectedConversation = {
          productId: productId,
          productName: productName,
          productImage: 'https://picsum.photos/seed/' + productId + '/100/100',
          sellerId: sellerId,
          sellerName: sellerName,
          lastMessage: '',
          lastMessageDate: new Date(),
          unreadCount: 0,
          messages: [],
          isStoreChat: false
        };
      }
    });
  }

  loadStoreChat(sellerId: number): void {
    this.loading = true;
    const sellerName = this.sellerNameParam || 'Vendedor';

    this.selectedConversation = {
      productId: 0,
      productName: 'Conversa com a Loja',
      productImage: 'https://via.placeholder.com/100x100/667eea/ffffff?text=Loja',
      sellerId: sellerId,
      sellerName: sellerName,
      lastMessage: '',
      lastMessageDate: new Date(),
      unreadCount: 0,
      messages: [],
      isStoreChat: true
    };

    this.messages = [];
    this.loading = false;
    this.scrollToBottom();
    console.log('💬 Chat da loja iniciado:', { sellerName });
  }

  selectConversation(conversation: ChatConversation): void {
    this.selectedConversation = conversation;
    this.messages = conversation.messages || [];

    // 🔥 Marcar como lida
    this.chatService.markConversationAsRead(
      conversation.productId,
      this.userId,
      conversation.sellerId
    ).subscribe({
      next: () => {
        // Atualizar contador de não lidas
        if (this.selectedConversation) {
          this.selectedConversation.unreadCount = 0;
        }
      },
      error: (error) => {
        console.error('❌ Erro ao marcar conversa como lida:', error);
      }
    });

    this.scrollToBottom();
  }

  sendMessage(): void {
    if (!this.newMessage.trim() || !this.selectedConversation) return;

    const message: Partial<Message> = {
      productId: this.selectedConversation.productId || 0,
      productName: this.selectedConversation.productName || 'Conversa com a Loja',
      sellerId: this.selectedConversation.sellerId,
      sellerName: this.selectedConversation.sellerName,
      userId: this.userId,
      userName: this.userName,
      content: this.newMessage.trim(),
      isFromSeller: this.isSeller
    };

    // 🔥 Mensagem temporária (otimista)
    const tempMessage: Message = {
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
      isFromSeller: message.isFromSeller || false
    };

    this.messages.push(tempMessage);
    this.newMessage = '';
    this.scrollToBottom();

    // 🔥 Enviar para o servidor
    this.chatService.sendMessage(message).subscribe({
      next: (sentMessage: Message) => {
        const index = this.messages.findIndex(m => m.id === tempMessage.id);
        if (index !== -1) {
          this.messages[index] = sentMessage;
        }
        // 🔥 Atualizar lista de conversas
        this.loadConversations();
      },
      error: (error: Error) => {
        console.error('❌ Erro ao enviar mensagem:', error);
        const index = this.messages.findIndex(m => m.id === tempMessage.id);
        if (index !== -1) {
          this.messages[index] = {
            ...this.messages[index],
            content: this.messages[index].content + ' ⚠️'
          };
        }
        this.alertService.warning('Aviso', 'Mensagem enviada localmente. Verifique sua conexão.');
      }
    });
  }

  scrollToBottom(): void {
    setTimeout(() => {
      if (this.messagesContainer) {
        this.messagesContainer.nativeElement.scrollTop =
          this.messagesContainer.nativeElement.scrollHeight;
      }
    }, 100);
  }

  formatDate(date: Date | string): string {
    if (!date) return '';
    const msgDate = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diff = now.getTime() - msgDate.getTime();
    const hours = diff / (1000 * 60 * 60);

    if (hours < 24) {
      return msgDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } else if (hours < 48) {
      return 'Ontem';
    } else {
      return msgDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    }
  }

  getInitials(name: string): string {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  isProductChat(): boolean {
    return this.selectedConversation?.productId !== 0 && !this.selectedConversation?.isStoreChat;
  }

  isStoreChatType(): boolean {
    return this.selectedConversation?.isStoreChat === true;
  }

  /**
   * 🔥 Obtém o ID do produto da conversa selecionada
   */
  getProductId(): number {
    const id = this.selectedConversation?.productId;
    return typeof id === 'string' ? parseInt(id, 10) : (id || 0);
  }

  /**
   * 🔥 Obtém o ID do vendedor da conversa selecionada
   */
  getSellerId(): number {
    const id = this.selectedConversation?.sellerId;
    return typeof id === 'string' ? parseInt(id, 10) : (id || 0);
  }
}
