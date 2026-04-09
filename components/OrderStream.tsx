
import React from 'react';
import { Order, OrderStatus } from '../types';

const StatusBadge = ({ status }: { status: OrderStatus }) => {
  const styles = {
    [OrderStatus.PREP]: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    [OrderStatus.DONE]: 'bg-success/10 text-success border-success/20',
    [OrderStatus.PICKUP]: 'bg-warning/10 text-warning border-warning/20',
    [OrderStatus.DELIVERING]: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  };

  return (
    <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-widest border ${styles[status]}`}>
      {status}
    </span>
  );
};

export const OrderStream: React.FC<{
  orders: Order[];
  editable?: boolean;
  onStatusChange?: (rawId: string, status: OrderStatus) => void;
}> = ({ orders, editable, onStatusChange }) => {
  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden flex flex-col h-full">
      <div className="p-5 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold uppercase tracking-widest text-white">Live Stream</h3>
          <div className="flex items-center gap-1 px-2 py-0.5 bg-error/10 border border-error/20 rounded-md">
            <div className="w-1.5 h-1.5 rounded-full bg-error animate-pulse" />
            <span className="text-[10px] text-error font-extrabold uppercase">Live</span>
          </div>
        </div>
      </div>

      <div className="overflow-auto flex-1 custom-scrollbar">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 bg-card z-10 border-b border-border">
            <tr>
              <th className="px-5 py-3 text-[11px] font-bold text-muted uppercase tracking-wider">Branch / Order ID</th>
              <th className="px-5 py-3 text-[11px] font-bold text-muted uppercase tracking-wider text-right">Amount</th>
              <th className="px-5 py-3 text-[11px] font-bold text-muted uppercase tracking-wider text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id} className="border-b border-border/50 hover:bg-white/5 transition-colors group">
                <td className="px-5 py-4">
                  <div className="flex flex-col">
                    <span className="text-[13px] font-bold text-white group-hover:text-primary transition-colors">{order.branch}</span>
                    <span className="text-[11px] text-muted">{order.id} • {order.timestamp}</span>
                  </div>
                </td>
                <td className="px-5 py-4 text-right">
                  <span className="text-[13px] font-bold text-primary">₱{order.amount.toLocaleString()}</span>
                </td>
                <td className="px-5 py-4 text-center">
                  {editable && order.rawId && onStatusChange ? (
                    <select
                      value={order.status}
                      onChange={(e) => onStatusChange(order.rawId!, e.target.value as OrderStatus)}
                      className="bg-card border border-border rounded-lg px-2 py-1 text-[10px] font-extrabold uppercase tracking-widest text-white"
                    >
                      {Object.values(OrderStatus).map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <StatusBadge status={order.status} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <button className="p-4 text-[11px] font-bold text-muted uppercase tracking-widest hover:text-white border-t border-border transition-colors">
        Expand Stream View
      </button>
    </div>
  );
};
