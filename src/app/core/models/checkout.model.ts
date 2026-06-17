export interface Address {
  id?: number;
  cep: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  country: string;
  isDefault?: boolean;
}

export interface PaymentMethod {
  id: string;
  name: string;
  icon: string;
  type: 'credit_card' | 'debit_card' | 'pix' | 'boleto';
  installments?: number;
}

export interface Order {
  id?: string;
  items: OrderItem[];
  address: Address;
  paymentMethod: PaymentMethod;
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  createdAt: Date;
  updatedAt?: Date;
  trackingCode?: string;
}

export interface OrderItem {
  productId: number;
  productName: string;
  quantity: number;
  price: number;
  subtotal: number;
  image: string;
}

export interface CheckoutForm {
  address: Address;
  paymentMethod: string;
  installments: number;
  cpfCnpj: string;
  saveAddress: boolean;
  termsAccepted: boolean;
}
