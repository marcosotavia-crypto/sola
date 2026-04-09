export type ProductionStatus = 'Pendente' | 'Produzido' | 'Cancelado';

export interface FootwearItem {
  id: string;
  orderNumber: string;
  model: string;
  color: string;
  size: string;
  quantity: number;
  barcode: string;
  status: ProductionStatus;
  createdAt: number;
  updatedAt: number;
}

export interface OrderSummary {
  orderNumber: string;
  model: string;
  color: string;
  totalItems: number;
  producedItems: number;
  createdAt: number;
}
