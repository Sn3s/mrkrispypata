
import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Sidebar } from '../components/Sidebar';
import { Header } from '../components/Header';
import { MetricCard, ActiveSessionsCard } from '../components/MetricCard';
import { OrderStream } from '../components/OrderStream';
import { InsightsGrid, type InsightProgress } from '../components/InsightsGrid';
import { Order, OrderStatus } from '../types';
import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import { inventoryStatus } from '../lib/inventoryStatus';
import { friendlySchemaError, isSchemaNotReadyMessage } from '../lib/supabaseErrors';
import {
  ShoppingCart,
  Banknote,
  BarChart2,
  LogOut,
  Package,
  TrendingUp,
  CheckCircle2,
  Clock,
  Plus,
  Filter,
  Download,
  AlertCircle,
  X,
  Pencil,
  Trash2,
} from 'lucide-react';

interface AdminViewProps {
  onLogout: () => void;
}

function relTime(iso: string): string {
  const d = new Date(iso);
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 45) return 'Just now';
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return d.toLocaleDateString();
}

function startOfLocalDayIso(): string {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return t.toISOString();
}

type BranchRow = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  hours: string | null;
  status_customer: string;
  status_admin: string;
  lat: number;
  lng: number;
  manager_name: string | null;
  system_load: number;
  monthly_revenue_cents: number;
};

export const AdminView: React.FC<AdminViewProps> = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [branches, setBranches] = useState<BranchRow[]>([]);
  const [dashOrdersToday, setDashOrdersToday] = useState(0);
  const [dashRevenueToday, setDashRevenueToday] = useState(0);
  const [dashActive, setDashActive] = useState(0);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [adminOk, setAdminOk] = useState<boolean | null>(null);
  const [insightProgress, setInsightProgress] = useState<InsightProgress[] | undefined>();
  const [insightCritical, setInsightCritical] = useState<number | undefined>();
  const [topBranchName, setTopBranchName] = useState<string | null>(null);

  const refreshOrders = useCallback(async () => {
    if (!isSupabaseConfigured() || !session) return;
    setOrdersLoading(true);
    setOrdersError(null);
    try {
      const sb = getSupabase();
      const { data, error } = await sb
        .from('orders')
        .select('id, created_at, total_cents, status, branches ( name )')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as {
        id: string;
        created_at: string;
        total_cents: number;
        status: string;
        branches: { name: string } | { name: string }[] | null;
      }[];
      const mapped: Order[] = rows.map((r) => {
        const b = r.branches;
        const branchName = Array.isArray(b) ? b[0]?.name ?? '—' : b?.name ?? '—';
        return {
          id: `#${r.id.replace(/-/g, '').slice(0, 8).toUpperCase()}`,
          rawId: r.id,
          branch: branchName,
          timestamp: relTime(r.created_at),
          amount: r.total_cents / 100,
          status: r.status as OrderStatus,
        };
      });
      setOrders(mapped);

      const start = startOfLocalDayIso();
      const todayRows = rows.filter((r) => r.created_at >= start);
      setDashOrdersToday(todayRows.length);
      setDashRevenueToday(todayRows.reduce((a, r) => a + r.total_cents, 0) / 100);
      setDashActive(rows.filter((r) => ['PREP', 'PICKUP', 'DELIVERING'].includes(r.status)).length);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setOrdersError(isSchemaNotReadyMessage(msg) ? friendlySchemaError() : msg);
      setOrders([]);
    } finally {
      setOrdersLoading(false);
    }
  }, [session]);

  const refreshBranches = useCallback(async () => {
    if (!isSupabaseConfigured() || !session) return;
    const sb = getSupabase();
    const { data, error } = await sb.from('branches').select('*').order('name');
    if (!error && data) setBranches(data as BranchRow[]);
  }, [session]);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setAuthLoading(false);
      return;
    }
    const sb = getSupabase();
    sb.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
      setAuthLoading(false);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setAdminOk(null);
      return;
    }
    let cancelled = false;
    setAdminOk(null);
    (async () => {
      const sb = getSupabase();
      const { data, error } = await sb.from('profiles').select('is_admin').eq('id', session.user.id).maybeSingle();
      if (cancelled) return;
      if (error) {
        setAdminOk(false);
        return;
      }
      setAdminOk(Boolean(data?.is_admin));
    })();
    return () => {
      cancelled = true;
    };
  }, [session]);

  useEffect(() => {
    if (session && adminOk === true) {
      void refreshOrders();
      void refreshBranches();
    }
  }, [session, adminOk, refreshOrders, refreshBranches]);

  useEffect(() => {
    if (adminOk !== true || activeTab !== 'overview') return;
    const sb = getSupabase();
    let cancelled = false;
    (async () => {
      const { data, error } = await sb.from('inventory').select('name, stock_level, threshold');
      if (cancelled || error || !data?.length) return;
      const progress: InsightProgress[] = data
        .filter((i) => i.threshold > 0)
        .map((i) => ({
          label: i.name,
          value: Math.min(100, Math.max(0, Math.round((1 - i.stock_level / i.threshold) * 100))),
        }))
        .filter((x) => x.value > 5)
        .sort((a, b) => b.value - a.value)
        .slice(0, 2);
      const critical = data.filter((i) => inventoryStatus(i.stock_level, i.threshold) === 'Critical').length;
      setInsightProgress(progress.length ? progress : undefined);
      setInsightCritical(critical);
    })();
    return () => {
      cancelled = true;
    };
  }, [adminOk, activeTab]);

  useEffect(() => {
    if (!branches.length) {
      setTopBranchName(null);
      return;
    }
    const top = [...branches].sort((a, b) => b.system_load - a.system_load)[0];
    setTopBranchName(top?.name ?? null);
  }, [branches]);

  useEffect(() => {
    if (!isSupabaseConfigured() || !session || adminOk !== true) return;
    const sb = getSupabase();
    const ch = sb
      .channel('orders-admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        void refreshOrders();
      })
      .subscribe();
    return () => {
      void sb.removeChannel(ch);
    };
  }, [session, adminOk, refreshOrders]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (!isSupabaseConfigured()) return;
    const sb = getSupabase();
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) setAuthError(error.message);
  };

  const handleSignOut = async () => {
    if (isSupabaseConfigured()) await getSupabase().auth.signOut();
    setSession(null);
    onLogout();
  };

  const updateOrderStatus = async (rawId: string, status: OrderStatus) => {
    if (!session) return;
    const sb = getSupabase();
    const { error } = await sb.from('orders').update({ status }).eq('id', rawId);
    if (error) alert(error.message);
    else void refreshOrders();
  };

  if (!isSupabaseConfigured()) {
    return (
      <div className="min-h-screen bg-background text-white flex items-center justify-center p-8">
        <div className="max-w-lg bg-card border border-border rounded-3xl p-10 space-y-4">
          <h1 className="text-2xl font-black">Supabase not configured</h1>
          <div className="text-muted font-medium space-y-3">
            <p>
              <strong className="text-white">Local:</strong> add <code className="text-primary">VITE_SUPABASE_URL</code> and{' '}
              <code className="text-primary">VITE_SUPABASE_ANON_KEY</code> to <code className="text-white/80">.env.local</code>, then restart{' '}
              <code className="text-primary">npm run dev</code>.
            </p>
            <p>
              <strong className="text-white">Vercel:</strong> in <strong className="text-white">Settings → Environment Variables</strong>, set{' '}
              <strong className="text-white">either</strong> pair for <strong className="text-white">Production</strong> (and Preview if you use it):
            </p>
            <ul className="list-disc pl-5 text-sm space-y-1 text-white/70">
              <li>
                <code className="text-primary">VITE_SUPABASE_URL</code> + <code className="text-primary">VITE_SUPABASE_ANON_KEY</code> (baked in at
                build — redeploy after changing)
              </li>
              <li>
                <code className="text-primary">SUPABASE_URL</code> + <code className="text-primary">SUPABASE_ANON_KEY</code> (same values; read at
                runtime via <code className="text-white/80">/api/supabase-config</code> — redeploy once after adding)
              </li>
            </ul>
            <p className="text-sm text-white/40">
              Database: run <code className="text-primary">supabase/APPLY_ALL.sql</code> in the Supabase SQL Editor once.
            </p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="mt-4 px-6 py-3 bg-primary text-black rounded-xl font-black text-xs uppercase tracking-widest"
          >
            Back to site
          </button>
        </div>
      </div>
    );
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background text-white flex items-center justify-center">
        <p className="text-muted font-bold">Loading…</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-background text-white flex items-center justify-center p-8">
        <form onSubmit={handleSignIn} className="w-full max-w-md bg-card border border-border rounded-3xl p-10 space-y-6">
          <h1 className="text-3xl font-black tracking-tight">Admin sign in</h1>
          <p className="text-muted text-sm font-medium">
            Use a Supabase Auth user that has <code className="text-primary">is_admin = true</code> in{' '}
            <code>profiles</code>.
          </p>
          {authError && <p className="text-error text-sm font-bold">{authError}</p>}
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-muted tracking-widest">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-12 bg-black/40 border border-border rounded-xl px-4 font-bold"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-muted tracking-widest">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-12 bg-black/40 border border-border rounded-xl px-4 font-bold"
              required
            />
          </div>
          <button type="submit" className="w-full h-14 bg-primary text-black rounded-xl font-black uppercase text-xs tracking-widest">
            Sign in
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="w-full text-muted text-sm font-bold hover:text-white"
          >
            ← Back to storefront
          </button>
        </form>
      </div>
    );
  }

  if (adminOk === null) {
    return (
      <div className="min-h-screen bg-background text-white flex items-center justify-center">
        <p className="text-muted font-bold">Verifying admin access…</p>
      </div>
    );
  }

  if (adminOk === false) {
    return (
      <div className="min-h-screen bg-background text-white flex items-center justify-center p-8">
        <div className="max-w-md bg-card border border-border rounded-3xl p-10 space-y-4 text-center">
          <h1 className="text-2xl font-black">Access denied</h1>
          <p className="text-muted font-medium text-sm">
            This account is signed in but <code className="text-primary">profiles.is_admin</code> is not true. Run in SQL Editor:{' '}
            <code className="text-xs break-all">update public.profiles set is_admin = true where id = &apos;YOUR_USER_UUID&apos;;</code>
          </p>
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full h-12 bg-primary text-black rounded-xl font-black uppercase text-xs tracking-widest"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'branches':
        return <BranchesContent branches={branches} onRefresh={refreshBranches} />;
      case 'inventory':
        return <InventoryContent />;
      case 'staff':
        return <StaffContent branchOptions={branches} />;
      case 'menu':
        return <MenuAdminContent />;
      case 'promos':
        return <PromosAdminContent />;
      case 'analytics':
        return <AnalyticsContent />;
      case 'settings':
        return <SettingsContent />;
      case 'overview':
      default:
        return (
          <div className="space-y-8">
            {ordersError && (
              <div className="bg-error/15 border border-error/30 text-error text-sm font-bold px-4 py-3 rounded-2xl flex flex-wrap items-center justify-between gap-3">
                <span>{ordersError}</span>
                <button
                  type="button"
                  onClick={() => void refreshOrders()}
                  className="px-4 py-2 rounded-xl bg-white/10 text-white text-xs font-black uppercase tracking-widest hover:bg-white/20"
                >
                  Retry
                </button>
              </div>
            )}
            {ordersLoading && <p className="text-muted text-sm font-bold">Syncing orders…</p>}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <MetricCard label="Total Orders Today" value={String(dashOrdersToday)} trend="live" icon={ShoppingCart} />
              <MetricCard
                label="Total Revenue"
                value={`₱${Math.round(dashRevenueToday).toLocaleString()}`}
                trend="today"
                icon={Banknote}
                color="primary"
              />
              <ActiveSessionsCard value={dashActive} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              <div className="lg:col-span-8 space-y-8">
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-8 bg-primary rounded-full" />
                  <h2 className="text-2xl font-extrabold tracking-tight uppercase">Performance Highlights</h2>
                </div>
                <InsightsGrid
                  topBranchName={topBranchName}
                  inventoryProgress={insightProgress}
                  criticalInventoryCount={insightCritical}
                />
                <div className="bg-card border border-border rounded-3xl p-8 space-y-8 shadow-xl">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-white">Daily Branch Capacity</h3>
                    <BarChart2 className="w-5 h-5 text-muted" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                    {branches.map((b) => (
                      <div key={b.id} className="space-y-3">
                        <div className="flex justify-between items-center text-[13px] font-bold">
                          <span className="text-white">{b.name}</span>
                          <span className={b.system_load > 85 ? 'text-error' : 'text-primary'}>{b.system_load}%</span>
                        </div>
                        <div className="w-full h-2.5 bg-white/5 rounded-full overflow-hidden">
                          <div
                            className="h-full transition-all duration-1000"
                            style={{
                              width: `${b.system_load}%`,
                              backgroundColor: b.system_load > 85 ? '#EF4444' : '#FFD100',
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="lg:col-span-4 h-full min-h-[420px]">
                <OrderStream orders={orders} editable onStatusChange={updateOrderStatus} />
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-background text-white flex">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />

      <main className="flex-1 ml-[260px] flex flex-col min-w-0">
        <Header onHomeClick={handleSignOut} />

        <div className="p-8 space-y-8 max-w-[1600px]">
          <div className="flex items-end justify-between">
            <div className="space-y-1">
              <h1 className="text-4xl font-extrabold tracking-tight capitalize">{activeTab}</h1>
              <p className="text-muted font-medium">
                {activeTab === 'overview' ? 'Live monitoring across all active franchise nodes.' : `Manage and track ${activeTab} operations.`}
              </p>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              className="flex items-center gap-3 px-6 py-3 bg-white/5 border border-border rounded-2xl font-black text-xs uppercase tracking-widest text-muted hover:text-white hover:bg-white/10 transition-all shadow-lg group"
            >
              <LogOut className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Exit Admin
            </button>
          </div>

          {renderContent()}
        </div>
      </main>
    </div>
  );
};

const BranchesContent = ({
  branches,
  onRefresh,
}: {
  branches: BranchRow[];
  onRefresh: () => void;
}) => {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BranchRow | null>(null);
  const [form, setForm] = useState<Partial<BranchRow>>({});

  const openNew = () => {
    setEditing(null);
    setForm({
      name: '',
      address: '',
      phone: '',
      hours: '',
      status_customer: 'Open Now',
      status_admin: 'Open',
      lat: 14.6,
      lng: 121.0,
      manager_name: '',
      system_load: 50,
      monthly_revenue_cents: 0,
    });
    setOpen(true);
  };

  const openEdit = (b: BranchRow) => {
    setEditing(b);
    setForm(b);
    setOpen(true);
  };

  const save = async () => {
    const sb = getSupabase();
    if (editing) {
      const { error } = await sb
        .from('branches')
        .update({
          name: form.name,
          address: form.address,
          phone: form.phone,
          hours: form.hours,
          status_customer: form.status_customer,
          status_admin: form.status_admin,
          lat: form.lat,
          lng: form.lng,
          manager_name: form.manager_name,
          system_load: form.system_load,
          monthly_revenue_cents: form.monthly_revenue_cents,
        })
        .eq('id', editing.id);
      if (error) return alert(error.message);
    } else {
      const { error } = await sb.from('branches').insert({
        name: form.name,
        address: form.address,
        phone: form.phone,
        hours: form.hours,
        status_customer: form.status_customer ?? 'Open Now',
        status_admin: form.status_admin ?? 'Open',
        lat: form.lat ?? 0,
        lng: form.lng ?? 0,
        manager_name: form.manager_name,
        system_load: form.system_load ?? 0,
        monthly_revenue_cents: form.monthly_revenue_cents ?? 0,
      });
      if (error) return alert(error.message);
    }
    setOpen(false);
    onRefresh();
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this branch? Fails if orders or staff still reference it.')) return;
    const { error } = await getSupabase().from('branches').delete().eq('id', id);
    if (error) alert(error.message);
    else onRefresh();
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex gap-4">
          <button
            type="button"
            onClick={openNew}
            className="bg-primary text-black px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-lg"
          >
            <Plus className="w-4 h-4" /> Add Branch
          </button>
          <button
            type="button"
            className="bg-white/5 border border-border text-white px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-white/10 transition-all"
          >
            <Filter className="w-4 h-4" /> Filter
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {branches.map((branch) => (
          <div
            key={branch.id}
            className="bg-card border border-border rounded-[32px] p-8 hover:border-primary/50 transition-all group relative overflow-hidden"
          >
            <div className="flex justify-between items-start mb-6">
              <div className="space-y-1">
                <h3 className="text-2xl font-black tracking-tight">{branch.name}</h3>
                <p className="text-muted text-sm font-bold">Mgr: {branch.manager_name || '—'}</p>
              </div>
              <div
                className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                  branch.status_admin === 'Open' ? 'bg-success/10 text-success border border-success/20' : 'bg-error/10 text-error border border-error/20'
                }`}
              >
                {branch.status_admin}
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex justify-between items-end">
                <div className="space-y-1">
                  <span className="text-[10px] text-muted font-black uppercase tracking-widest block">Monthly Rev</span>
                  <span className="text-2xl font-black text-primary">₱{Math.round(branch.monthly_revenue_cents / 100000)}k</span>
                </div>
                <div className="text-right space-y-1">
                  <span className="text-[10px] text-muted font-black uppercase tracking-widest block">System Load</span>
                  <span className="text-lg font-black text-white">{branch.system_load}%</span>
                </div>
              </div>

              <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full" style={{ width: `${branch.system_load}%` }} />
              </div>
            </div>

            <div className="flex gap-2 mt-8">
              <button
                type="button"
                onClick={() => openEdit(branch)}
                className="flex-1 py-3 rounded-xl border border-white/5 bg-white/5 text-[11px] font-black uppercase tracking-[0.2em] hover:bg-primary hover:text-black transition-all flex items-center justify-center gap-2"
              >
                <Pencil className="w-3 h-3" /> Edit
              </button>
              <button
                type="button"
                onClick={() => remove(branch.id)}
                className="py-3 px-4 rounded-xl border border-error/20 text-error hover:bg-error/10"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {open && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-3xl p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto space-y-4 relative">
            <button type="button" className="absolute top-4 right-4 text-muted hover:text-white" onClick={() => setOpen(false)}>
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-black">{editing ? 'Edit branch' : 'New branch'}</h3>
            {(['name', 'address', 'phone', 'hours', 'manager_name'] as const).map((k) => (
              <div key={k} className="space-y-1">
                <label className="text-[10px] font-black uppercase text-muted">{k}</label>
                <input
                  className="w-full h-11 bg-black/40 border border-border rounded-xl px-3 font-bold text-sm"
                  value={(form[k] as string) ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
                />
              </div>
            ))}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-black uppercase text-muted">Lat</label>
                <input
                  type="number"
                  step="any"
                  className="w-full h-11 bg-black/40 border border-border rounded-xl px-3 font-bold text-sm"
                  value={form.lat ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, lat: parseFloat(e.target.value) }))}
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-muted">Lng</label>
                <input
                  type="number"
                  step="any"
                  className="w-full h-11 bg-black/40 border border-border rounded-xl px-3 font-bold text-sm"
                  value={form.lng ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, lng: parseFloat(e.target.value) }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-black uppercase text-muted">Customer status label</label>
                <input
                  className="w-full h-11 bg-black/40 border border-border rounded-xl px-3 font-bold text-sm"
                  value={form.status_customer ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, status_customer: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-muted">Admin Open/Closed</label>
                <select
                  className="w-full h-11 bg-black/40 border border-border rounded-xl px-3 font-bold text-sm"
                  value={form.status_admin ?? 'Open'}
                  onChange={(e) => setForm((f) => ({ ...f, status_admin: e.target.value }))}
                >
                  <option value="Open">Open</option>
                  <option value="Closed">Closed</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-black uppercase text-muted">System load %</label>
                <input
                  type="number"
                  className="w-full h-11 bg-black/40 border border-border rounded-xl px-3 font-bold text-sm"
                  value={form.system_load ?? 0}
                  onChange={(e) => setForm((f) => ({ ...f, system_load: parseInt(e.target.value, 10) || 0 }))}
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-muted">Monthly revenue (¢)</label>
                <input
                  type="number"
                  className="w-full h-11 bg-black/40 border border-border rounded-xl px-3 font-bold text-sm"
                  value={form.monthly_revenue_cents ?? 0}
                  onChange={(e) => setForm((f) => ({ ...f, monthly_revenue_cents: parseInt(e.target.value, 10) || 0 }))}
                />
              </div>
            </div>
            <button type="button" onClick={save} className="w-full h-12 bg-primary text-black rounded-xl font-black uppercase text-xs tracking-widest">
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const InventoryContent = () => {
  const [rows, setRows] = useState<
    { id: string; name: string; stock_level: number; threshold: number; branch_id: string | null; branch_display?: string }[]
  >([]);
  const [branchPick, setBranchPick] = useState<{ id: string; name: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{ name: string; stock_level: number; threshold: number; branch_id: string }>({
    name: '',
    stock_level: 0,
    threshold: 10,
    branch_id: '',
  });
  const stockDebounce = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const loadBranches = useCallback(async () => {
    const { data } = await getSupabase().from('branches').select('id, name').order('name');
    if (data) setBranchPick(data as { id: string; name: string }[]);
  }, []);

  const load = useCallback(async () => {
    const sb = getSupabase();
    const { data, error } = await sb.from('inventory').select('id, name, stock_level, threshold, branch_id, branches ( name )');
    if (error) return;
    const list = (data ?? []) as {
      id: string;
      name: string;
      stock_level: number;
      threshold: number;
      branch_id: string | null;
      branches: { name: string } | null;
    }[];
    setRows(
      list.map((r) => ({
        ...r,
        branch_display: r.branches?.name ?? 'All Branches',
      }))
    );
  }, []);

  useEffect(() => {
    void loadBranches();
  }, [loadBranches]);

  useEffect(() => {
    void load();
  }, [load]);

  const critical = rows.filter((r) => inventoryStatus(r.stock_level, r.threshold) === 'Critical').length;

  const saveNew = async () => {
    const sb = getSupabase();
    const { error } = await sb.from('inventory').insert({
      name: form.name,
      stock_level: form.stock_level,
      threshold: form.threshold,
      branch_id: form.branch_id || null,
    });
    if (error) alert(error.message);
    else {
      setOpen(false);
      void load();
    }
  };

  const updateRow = async (id: string, patch: { stock_level?: number; threshold?: number }) => {
    const { error } = await getSupabase().from('inventory').update(patch).eq('id', id);
    if (error) alert(error.message);
    else void load();
  };

  const scheduleStockUpdate = (id: string, value: number) => {
    const prev = stockDebounce.current[id];
    if (prev) clearTimeout(prev);
    stockDebounce.current[id] = setTimeout(() => {
      void updateRow(id, { stock_level: value });
      delete stockDebounce.current[id];
    }, 450);
  };

  const del = async (id: string) => {
    if (!confirm('Delete row?')) return;
    const { error } = await getSupabase().from('inventory').delete().eq('id', id);
    if (error) alert(error.message);
    else void load();
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="bg-card border border-border rounded-3xl p-6 flex flex-col justify-center">
          <span className="text-muted text-[10px] font-black uppercase tracking-widest mb-2">Critical rows</span>
          <div className="flex items-center gap-3">
            <AlertCircle className="text-error w-8 h-8" />
            <span className="text-3xl font-black">{critical}</span>
          </div>
        </div>
        <div className="bg-card border border-border rounded-3xl p-6 flex flex-col justify-center">
          <span className="text-muted text-[10px] font-black uppercase tracking-widest mb-2">Tracked lines</span>
          <div className="flex items-center gap-3">
            <Package className="text-primary w-8 h-8" />
            <span className="text-3xl font-black">{rows.length}</span>
          </div>
        </div>
        <div className="lg:col-span-2 flex items-center justify-end">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="bg-primary text-black px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Add line
          </button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-[40px] overflow-hidden shadow-2xl">
        <div className="p-8 border-b border-border flex items-center justify-between bg-white/[0.02]">
          <h3 className="text-xl font-black tracking-tight uppercase italic">Stock Master List</h3>
          <Download className="w-5 h-5 text-muted" />
        </div>
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-border text-[11px] font-black uppercase tracking-widest text-muted">
              <th className="px-10 py-5">Item</th>
              <th className="px-10 py-5">Stock</th>
              <th className="px-10 py-5">Branch</th>
              <th className="px-10 py-5">Status</th>
              <th className="px-10 py-5 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => {
              const st = inventoryStatus(item.stock_level, item.threshold);
              return (
                <tr key={item.id} className="border-b border-border/50 hover:bg-white/5 transition-colors">
                  <td className="px-10 py-6 font-bold text-lg">{item.name}</td>
                  <td className="px-10 py-6">
                    <input
                      type="number"
                      className="w-24 h-9 bg-black/40 border border-border rounded-lg px-2 font-black"
                      value={item.stock_level}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10) || 0;
                        setRows((prev) => prev.map((r) => (r.id === item.id ? { ...r, stock_level: v } : r)));
                        scheduleStockUpdate(item.id, v);
                      }}
                    />
                  </td>
                  <td className="px-10 py-6 text-muted font-bold">{item.branch_display}</td>
                  <td className="px-10 py-6">
                    <span
                      className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border ${
                        st === 'Critical'
                          ? 'bg-error/10 text-error border-error/20'
                          : st === 'Low'
                            ? 'bg-warning/10 text-warning border-warning/20'
                            : 'bg-success/10 text-success border-success/20'
                      }`}
                    >
                      {st}
                    </span>
                  </td>
                  <td className="px-10 py-6 text-right">
                    <button type="button" onClick={() => del(item.id)} className="text-muted hover:text-error">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/80">
          <div className="bg-card border border-border rounded-3xl p-8 max-w-md w-full space-y-4">
            <h3 className="font-black text-lg">New inventory line</h3>
            <input
              placeholder="Name"
              className="w-full h-11 bg-black/40 border border-border rounded-xl px-3 font-bold"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-muted">Branch (optional)</label>
              <select
                className="w-full h-11 bg-black/40 border border-border rounded-xl px-3 font-bold text-sm"
                value={form.branch_id}
                onChange={(e) => setForm((f) => ({ ...f, branch_id: e.target.value }))}
              >
                <option value="">All branches</option>
                {branchPick.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                placeholder="Stock"
                className="h-11 bg-black/40 border border-border rounded-xl px-3 font-bold"
                value={form.stock_level}
                onChange={(e) => setForm((f) => ({ ...f, stock_level: parseInt(e.target.value, 10) || 0 }))}
              />
              <input
                type="number"
                placeholder="Threshold"
                className="h-11 bg-black/40 border border-border rounded-xl px-3 font-bold"
                value={form.threshold}
                onChange={(e) => setForm((f) => ({ ...f, threshold: parseInt(e.target.value, 10) || 0 }))}
              />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setOpen(false)} className="flex-1 h-11 rounded-xl border border-border font-bold text-sm">
                Cancel
              </button>
              <button type="button" onClick={saveNew} className="flex-1 h-11 rounded-xl bg-primary text-black font-black text-xs uppercase">
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const StaffContent = ({ branchOptions }: { branchOptions: BranchRow[] }) => {
  const [rows, setRows] = useState<
    { id: string; name: string; role: string; performance: number; status: string; photo_seed: string | null; branch_id: string; branches?: { name: string } | null }[]
  >([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', role: '', branch_id: '', performance: 4.5, status: 'Active' });

  const load = useCallback(async () => {
    const { data, error } = await getSupabase().from('staff').select('*, branches ( name )').order('name');
    if (!error && data) setRows(data as typeof rows);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    const { error } = await getSupabase().from('staff').insert({
      name: form.name,
      role: form.role,
      branch_id: form.branch_id,
      performance: form.performance,
      status: form.status,
      photo_seed: form.name,
    });
    if (error) alert(error.message);
    else {
      setOpen(false);
      void load();
    }
  };

  const del = async (id: string) => {
    if (!confirm('Remove staff?')) return;
    const { error } = await getSupabase().from('staff').delete().eq('id', id);
    if (error) alert(error.message);
    else void load();
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="bg-primary text-black px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest"
        >
          + Add staff
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {rows.map((member) => (
          <div key={member.id} className="bg-card border border-border rounded-3xl p-8 hover:border-primary/50 transition-all flex flex-col items-center text-center relative">
            <button type="button" className="absolute top-4 right-4 text-muted hover:text-error" onClick={() => del(member.id)}>
              <Trash2 className="w-4 h-4" />
            </button>
            <div className="w-20 h-20 rounded-2xl bg-primary/20 flex items-center justify-center mb-6 overflow-hidden">
              <img
                src={`https://picsum.photos/seed/${encodeURIComponent(member.photo_seed || member.name)}/100/100`}
                className="w-full h-full object-cover"
                alt=""
              />
            </div>
            <h3 className="text-xl font-black mb-1">{member.name}</h3>
            <p className="text-primary text-[10px] font-black uppercase tracking-[0.2em] mb-4">{member.role}</p>
            <div className="w-full pt-6 border-t border-border flex justify-between items-center mt-auto">
              <div className="text-left">
                <span className="text-[10px] text-muted font-black uppercase tracking-widest block">Rating</span>
                <span className="font-black text-lg">★ {member.performance}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-muted font-black uppercase tracking-widest block">Branch</span>
                <span className="font-bold text-sm text-white">{member.branches?.name ?? '—'}</span>
              </div>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="bg-white/[0.02] border-2 border-dashed border-border rounded-3xl p-8 flex flex-col items-center justify-center gap-4 hover:bg-white/[0.05] hover:border-primary transition-all group"
        >
          <Plus className="text-muted group-hover:text-primary" />
          <span className="text-muted font-black text-xs uppercase tracking-widest group-hover:text-white">Hire Staff</span>
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/80">
          <div className="bg-card border border-border rounded-3xl p-8 max-w-md w-full space-y-4">
            <h3 className="font-black text-lg">New staff</h3>
            <input
              className="w-full h-11 bg-black/40 border border-border rounded-xl px-3 font-bold"
              placeholder="Name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            <input
              className="w-full h-11 bg-black/40 border border-border rounded-xl px-3 font-bold"
              placeholder="Role"
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
            />
            <select
              className="w-full h-11 bg-black/40 border border-border rounded-xl px-3 font-bold"
              value={form.branch_id}
              onChange={(e) => setForm((f) => ({ ...f, branch_id: e.target.value }))}
            >
              <option value="">Select branch</option>
              {branchOptions.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <input
              type="number"
              step="0.1"
              className="w-full h-11 bg-black/40 border border-border rounded-xl px-3 font-bold"
              value={form.performance}
              onChange={(e) => setForm((f) => ({ ...f, performance: parseFloat(e.target.value) || 0 }))}
            />
            <button type="button" onClick={save} className="w-full h-12 bg-primary text-black rounded-xl font-black uppercase text-xs">
              Save
            </button>
            <button type="button" onClick={() => setOpen(false)} className="w-full text-muted text-sm font-bold">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

type MenuRow = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  image_url: string | null;
  active: boolean;
  category: string;
  is_recommended: boolean;
};

const MenuAdminContent = () => {
  const [rows, setRows] = useState<MenuRow[]>([]);
  const [modal, setModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    price_pesos: '',
    image_url: '',
    category: 'Main',
    is_recommended: false,
    active: true,
  });

  const load = useCallback(async () => {
    const { data, error } = await getSupabase().from('menu_items').select('*').order('name');
    if (!error && data) setRows(data as MenuRow[]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openNew = () => {
    setEditingId(null);
    setForm({
      name: '',
      description: '',
      price_pesos: '',
      image_url: '',
      category: 'Main',
      is_recommended: false,
      active: true,
    });
    setModal(true);
  };

  const openEdit = (m: MenuRow) => {
    setEditingId(m.id);
    setForm({
      name: m.name,
      description: m.description ?? '',
      price_pesos: String(m.price_cents / 100),
      image_url: m.image_url ?? '',
      category: m.category ?? 'Other',
      is_recommended: Boolean(m.is_recommended),
      active: m.active,
    });
    setModal(true);
  };

  const save = async () => {
    const price_cents = Math.max(0, Math.round((parseFloat(form.price_pesos) || 0) * 100));
    const sb = getSupabase();
    const row = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      price_cents,
      image_url: form.image_url.trim() || null,
      category: form.category.trim() || 'Other',
      is_recommended: form.is_recommended,
      active: form.active,
    };
    if (!row.name) return alert('Name required');
    const { error } = editingId
      ? await sb.from('menu_items').update(row).eq('id', editingId)
      : await sb.from('menu_items').insert(row);
    if (error) alert(error.message);
    else {
      setModal(false);
      void load();
    }
  };

  const toggle = async (id: string, active: boolean) => {
    const { error } = await getSupabase().from('menu_items').update({ active }).eq('id', id);
    if (error) alert(error.message);
    else void load();
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this menu item?')) return;
    const { error } = await getSupabase().from('menu_items').delete().eq('id', id);
    if (error) alert(error.message);
    else void load();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={openNew}
          className="bg-primary text-black px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Add menu item
        </button>
      </div>
      <div className="bg-card border border-border rounded-3xl overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-border text-[11px] font-black uppercase text-muted">
              <th className="px-8 py-4">Name</th>
              <th className="px-8 py-4">Category</th>
              <th className="px-8 py-4">Price</th>
              <th className="px-8 py-4">Fav</th>
              <th className="px-8 py-4">Active</th>
              <th className="px-8 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.id} className="border-b border-border/50 hover:bg-white/[0.02]">
                <td className="px-8 py-4 font-bold">{m.name}</td>
                <td className="px-8 py-4 text-muted text-sm font-bold">{m.category ?? '—'}</td>
                <td className="px-8 py-4 text-primary font-black">₱{m.price_cents / 100}</td>
                <td className="px-8 py-4 text-sm">{m.is_recommended ? '♥' : '—'}</td>
                <td className="px-8 py-4">
                  <input type="checkbox" checked={m.active} onChange={(e) => toggle(m.id, e.target.checked)} />
                </td>
                <td className="px-8 py-4 text-right space-x-2">
                  <button type="button" onClick={() => openEdit(m)} className="text-primary hover:underline text-xs font-black uppercase">
                    Edit
                  </button>
                  <button type="button" onClick={() => remove(m.id)} className="text-error hover:underline text-xs font-black uppercase">
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/80">
          <div className="bg-card border border-border rounded-3xl p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto space-y-3 relative">
            <button type="button" className="absolute top-4 right-4 text-muted hover:text-white" onClick={() => setModal(false)}>
              <X className="w-5 h-5" />
            </button>
            <h3 className="font-black text-lg pr-8">{editingId ? 'Edit item' : 'New menu item'}</h3>
            <input
              className="w-full h-11 bg-black/40 border border-border rounded-xl px-3 font-bold"
              placeholder="Name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            <textarea
              className="w-full min-h-[80px] bg-black/40 border border-border rounded-xl px-3 py-2 font-bold text-sm"
              placeholder="Description"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
            <input
              className="w-full h-11 bg-black/40 border border-border rounded-xl px-3 font-bold"
              placeholder="Category (e.g. Main, Drinks)"
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            />
            <input
              className="w-full h-11 bg-black/40 border border-border rounded-xl px-3 font-bold"
              placeholder="Price (PHP, e.g. 695)"
              value={form.price_pesos}
              onChange={(e) => setForm((f) => ({ ...f, price_pesos: e.target.value }))}
            />
            <input
              className="w-full h-11 bg-black/40 border border-border rounded-xl px-3 font-bold text-sm"
              placeholder="Image URL"
              value={form.image_url}
              onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))}
            />
            <label className="flex items-center gap-2 text-sm font-bold text-muted">
              <input
                type="checkbox"
                checked={form.is_recommended}
                onChange={(e) => setForm((f) => ({ ...f, is_recommended: e.target.checked }))}
              />
              Customer favorite (heart on menu)
            </label>
            <label className="flex items-center gap-2 text-sm font-bold text-muted">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} />
              Active on storefront
            </label>
            <button type="button" onClick={save} className="w-full h-12 bg-primary text-black rounded-xl font-black uppercase text-xs">
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

type PromoRow = {
  id: string;
  title: string;
  description: string | null;
  tag: string | null;
  price_label: string | null;
  price_cents: number | null;
  image_url: string | null;
  active: boolean;
};

const PromosAdminContent = () => {
  const [rows, setRows] = useState<PromoRow[]>([]);
  const [modal, setModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    tag: '',
    price_label: '',
    price_pesos: '',
    image_url: '',
    active: true,
  });

  const load = useCallback(async () => {
    const { data, error } = await getSupabase().from('promos').select('*').order('title');
    if (!error && data) setRows(data as PromoRow[]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openNew = () => {
    setEditingId(null);
    setForm({ title: '', description: '', tag: '', price_label: '', price_pesos: '', image_url: '', active: true });
    setModal(true);
  };

  const openEdit = (p: PromoRow) => {
    setEditingId(p.id);
    setForm({
      title: p.title,
      description: p.description ?? '',
      tag: p.tag ?? '',
      price_label: p.price_label ?? '',
      price_pesos: p.price_cents != null ? String(p.price_cents / 100) : '',
      image_url: p.image_url ?? '',
      active: p.active,
    });
    setModal(true);
  };

  const save = async () => {
    const price_cents =
      form.price_pesos.trim() === '' ? null : Math.max(0, Math.round((parseFloat(form.price_pesos) || 0) * 100));
    const sb = getSupabase();
    const row = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      tag: form.tag.trim() || null,
      price_label: form.price_label.trim() || null,
      price_cents,
      image_url: form.image_url.trim() || null,
      active: form.active,
    };
    if (!row.title) return alert('Title required');
    const { error } = editingId
      ? await sb.from('promos').update(row).eq('id', editingId)
      : await sb.from('promos').insert(row);
    if (error) alert(error.message);
    else {
      setModal(false);
      void load();
    }
  };

  const toggle = async (id: string, active: boolean) => {
    const { error } = await getSupabase().from('promos').update({ active }).eq('id', id);
    if (error) alert(error.message);
    else void load();
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this promo?')) return;
    const { error } = await getSupabase().from('promos').delete().eq('id', id);
    if (error) alert(error.message);
    else void load();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={openNew}
          className="bg-primary text-black px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Add promo
        </button>
      </div>
      <div className="bg-card border border-border rounded-3xl overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-border text-[11px] font-black uppercase text-muted">
              <th className="px-8 py-4">Promo</th>
              <th className="px-8 py-4">Label</th>
              <th className="px-8 py-4">Active</th>
              <th className="px-8 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="border-b border-border/50 hover:bg-white/[0.02]">
                <td className="px-8 py-4 font-bold">{p.title}</td>
                <td className="px-8 py-4">{p.price_label}</td>
                <td className="px-8 py-4">
                  <input type="checkbox" checked={p.active} onChange={(e) => toggle(p.id, e.target.checked)} />
                </td>
                <td className="px-8 py-4 text-right space-x-2">
                  <button type="button" onClick={() => openEdit(p)} className="text-primary hover:underline text-xs font-black uppercase">
                    Edit
                  </button>
                  <button type="button" onClick={() => remove(p.id)} className="text-error hover:underline text-xs font-black uppercase">
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/80">
          <div className="bg-card border border-border rounded-3xl p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto space-y-3 relative">
            <button type="button" className="absolute top-4 right-4 text-muted hover:text-white" onClick={() => setModal(false)}>
              <X className="w-5 h-5" />
            </button>
            <h3 className="font-black text-lg pr-8">{editingId ? 'Edit promo' : 'New promo'}</h3>
            <input
              className="w-full h-11 bg-black/40 border border-border rounded-xl px-3 font-bold"
              placeholder="Title"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
            <textarea
              className="w-full min-h-[72px] bg-black/40 border border-border rounded-xl px-3 py-2 font-bold text-sm"
              placeholder="Description"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
            <input
              className="w-full h-11 bg-black/40 border border-border rounded-xl px-3 font-bold"
              placeholder="Tag (e.g. Save 20%)"
              value={form.tag}
              onChange={(e) => setForm((f) => ({ ...f, tag: e.target.value }))}
            />
            <input
              className="w-full h-11 bg-black/40 border border-border rounded-xl px-3 font-bold"
              placeholder="Price label (e.g. ₱1,499 or FREE)"
              value={form.price_label}
              onChange={(e) => setForm((f) => ({ ...f, price_label: e.target.value }))}
            />
            <input
              className="w-full h-11 bg-black/40 border border-border rounded-xl px-3 font-bold text-sm"
              placeholder="Numeric price PHP (optional, for cart)"
              value={form.price_pesos}
              onChange={(e) => setForm((f) => ({ ...f, price_pesos: e.target.value }))}
            />
            <input
              className="w-full h-11 bg-black/40 border border-border rounded-xl px-3 font-bold text-sm"
              placeholder="Image URL"
              value={form.image_url}
              onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))}
            />
            <label className="flex items-center gap-2 text-sm font-bold text-muted">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} />
              Active on storefront
            </label>
            <button type="button" onClick={save} className="w-full h-12 bg-primary text-black rounded-xl font-black uppercase text-xs">
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const AnalyticsContent = () => {
  return (
    <div className="space-y-8">
      <div className="bg-card border border-border rounded-[48px] p-12 space-y-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="space-y-2">
            <h2 className="text-4xl font-black tracking-tighter uppercase italic">Revenue Intelligence</h2>
            <p className="text-muted font-bold">Charts below are illustrative; hook to Supabase views or Metabase as a next step.</p>
          </div>
          <div className="flex gap-4">
            <div className="bg-black/40 px-6 py-3 rounded-2xl border border-white/5 flex flex-col">
              <span className="text-[9px] font-black uppercase tracking-widest text-muted">Projected Growth</span>
              <span className="text-2xl font-black text-success">+14.2%</span>
            </div>
          </div>
        </div>
        <div className="h-80 w-full flex items-end gap-2 relative">
          {Array.from({ length: 30 }).map((_, i) => (
            <div
              key={i}
              className="flex-1 bg-gradient-to-t from-primary/20 to-primary rounded-t-lg hover:brightness-125 transition-all"
              style={{ height: `${20 + ((i * 13) % 60)}%` }}
            />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-card border border-border rounded-[40px] p-10 space-y-6">
          <div className="flex items-center gap-4">
            <TrendingUp className="text-primary w-8 h-8" />
            <h3 className="text-2xl font-black uppercase italic">Conversion Heatmap</h3>
          </div>
          <p className="text-muted text-sm font-medium leading-relaxed">Peak lunch demand remains strongest in flagship locations.</p>
        </div>
        <div className="bg-card border border-border rounded-[40px] p-10 space-y-6">
          <div className="flex items-center gap-4">
            <CheckCircle2 className="text-success w-8 h-8" />
            <h3 className="text-2xl font-black uppercase italic">Efficiency Score</h3>
          </div>
          <div className="flex items-baseline gap-4">
            <span className="text-6xl font-black text-white">98.4</span>
            <span className="text-muted text-xl font-bold">/ 100</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const SettingsContent = () => {
  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-20">
      <section className="space-y-8">
        <h3 className="text-2xl font-black uppercase italic tracking-tight flex items-center gap-3">
          <div className="w-1.5 h-6 bg-primary rounded-full" /> Supabase
        </h3>
        <div className="bg-card border border-border rounded-[40px] p-10 space-y-4 shadow-2xl text-muted font-medium">
          <p>Row Level Security enforces admin writes. First run <code className="text-primary">supabase/APPLY_ALL.sql</code>, then grant admin:</p>
          <pre className="bg-black/50 p-4 rounded-xl text-xs text-white overflow-x-auto">
            {`update public.profiles
set is_admin = true
where id = 'YOUR_AUTH_USER_UUID';`}
          </pre>
        </div>
      </section>
      <section className="space-y-8">
        <h3 className="text-2xl font-black uppercase italic tracking-tight flex items-center gap-3">
          <div className="w-1.5 h-6 bg-error rounded-full" /> Security & Access
        </h3>
        <div className="bg-card border border-border rounded-[40px] p-10 space-y-6">
          {[
            { title: 'Authentication', desc: 'Supabase Auth protects admin CRUD.', status: 'Active', icon: CheckCircle2, active: true },
            { title: 'RLS policies', desc: 'Public reads on catalog; orders via RPC; admin full ops.', status: 'Enabled', icon: Clock, active: true },
          ].map((item, i) => (
            <div key={i} className="flex items-center justify-between py-6 border-b border-border last:border-0">
              <div className="flex items-start gap-5">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${item.active ? 'bg-success/10 text-success' : 'bg-muted/10 text-muted'}`}>
                  <item.icon className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-black text-lg">{item.title}</h4>
                  <p className="text-muted text-sm font-medium">{item.desc}</p>
                </div>
              </div>
              <span className="text-[10px] font-black uppercase text-muted">{item.status}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
