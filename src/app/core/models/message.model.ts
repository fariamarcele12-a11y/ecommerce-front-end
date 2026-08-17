export interface Message {
  id: number;
  productId: number;
  productName: string;
  sellerId: number;
  sellerName: string;
  userId: number;
  userName: string;
  content: string;
  createdAt: Date;
  read: boolean;
  isFromSeller: boolean;
}

export interface ChatConversation {
  productId: number;
  productName: string;
  productImage: string;
  sellerId: number;
  sellerName: string;
  lastMessage: string;
  lastMessageDate: Date;
  unreadCount: number;
  messages: Message[];
}
