
import React from 'react';
import { Star, Box, ThumbsUp, ChevronRight } from 'lucide-react';

const InsightCard = ({ icon: Icon, title, value, subtitle, color, progress }: any) => (
  <div className="bg-card border border-border rounded-2xl p-6 hover:border-primary/50 transition-all cursor-pointer group">
    <div className="flex items-center justify-between mb-6">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-${color}/10 border border-${color}/20`}>
        <Icon className={`w-5 h-5 text-${color}`} style={{ color: color === 'primary' ? '#FFD100' : color === 'error' ? '#EF4444' : '#10B981' }} />
      </div>
      <ChevronRight className="w-4 h-4 text-muted group-hover:text-white transition-colors" />
    </div>

    <h4 className="text-[20px] font-extrabold text-white mb-1">{title}</h4>
    <p className="text-[13px] text-muted font-medium mb-6">{value}</p>

    {progress ? (
      <div className="space-y-4">
        {progress.map((p: any, idx: number) => (
          <div key={idx} className="space-y-1.5">
            <div className="flex justify-between text-[11px] font-extrabold uppercase tracking-wider">
              <span className="text-white">{p.label}</span>
              <span className={p.value > 80 ? 'text-error' : 'text-primary'}>{p.value}%</span>
            </div>
            <div className="w-full h-1.5 bg-white/5 rounded-full">
              <div
                className="h-full rounded-full transition-all duration-1000"
                style={{
                  width: `${p.value}%`,
                  backgroundColor: p.value > 80 ? '#EF4444' : '#FFD100',
                }}
              />
            </div>
          </div>
        ))}
      </div>
    ) : (
      <div className="mt-auto">
        <p className="text-[12px] text-muted italic leading-relaxed">{subtitle}</p>
      </div>
    )}
  </div>
);

export type InsightProgress = { label: string; value: number };

export const InsightsGrid: React.FC<{
  topBranchName?: string | null;
  /** Stock pressure bars (higher = more depleted vs threshold) */
  inventoryProgress?: InsightProgress[];
  criticalInventoryCount?: number;
}> = ({ topBranchName, inventoryProgress, criticalInventoryCount }) => {
  const branchTitle = topBranchName || 'Top branch';
  const branchSub =
    topBranchName != null
      ? `Live data: ${topBranchName} leads utilization from branch records.`
      : 'Current peak time: 1:00 PM - 3:00 PM. Connect Supabase for live branch stats.';

  const invValue =
    criticalInventoryCount != null ? `${criticalInventoryCount} Items need attention` : '5 Items Critical';
  const invProgress =
    inventoryProgress && inventoryProgress.length > 0
      ? inventoryProgress
      : [
          { label: 'Crispy Pata (M)', value: 12 },
          { label: 'Cooking Oil', value: 28 },
        ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <InsightCard
        icon={Star}
        title={branchTitle}
        value="Top Performing Branch"
        color="primary"
        subtitle={branchSub}
      />
      <InsightCard icon={Box} title="Low Stock" value={invValue} color="error" progress={invProgress} />
      <InsightCard
        icon={ThumbsUp}
        title="4.8"
        value="Customer Sentiment"
        color="success"
        subtitle="“The Crispy Pata was perfectly cooked and very tender inside. Best in Sta. Cruz!” — Maria C."
      />
    </div>
  );
};
