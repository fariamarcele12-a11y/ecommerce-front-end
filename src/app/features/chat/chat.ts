import { Component, OnInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { ChatConversation, Message } from '../../core/models/message.model';
import { ChatService } from '../../core/services/chat.service';
import { AlertService } from '../../core/services/alert.service';

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
  userId = 1;
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
    private alertService: AlertService
  ) {}

  ngOnInit(): void {
    this.routeSub = this.route.queryParams.subscribe(params => {
      this.productIdParam = params['productId'] ? +params['productId'] : null;
      this.sellerIdParam = params['sellerId'] ? +params['sellerId'] : null;
      this.productNameParam = params['productName'] || null;
      this.sellerNameParam = params['sellerName'] || null;
      this.isStoreChat = params['store'] === 'true';

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
    this.chatSub = (this.isSeller
      ? this.chatService.getSellerConversations(this.userId)
      : this.chatService.getConversations(this.userId)
    ).subscribe({
      next: (conversations: ChatConversation[]) => {
        this.conversations = conversations;
        this.loading = false;
        console.log('💬 Conversas carregadas:', conversations);
      },
      error: (error: Error) => {
        console.error('❌ Erro ao carregar conversas:', error);
        this.loading = false;
        this.conversations = [];
      }
    });
  }

  loadProductChat(productId: number, sellerId: number): void {
    this.loading = true;
    this.chatService.getProductChat(productId, this.userId, sellerId).subscribe({
      next: (messages: Message[]) => {
        this.messages = messages;
        this.loading = false;

        // Usar o nome do produto da URL ou do banco
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
          messages: messages || []
        };

        this.scrollToBottom();
        console.log('💬 Chat do produto carregado:', { productName, sellerName });
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
          messages: []
        };
      }
    });
  }

  loadStoreChat(sellerId: number): void {
    this.loading = true;
    const sellerName = this.sellerNameParam || 'Vendedor';
    
    // Buscar conversas da loja (por enquanto, criar uma conversa genérica)
    this.selectedConversation = {
      productId: 0,
      productName: 'Conversa com a Loja',
      productImage: 'https://via.placeholder.com/100x100/667eea/ffffff?text=Loja',
      sellerId: sellerId,
      sellerName: sellerName,
      lastMessage: '',
      lastMessageDate: new Date(),
      unreadCount: 0,
      messages: []
    };
    
    this.messages = [];
    this.loading = false;
    this.scrollToBottom();
    console.log('💬 Chat da loja iniciado:', { sellerName });
  }

  selectConversation(conversation: ChatConversation): void {
    this.selectedConversation = conversation;
    this.messages = conversation.messages || [];

    this.chatService.markConversationAsRead(
      conversation.productId,
      this.userId,
      conversation.sellerId
    ).subscribe();

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
      userName: 'Jocimar Galante',
      content: this.newMessage.trim(),
      isFromSeller: this.isSeller
    };

    // Adicionar mensagem localmente
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

    this.chatService.sendMessage(message).subscribe({
      next: (sentMessage: Message) => {
        const index = this.messages.findIndex(m => m.id === tempMessage.id);
        if (index !== -1) {
          this.messages[index] = sentMessage;
        }
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

  formatDate(date: Date): string {
    if (!date) return '';
    const now = new Date();
    const msgDate = new Date(date);
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
}