// src/app/core/models/review.model.ts

export interface Review {
  id: string;
  productId: string;
  productName: string;
  productImage?: string;

  userId: string;
  userName: string;
  userAvatar?: string;

  sellerId: string;
  sellerName: string;

  orderId: string;

  rating: number;

  comment?: string;

  sellerReply?: ReviewReply;

  createdAt: string;
  updatedAt?: string;

  isEdited?: boolean;
}

export interface ReviewReply {
  id: string;
  content: string;
  sellerId: string;
  sellerName: string;
  createdAt: string;
}

export interface CreateReview {
  productId: string;
  productName: string;
  productImage?: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  sellerId: string;
  sellerName: string;
  orderId: string;
  rating: number;
  comment?: string;
}

export interface ReviewSummary {
  total: number;
  average: number;
  distribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
}

export function createEmptyReview(): Review {
  return {
    id: '',
    productId: '',
    productName: '',
    productImage: '',
    userId: '',
    userName: '',
    userAvatar: '',
    sellerId: '',
    sellerName: '',
    orderId: '',
    rating: 0,
    comment: '',
    createdAt: new Date().toISOString(),
    isEdited: false,
  };
}
