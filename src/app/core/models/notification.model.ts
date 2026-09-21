// src/app/core/models/notification.model.ts
export interface Notification {
  id: string;
  userId: string;
  type: 'message' | 'order' | 'sale' | 'review' | 'system';
  title: string;
  message: string;
  link?: string;
  icon?: string;
  read: boolean;
  createdAt: string;
  data?: NotificationData;
}

export interface NotificationData {
  type?: 'comment' | 'comment-reply' | 'message' | 'sale' | 'order';

  productId?: string;
  productName?: string;

  orderId?: string;
  total?: number;
  status?: string;
  role?: 'buyer' | 'seller';

  buyerId?: string;
  buyerName?: string;
  buyerEmail?: string;
  buyerPhone?: string;

  sellerId?: string;
  sellerName?: string;

  commenterId?: string;
  commenterName?: string;

  shippingAddress?: ShippingAddress;

  items?: OrderItemSummary[];

  paymentMethod?: {
    id: string;
    name: string;
    type: string;
  };

  senderId?: string | null;
  senderName?: string;
  senderType?: 'buyer' | 'seller';
  isFromSeller?: boolean;
}

export interface ShippingAddress {
  cep: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  country: string;
}

export interface OrderItemSummary {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  subtotal: number;
  image?: string;
}