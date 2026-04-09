
import React from 'react';
import { Search, Bell, Home, User } from 'lucide-react';

interface HeaderProps {
  onHomeClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onHomeClick }) => {
  return (
    <header className="h-[80px] border-b border-border bg-background sticky top-0 z-40 flex items-center justify-between px-8">
      <div className="relative w-[400px]">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
        <input 
          type="text" 
          placeholder="Search for orders, branches, or inventory..."
          className="w-full h-11 bg-surface border border-border rounded-xl pl-12 pr-4 text-sm text-white focus:outline-none focus:border-primary transition-colors"
        />
      </div>

      <div className="flex items-center gap-4">
        <button 
          onClick={onHomeClick}
          className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-border rounded-xl text-[12px] font-black uppercase tracking-widest text-muted hover:text-primary hover:border-primary/30 transition-all group"
        >
          <Home className="w-4 h-4 group-hover:scale-110 transition-transform" />
          <span className="hidden lg:inline">View Storefront</span>
        </button>

        <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-success/5 border border-success/10 rounded-full">
          <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
          <span className="text-[10px] text-success font-black uppercase tracking-widest">System Live</span>
        </div>

        <div className="flex items-center gap-2 border-l border-border pl-4">
          <button className="w-10 h-10 rounded-xl bg-surface border border-border flex items-center justify-center text-white hover:bg-white/5 transition-colors">
            <Bell className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-3 ml-2 p-1 pl-3 bg-surface border border-border rounded-xl">
            <div className="flex flex-col text-right">
              <span className="text-[13px] font-bold text-white leading-none">Admin</span>
              <span className="text-[10px] text-muted font-black uppercase tracking-widest mt-1">Super</span>
            </div>
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center overflow-hidden border border-white/10">
              <img src="https://picsum.photos/seed/admin/100/100" alt="Avatar" className="w-full h-full object-cover" />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
