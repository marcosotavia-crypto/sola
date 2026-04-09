export type ProductionStatus = 'Pendente' | 'Produzido' | 'Cancelado';

export interface Operator {
  id: string;
  name: string;
  createdAt: number;
}

export interface Material {
  id: string;
  name: string;
  unit: string;
  createdAt: number;
}

export interface ModelConsumption {
  id: string;
  modelName: string;
  materialId: string;
  size?: string; // Optional: if empty, applies to all sizes or acts as default
  consumptionPerPair: number; // kg per pair
  createdAt: number;
}

export interface FootwearItem {
  id: string;
  orderNumber: string;
  model: string;
  color: string;
  size: string;
  quantity: number;
  barcode: string;
  status: ProductionStatus;
  producedBy?: string;
  orderDate: number;
  deadline: number;
  createdAt: number;
  updatedAt: number;
  programmingId?: string; // ID of the programming this item belongs to
}

export interface Programming {
  id: string;
  name: string;
  description?: string;
  orderNumbers: string[]; // List of order numbers in this programming
  createdAt: number;
  updatedAt: number;
  status: 'Ativa' | 'Concluída' | 'Arquivada';
}

export interface OrderSummary {
  orderNumber: string;
  model: string;
  color: string;
  totalItems: number;
  producedItems: number;
  orderDate: number;
  deadline: number;
  createdAt: number;
}
