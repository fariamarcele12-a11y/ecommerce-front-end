// src/app/core/models/message.model.ts

/**
 * 🔥 Interface para uma mensagem individual
 */
export interface Message {
  /** ID único da mensagem (gerado pelo servidor) */
  id: string; // 🔥 Mudado para string

  /** ID do produto relacionado à conversa */
  productId: string; // 🔥 Mudado para string

  /** Nome do produto para exibição */
  productName: string;

  /** URL da imagem do produto */
  productImage?: string;

  /** ID do vendedor (dono do produto) */
  sellerId: string | number;

  /** Nome do vendedor para exibição */
  sellerName: string;

  /** ID do usuário que enviou a mensagem */
  userId: string | number;

  /** Nome do usuário para exibição */
  userName: string;

  /** Conteúdo da mensagem */
  content: string;

  /** Data de criação da mensagem */
  createdAt: Date | string;

  /** Indica se a mensagem foi lida */
  read: boolean;

  /** Indica se a mensagem foi enviada pelo vendedor */
  isFromSeller: boolean;

  /** Data de leitura da mensagem (opcional) */
  readAt?: Date | string;

  /** ID da conversa (opcional, para agrupamento) */
  conversationId?: string;
}

/**
 * 🔥 Interface para uma conversa (agrupamento de mensagens)
 */
export interface ChatConversation {
  /** ID do produto da conversa */
  productId: string; // 🔥 Mudado para string

  /** Nome do produto para exibição */
  productName: string;

  /** URL da imagem do produto */
  productImage: string;

  /** ID do vendedor */
  sellerId: string | number;

  /** Nome do vendedor para exibição */
  sellerName: string;

  /** Última mensagem da conversa (resumo) */
  lastMessage: string;

  /** Data da última mensagem */
  lastMessageDate: Date | string;

  /** Número de mensagens não lidas */
  unreadCount: number;

  /** Lista de mensagens da conversa */
  messages: Message[];

  /** Indica se é uma conversa com a loja (sem produto específico) */
  isStoreChat?: boolean;

  /** Data da última atividade (opcional) */
  lastActivity?: Date | string;

  /** Indica se o usuário está online (opcional) */
  isOnline?: boolean;
}

/**
 * 🔥 Interface para requisição de nova mensagem
 */
export interface SendMessageRequest {
  /** ID do produto */
  productId: string;

  /** Nome do produto */
  productName: string;

  /** ID do vendedor */
  sellerId: string | number;

  /** Nome do vendedor */
  sellerName: string;

  /** ID do usuário */
  userId: string | number;

  /** Nome do usuário */
  userName: string;

  /** Conteúdo da mensagem */
  content: string;

  /** Indica se é mensagem do vendedor */
  isFromSeller?: boolean;
}

/**
 * 🔥 Interface para estatísticas do chat
 */
export interface ChatStats {
  /** Total de conversas */
  totalConversations: number;

  /** Total de mensagens não lidas */
  unreadCount: number;

  /** Conversas com atividade recente (últimas 24h) */
  activeConversations: number;
}

/**
 * 🔥 Tipo para status da conversa
 */
export type ConversationStatus = 'active' | 'archived' | 'blocked';

/**
 * 🔥 Função auxiliar: cria uma mensagem vazia para fallback
 */
export function createEmptyMessage(): Message {
  return {
    id: '',
    productId: '',
    productName: '',
    sellerId: '',
    sellerName: '',
    userId: '',
    userName: '',
    content: '',
    createdAt: new Date(),
    read: false,
    isFromSeller: false
  };
}

/**
 * 🔥 Função auxiliar: cria uma conversa vazia para fallback
 */
export function createEmptyConversation(): ChatConversation {
  return {
    productId: '',
    productName: '',
    productImage: 'https://via.placeholder.com/100x100/667eea/ffffff?text=Chat',
    sellerId: '',
    sellerName: '',
    lastMessage: '',
    lastMessageDate: new Date(),
    unreadCount: 0,
    messages: [],
    isStoreChat: false
  };
}
