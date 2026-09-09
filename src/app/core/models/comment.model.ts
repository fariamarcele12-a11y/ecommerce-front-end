// src/app/core/models/comment.model.ts
export interface Comment {
  id: string;
  productId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  content: string;
  createdAt: string;
  updatedAt?: string;
  isFromSeller?: boolean;
  replies?: CommentReply[];
  likes: number;
  isLiked?: boolean;
}

export interface CommentReply {
  id: string;
  commentId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  content: string;
  isFromSeller?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateComment {
  productId: string;
  content: string;
}

export interface CreateReply {
  commentId: string;
  content: string;
  isFromSeller?: boolean;
}
