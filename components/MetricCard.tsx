
import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface MetricCardProps {
  label: string;
  value: string;
  trend?: string;
  isPositive?: boolean;
  icon?: any;
  color?: string;
  subtitle?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({ 
  label, 
  value, 
  trend, 
  isPositive = true, 
  icon: Icon,
  color = "primary",
  subtitle 
}) => {
  return (
    <div className="bg-card border border-border rounded-2xl p-6 relative overflow-hidden group">
      {/* Background Decor */}
      <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
        {Icon && <Icon className="w-24 h-24" />}
      </div>

      <div className="flex flex-col h-full relative z-10">
        <span className="text-[13px] font-bold text-muted uppercase tracking-[0.1em] mb-4">{label}</span>
        
        <div className="flex items-end gap-3 mb-2">
          <span className="text-[36px] font-extrabold text-white leading-none">{value}</span>
          {trend && (
            <div className={`flex items-center gap-1 text-[13px] font-bold mb-1 ${isPositive ? 'text-success' : 'text-error'}`}>
              {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              <span>{trend}</span>
            </div>
          )}
        </div>

        {subtitle && <p className="text-[12px] text-muted font-medium italic mt-auto">{subtitle}</p>}
        
        {/* Progress bar visual indicator */}
        <div className="mt-4 w-full h-[6px] bg-white/5 rounded-full overflow-hidden">
          <div 
            className={`h-full bg-${color} rounded-full transition-all duration-1000`} 
            style={{ width: '65%', backgroundColor: color === 'primary' ? '#FFD100' : color === 'success' ? '#10B981' : '#EF4444' }} 
          />
        </div>
      </div>
    </div>
  );
};

export const ActiveSessionsCard: React.FC<{ value: number }> = ({ value }) => (
  <div className="bg-primary rounded-3xl p-8 relative overflow-hidden">
    <div className="absolute top-0 right-0 w-32 h-32 bg-black/5 rounded-full translate-x-10 -translate-y-10" />
    <div className="relative z-10">
      <span className="text-black/60 font-bold text-[13px] uppercase tracking-wider">Active Sessions</span>
      <div className="flex items-center gap-4 mt-2">
        <span className="text-[64px] font-extrabold text-black leading-none">{value}</span>
        <span className="text-black/80 font-semibold text-[15px] max-w-[120px]">Across 8 Branches</span>
      </div>
      <p className="text-black/60 text-[12px] mt-6 font-medium">System Peak: 55 at 12:45 PM</p>
    </div>
  </div>
);
