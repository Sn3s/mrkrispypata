
export enum OrderStatus {
  PREP = 'PREP',
  DONE = 'DONE',
  PICKUP = 'PICKUP',
  DELIVERING = 'DELIVERING'
}

export interface Order {
  id: string;
  /** UUID from database — required for admin status updates */
  rawId?: string;
  branch: string;
  timestamp: string;
  amount: number;
  status: OrderStatus;
}

export interface InventoryItem {
  id: string;
  name: string;
  stockLevel: number;
  status: 'Critical' | 'Healthy' | 'Low';
  branch: string;
}

export interface BranchStats {
  id: string;
  name: string;
  revenue: number;
  orders: number;
  utilization: number;
  status: 'Open' | 'Closed';
}
