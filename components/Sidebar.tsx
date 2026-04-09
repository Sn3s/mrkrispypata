
import React from 'react';
import { 
  LayoutDashboard, 
  MapPin, 
  Package, 
  Users, 
  Settings, 
  BarChart3,
  UtensilsCrossed,
  Tag,
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const NavItem = ({ 
  icon: Icon, 
  label, 
  active, 
  onClick 
}: { 
  icon: any, 
  label: string, 
  active: boolean, 
  onClick: () => void 
}) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-300 ${
      active 
        ? 'bg-primary text-black font-black shadow-[0_8px_20px_rgba(255,209,0,0.25)] scale-[1.02]' 
        : 'text-secondary hover:text-white hover:bg-white/5 active:scale-95'
    }`}
  >
    <Icon className={`w-5 h-5 ${active ? 'text-black' : 'text-secondary'}`} strokeWidth={active ? 2.5 : 2} />
    <span className="text-[14px] uppercase tracking-widest font-black">{label}</span>
  </button>
);

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange }) => {
  return (
    <aside className="w-[280px] h-screen fixed left-0 top-0 bg-surface border-r border-border flex flex-col p-8 z-50">
      <div className="flex items-center gap-4 px-2 mb-14">
        <div className="relative">
          <div className="w-12 h-10 bg-primary rounded-lg flex items-center justify-center relative shadow-[0_0_15px_rgba(255,209,0,0.2)] overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-0.5 bg-black/10" />
            <span className="text-black font-black text-lg italic tracking-tighter -skew-x-6">Mr. K</span>
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-2 bg-surface rotate-45 border-b border-r border-primary" />
          </div>
        </div>
        <div className="flex flex-col">
          <span className="text-white font-black tracking-tighter text-xl leading-none italic uppercase">CRISPY PATA</span>
          <span className="text-primary font-black text-[9px] tracking-[0.2em] uppercase mt-1 opacity-80">ADMINISTRATOR</span>
        </div>
      </div>

      <nav className="flex-1 space-y-3">
        <NavItem 
          icon={LayoutDashboard} 
          label="Overview" 
          active={activeTab === 'overview'} 
          onClick={() => onTabChange('overview')}
        />
        <NavItem 
          icon={MapPin} 
          label="Branches" 
          active={activeTab === 'branches'} 
          onClick={() => onTabChange('branches')}
        />
        <NavItem 
          icon={Package} 
          label="Inventory" 
          active={activeTab === 'inventory'} 
          onClick={() => onTabChange('inventory')}
        />
        <NavItem 
          icon={Users} 
          label="Staff" 
          active={activeTab === 'staff'} 
          onClick={() => onTabChange('staff')}
        />
        <NavItem 
          icon={UtensilsCrossed} 
          label="Menu" 
          active={activeTab === 'menu'} 
          onClick={() => onTabChange('menu')}
        />
        <NavItem 
          icon={Tag} 
          label="Promos" 
          active={activeTab === 'promos'} 
          onClick={() => onTabChange('promos')}
        />
        <NavItem 
          icon={BarChart3} 
          label="Analytics" 
          active={activeTab === 'analytics'} 
          onClick={() => onTabChange('analytics')}
        />
      </nav>

      <div className="pt-8 border-t border-border mt-auto space-y-6">
        <NavItem 
          icon={Settings} 
          label="Settings" 
          active={activeTab === 'settings'} 
          onClick={() => onTabChange('settings')}
        />
        <div className="bg-primary/5 rounded-[24px] p-5 border border-primary/10 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-16 h-16 bg-primary/10 rounded-full translate-x-8 -translate-y-8 blur-2xl" />
          <p className="text-[10px] text-primary font-black uppercase tracking-[0.2em] mb-3 relative z-10">Cloud Sync Status</p>
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-2.5 h-2.5 rounded-full bg-success animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
            <span className="text-[12px] text-white font-black tracking-tight uppercase">Live Connection</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
