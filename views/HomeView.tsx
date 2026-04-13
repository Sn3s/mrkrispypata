
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  ChevronDown,
  MapPin,
  Instagram,
  Twitter,
  UtensilsCrossed,
  ArrowRight,
  ExternalLink,
  Search,
  Clock,
  Phone,
  Plus,
  ArrowLeft,
  ShoppingCart,
  X,
  Minus,
  CheckCircle2,
  Trash2,
  Navigation,
  Loader2,
  Store,
  Heart,
} from 'lucide-react';
import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import { closestOpenBranch } from '../lib/geo';
import { friendlySchemaError, isSchemaNotReadyMessage } from '../lib/supabaseErrors';
import {
  buildFallbackMenuRows,
  sortMenuRows,
  MENU_CATEGORY_ORDER,
  storefrontImageForMenuName,
  type MenuDisplayRow,
} from '../lib/menuCatalog';
import { BranchesMap } from '../components/BranchesMap';

interface HomeViewProps {
  onAdminClick: () => void;
}

type Section = 'home' | 'menu' | 'branches' | 'promos';

export type StoreBranch = {
  id: string;
  name: string;
  addr: string;
  status: string;
  time: string;
  phone: string;
  lat: number;
  lng: number;
  status_admin: string;
};

interface CartItem {
  id: string;
  name: string;
  price: number;
  image: string;
  quantity: number;
}

const FALLBACK_BRANCHES: StoreBranch[] = [
  { id: '11111111-1111-1111-1111-111111111111', name: 'Sta. Cruz', addr: '123 Rizal Ave, Sta. Cruz, Manila', status: 'Open Now', time: '10 AM - 10 PM', phone: '(02) 888-1234', lat: 14.6186, lng: 120.9847, status_admin: 'Open' },
  { id: '22222222-2222-2222-2222-222222222222', name: 'Binondo Flagship', addr: '456 Quintin Paredes, Binondo', status: 'Open Now', time: '9 AM - 11 PM', phone: '(02) 888-5678', lat: 14.5995, lng: 120.9753, status_admin: 'Open' },
  { id: '33333333-3333-3333-3333-333333333333', name: 'Makati Central', addr: 'Salcedo Village, Makati', status: 'Open Now', time: '10 AM - 9 PM', phone: '(02) 888-9900', lat: 14.5547, lng: 121.0244, status_admin: 'Open' },
  { id: '44444444-4444-4444-4444-444444444444', name: 'BGC Express', addr: 'High Street, BGC, Taguig', status: 'Closing Soon', time: '11 AM - 10 PM', phone: '(02) 888-1122', lat: 14.5482, lng: 121.0493, status_admin: 'Open' },
  { id: '55555555-5555-5555-5555-555555555555', name: 'Quezon City Hub', addr: 'Katipunan Ave, Quezon City', status: 'Open Now', time: '10 AM - 10 PM', phone: '(02) 888-3344', lat: 14.6760, lng: 121.0437, status_admin: 'Open' },
  { id: '66666666-6666-6666-6666-666666666666', name: 'Alabang Town', addr: 'Commerce Ave, Muntinlupa', status: 'Open Now', time: '10 AM - 9 PM', phone: '(02) 888-7788', lat: 14.4245, lng: 121.0412, status_admin: 'Closed' },
];

const FALLBACK_PROMOS = [
  { id: 'promo-barkada', image: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&q=80&w=800', tag: 'Save 20%', title: 'Weekend Barkada Treat', description: 'Enjoy a mix of our bestseller sides and 1 giant crispy pata at a special price.', price: '₱1,499' },
  { id: 'promo-sisig', image: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&q=80&w=800', tag: 'New Release', title: 'Sizzling Sisig Topper', description: 'Add our award-winning sizzling pork sisig to any Crispy Pata order for only ₱199.', price: '₱199' },
  { id: 'promo-icedtea', image: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&q=80&w=800', tag: 'Freebie', title: 'Free 1.5L Iced Tea', description: 'Get a free bottle of our signature house blend iced tea for orders above ₱2,500.', price: 'FREE' },
];

type PromoRow = {
  id: string;
  image: string;
  tag: string;
  title: string;
  description: string;
  price: string;
};

type StorefrontDetail =
  | { kind: 'menu'; item: MenuDisplayRow }
  | { kind: 'promo'; promo: PromoRow };

const BrandLogo = ({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) => {
  const scale = size === 'sm' ? 'scale-75' : size === 'lg' ? 'scale-125' : 'scale-100';
  return (
    <div className={`flex items-center gap-3 cursor-pointer ${scale} origin-left`}>
      <div className="relative">
        <div className="w-12 h-10 bg-[#FFD100] rounded-lg flex items-center justify-center relative shadow-[0_0_20px_rgba(255,209,0,0.3)] overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-black/10" />
          <span className="text-black font-black text-xl italic tracking-tighter -skew-x-6">Mr. K</span>
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-4 h-3 bg-[#0B0B0B] rotate-45 border-b border-r border-[#FFD100]" />
        </div>
      </div>
      <div className="flex flex-col -space-y-1">
        <span className="text-[#FFD100] font-black text-sm tracking-[0.2em] uppercase leading-none">CRISPY</span>
        <span className="text-white font-black text-lg tracking-tighter italic leading-none">PATA</span>
      </div>
    </div>
  );
};

const StorefrontItemDetailModal = ({
  detail,
  onClose,
  onAddToCart,
}: {
  detail: StorefrontDetail | null;
  onClose: () => void;
  onAddToCart: (item: { id: string; name: string; price?: string | number; image?: string }) => void;
}) => {
  useEffect(() => {
    if (!detail) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [detail, onClose]);

  if (!detail) return null;

  const titleId = 'storefront-item-detail-title';

  if (detail.kind === 'menu') {
    const { item } = detail;
    return (
      <div className="fixed inset-0 z-[125] flex items-center justify-center p-4 sm:p-6">
        <div className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={onClose} aria-hidden />
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="relative w-full max-w-4xl max-h-[min(90vh,880px)] overflow-hidden rounded-[40px] border border-white/10 bg-[#111111] shadow-[0_0_80px_rgba(0,0,0,0.75)] flex flex-col md:flex-row animate-in fade-in zoom-in duration-300"
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 z-10 w-11 h-11 rounded-full bg-black/60 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="md:w-[46%] h-52 sm:h-64 md:h-auto md:min-h-[340px] shrink-0 relative bg-black/50">
            {item.image ? (
              <img src={item.image} className="absolute inset-0 w-full h-full object-cover" alt="" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-white/25">
                <UtensilsCrossed className="w-16 h-16" />
              </div>
            )}
          </div>
          <div className="flex-1 p-8 md:p-10 overflow-y-auto flex flex-col gap-5 min-h-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#FFD100]/90 bg-[#FFD100]/10 border border-[#FFD100]/25 px-3 py-1 rounded-xl">
                {item.category}
              </span>
              {item.recommended && (
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-red-400 bg-red-500/10 border border-red-500/25 px-3 py-1 rounded-xl flex items-center gap-1">
                  <Heart className="w-3 h-3 fill-current" aria-hidden /> Favorite
                </span>
              )}
            </div>
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
              <h2 id={titleId} className="text-white text-2xl md:text-3xl font-black tracking-tight leading-tight pr-4">
                {item.name}
              </h2>
              <span className="text-[#FFD100] font-black text-2xl shrink-0">{item.price}</span>
            </div>
            {item.desc ? (
              <p className="text-white/55 text-base font-medium leading-relaxed">{item.desc}</p>
            ) : (
              <p className="text-white/35 text-sm font-medium italic">No description yet — ask the branch for details.</p>
            )}
            <div className="flex flex-col sm:flex-row gap-3 pt-4 mt-auto">
              <button
                type="button"
                onClick={() => {
                  onAddToCart({ id: item.id, name: item.name, price: item.price, image: item.image });
                }}
                className="flex-1 py-4 rounded-2xl font-black uppercase text-xs tracking-widest bg-[#FFD100] text-black hover:brightness-110 transition-all flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" /> Add to Order
              </button>
              <button
                type="button"
                onClick={onClose}
                className="sm:w-40 py-4 rounded-2xl font-black uppercase text-xs tracking-widest bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const { promo } = detail;
  return (
    <div className="fixed inset-0 z-[125] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-4xl max-h-[min(90vh,880px)] overflow-hidden rounded-[40px] border border-white/10 bg-[#111111] shadow-[0_0_80px_rgba(0,0,0,0.75)] flex flex-col md:flex-row animate-in fade-in zoom-in duration-300"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-11 h-11 rounded-full bg-black/60 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="md:w-[46%] h-52 sm:h-64 md:h-auto md:min-h-[340px] shrink-0 relative bg-black/50">
          {promo.image ? (
            <img src={promo.image} className="absolute inset-0 w-full h-full object-cover" alt="" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-white/25">
              <UtensilsCrossed className="w-16 h-16" />
            </div>
          )}
          {promo.tag ? (
            <div className="absolute top-4 left-4">
              <span className="bg-[#FFD100] text-black px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg">
                {promo.tag}
              </span>
            </div>
          ) : null}
        </div>
        <div className="flex-1 p-8 md:p-10 overflow-y-auto flex flex-col gap-5 min-h-0">
          <h2 id={titleId} className="text-white text-2xl md:text-3xl font-black tracking-tight leading-tight">
            {promo.title}
          </h2>
          <p className="text-[#FFD100] font-black text-2xl">{promo.price}</p>
          <p className="text-white/55 text-base font-medium leading-relaxed">{promo.description}</p>
          <div className="flex flex-col sm:flex-row gap-3 pt-4 mt-auto">
            <button
              type="button"
              onClick={() => {
                onAddToCart({ id: promo.id, name: promo.title, price: promo.price, image: promo.image });
              }}
              className="flex-1 py-4 rounded-2xl font-black uppercase text-xs tracking-widest bg-[#FFD100] text-black hover:brightness-110 transition-all flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" /> Add to Order
            </button>
            <button
              type="button"
              onClick={onClose}
              className="sm:w-40 py-4 rounded-2xl font-black uppercase text-xs tracking-widest bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const HomeView: React.FC<HomeViewProps> = ({ onAdminClick }) => {
  const [activeSection, setActiveSection] = useState<Section>('home');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [branches, setBranches] = useState<StoreBranch[]>(FALLBACK_BRANCHES);
  const [menuRows, setMenuRows] = useState<MenuDisplayRow[]>(() => buildFallbackMenuRows());
  const [promoRows, setPromoRows] = useState(FALLBACK_PROMOS);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [orderSubmitting, setOrderSubmitting] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [storefrontDetail, setStorefrontDetail] = useState<StorefrontDetail | null>(null);

  const selectedBranchName = useMemo(
    () => branches.find((b) => b.id === selectedBranchId)?.name ?? null,
    [branches, selectedBranchId]
  );

  const cartCount = useMemo(() => cart.reduce((acc, item) => acc + item.quantity, 0), [cart]);
  const cartTotal = useMemo(() => cart.reduce((acc, item) => acc + item.price * item.quantity, 0), [cart]);

  const catalogLoadSeq = useRef(0);

  const loadCatalog = useCallback(async () => {
    if (!isSupabaseConfigured()) return;
    const seq = ++catalogLoadSeq.current;
    setCatalogLoading(true);
    setCatalogError(null);
    try {
      const sb = getSupabase();
      const [brRes, menuRes, promoRes] = await Promise.all([
        sb.from('branches').select('*').order('name'),
        sb.from('menu_items').select('*').eq('active', true).order('name'),
        sb.from('promos').select('*').eq('active', true).order('title'),
      ]);

      if (seq !== catalogLoadSeq.current) return;

      const warnings: string[] = [];

      if (brRes.error) {
        setBranches(FALLBACK_BRANCHES);
        warnings.push(
          isSchemaNotReadyMessage(brRes.error.message) ? friendlySchemaError() : `Branches: ${brRes.error.message}`
        );
      } else {
        setBranches(
          (brRes.data ?? []).map((r) => ({
            id: r.id,
            name: r.name,
            addr: r.address ?? '',
            status: r.status_customer,
            time: r.hours ?? '',
            phone: r.phone ?? '',
            lat: r.lat,
            lng: r.lng,
            status_admin: r.status_admin,
          }))
        );
      }

      if (menuRes.error) {
        setMenuRows(buildFallbackMenuRows());
        warnings.push(
          isSchemaNotReadyMessage(menuRes.error.message) ? friendlySchemaError() : `Menu: ${menuRes.error.message}`
        );
      } else {
        const mappedMenu = sortMenuRows(
          (menuRes.data ?? []).map((m) => {
            const r = m as {
              id: string;
              name: string;
              description: string | null;
              price_cents: number;
              image_url: string | null;
              category?: string | null;
              is_recommended?: boolean | null;
            };
            return {
              id: r.id,
              name: r.name,
              price: `₱${r.price_cents / 100}`,
              desc: r.description ?? '',
              image: storefrontImageForMenuName(r.name, r.image_url),
              category: r.category ?? 'Other',
              recommended: Boolean(r.is_recommended),
            };
          })
        );
        if (mappedMenu.length === 0) {
          setMenuRows(buildFallbackMenuRows());
          warnings.push(
            'Menu in Supabase is empty — showing built-in printed menu. Confirm `.env.local` URL matches the project where you ran the SQL seed.'
          );
        } else {
          setMenuRows(mappedMenu);
        }
      }

      if (promoRes.error) {
        setPromoRows(FALLBACK_PROMOS);
        warnings.push(
          isSchemaNotReadyMessage(promoRes.error.message) ? friendlySchemaError() : `Promos: ${promoRes.error.message}`
        );
      } else {
        setPromoRows(
          (promoRes.data ?? []).map((p) => ({
            id: p.id,
            image: p.image_url ?? '',
            tag: p.tag ?? '',
            title: p.title,
            description: p.description ?? '',
            price: p.price_label ?? (p.price_cents != null ? `₱${p.price_cents / 100}` : 'FREE'),
          }))
        );
      }

      setCatalogError(warnings.length ? [...new Set(warnings)].join(' ') : null);
    } catch (e: unknown) {
      if (seq !== catalogLoadSeq.current) return;
      const msg = e instanceof Error ? e.message : 'Failed to load catalog';
      setCatalogError(isSchemaNotReadyMessage(msg) ? friendlySchemaError() : msg);
      setBranches(FALLBACK_BRANCHES);
      setMenuRows(buildFallbackMenuRows());
      setPromoRows(FALLBACK_PROMOS);
    } finally {
      if (seq === catalogLoadSeq.current) setCatalogLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  const catalogReloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleCatalogReload = useCallback(() => {
    if (catalogReloadTimerRef.current) clearTimeout(catalogReloadTimerRef.current);
    catalogReloadTimerRef.current = setTimeout(() => {
      catalogReloadTimerRef.current = null;
      void loadCatalog();
    }, 400);
  }, [loadCatalog]);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const sb = getSupabase();
    const channel = sb
      .channel('storefront-catalog')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'menu_items' },
        () => scheduleCatalogReload()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'promos' },
        () => scheduleCatalogReload()
      )
      .subscribe();

    return () => {
      if (catalogReloadTimerRef.current) {
        clearTimeout(catalogReloadTimerRef.current);
        catalogReloadTimerRef.current = null;
      }
      void sb.removeChannel(channel);
    };
  }, [scheduleCatalogReload]);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const onVis = () => {
      if (document.visibilityState === 'visible') scheduleCatalogReload();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [scheduleCatalogReload]);

  const parsePriceToPesos = (item: { price?: string | number }) => {
    if (typeof item.price === 'number') return item.price;
    const s = (item.price ?? '').toString();
    if (s.toUpperCase().includes('FREE')) return 0;
    const n = parseInt(s.replace(/[^\d]/g, ''), 10);
    return Number.isFinite(n) ? n : 0;
  };

  const addToCart = (item: { id: string; name: string; price?: string | number; image?: string }) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing) {
        return prev.map((i) => (i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i));
      }
      const priceNum = parsePriceToPesos(item);
      return [...prev, { ...item, price: priceNum, image: item.image ?? '', quantity: 1 }];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.id === id) {
            const newQty = Math.max(0, item.quantity + delta);
            return { ...item, quantity: newQty };
          }
          return item;
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const clearCart = () => setCart([]);

  const handleCheckoutClick = () => {
    setIsBranchModalOpen(true);
  };

  const processOrder = async () => {
    if (!selectedBranchId) return;
    const deliveryFee = 49;
    const itemsPayload = cart.map((c) => ({
      name: c.name,
      unit_price_cents: Math.round(c.price * 100),
      quantity: c.quantity,
      image_url: c.image || null,
    }));

    if (isSupabaseConfigured()) {
      setOrderSubmitting(true);
      try {
        const sb = getSupabase();
        const { data, error } = await sb.rpc('create_customer_order', {
          p_branch_id: selectedBranchId,
          p_items: itemsPayload,
          p_delivery_fee_cents: deliveryFee * 100,
        });
        if (error) throw error;
        if (!data) throw new Error('No order id returned');
        setOrderSuccess(true);
        setTimeout(() => {
          setOrderSuccess(false);
          setIsCartOpen(false);
          clearCart();
          setActiveSection('home');
          setOrderSubmitting(false);
        }, 2800);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Order failed';
        alert(isSchemaNotReadyMessage(msg) ? friendlySchemaError() : msg);
        setOrderSubmitting(false);
      }
      return;
    }

    setOrderSuccess(true);
    setTimeout(() => {
      setOrderSuccess(false);
      setIsCartOpen(false);
      clearCart();
      setActiveSection('home');
    }, 3000);
  };

  const findClosestBranch = () => {
    setIsLocating(true);
    if (!('geolocation' in navigator)) {
      alert('Geolocation is not supported by your browser.');
      setIsLocating(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const closest = closestOpenBranch({ lat: latitude, lng: longitude }, branches);
        setTimeout(() => {
          if (closest) setSelectedBranchId(closest.id);
          else alert('No open branches found. Please pick a location manually.');
          setIsLocating(false);
        }, 500);
      },
      () => {
        alert('Could not determine location. Please select a branch manually.');
        setIsLocating(false);
      },
      { enableHighAccuracy: true }
    );
  };

  const renderContent = () => {
    switch (activeSection) {
      case 'menu':
        return (
          <MenuView
            onBack={() => setActiveSection('home')}
            onAddToCart={addToCart}
            onItemOpen={(item) => setStorefrontDetail({ kind: 'menu', item })}
            selectedBranchName={selectedBranchName}
            items={menuRows}
            loading={catalogLoading}
          />
        );
      case 'branches':
        return (
          <BranchesView
            onBack={() => setActiveSection('home')}
            onSelectBranch={(id) => {
              setSelectedBranchId(id);
              setActiveSection('menu');
            }}
            onHighlightBranch={setSelectedBranchId}
            selectedBranchId={selectedBranchId}
            branches={branches}
            loading={catalogLoading}
          />
        );
      case 'promos':
        return (
          <PromosView
            onBack={() => setActiveSection('home')}
            onAddToCart={addToCart}
            onPromoOpen={(p) => setStorefrontDetail({ kind: 'promo', promo: p })}
            promos={promoRows}
            loading={catalogLoading}
          />
        );
      default:
        return (
          <LandingContent
            onNavTo={(s) => setActiveSection(s)}
            onAddToCart={addToCart}
            onPromoOpen={(p) => setStorefrontDetail({ kind: 'promo', promo: p })}
            selectedBranchLabel={selectedBranchName}
            promos={promoRows}
            loading={catalogLoading}
          />
        );
    }
  };

  return (
    <div className="bg-[#0B0B0B] min-h-screen font-sans text-white relative">
      {catalogError && (
        <div className="bg-error/20 text-error text-center text-sm font-bold py-3 px-4 border-b border-error/30 flex flex-col sm:flex-row items-center justify-center gap-3">
          <span>
            {catalogError} <span className="text-white/60 font-medium">(showing offline sample data)</span>
          </span>
          <button
            type="button"
            onClick={() => void loadCatalog()}
            className="px-4 py-1.5 rounded-lg bg-white/10 text-white text-xs font-black uppercase tracking-widest hover:bg-white/20"
          >
            Retry Supabase
          </button>
        </div>
      )}
      <nav className="h-20 sm:h-24 flex items-center justify-between px-5 sm:px-10 lg:px-16 sticky top-0 bg-[#0B0B0B]/90 backdrop-blur-md z-[100] border-b border-white/5">
        <div onClick={() => setActiveSection('home')}>
          <BrandLogo />
        </div>

        <div className="hidden md:flex items-center gap-12">
          <button
            onClick={() => setActiveSection('menu')}
            className={`text-[15px] font-bold transition-colors ${activeSection === 'menu' ? 'text-[#FFD100]' : 'text-white hover:text-[#FFD100]'}`}
          >
            Menu
          </button>
          <button
            onClick={() => setActiveSection('branches')}
            className={`text-[15px] font-bold transition-colors ${activeSection === 'branches' ? 'text-[#FFD100]' : 'text-white hover:text-[#FFD100]'}`}
          >
            Branches
          </button>
          <button
            onClick={() => setActiveSection('promos')}
            className={`text-[15px] font-bold transition-colors ${activeSection === 'promos' ? 'text-[#FFD100]' : 'text-white hover:text-[#FFD100]'}`}
          >
            Promos
          </button>
          <button onClick={onAdminClick} className="text-white/40 text-[15px] font-bold hover:text-white transition-colors">
            Admin Panel
          </button>
        </div>

        <div className="flex items-center gap-4">
          {selectedBranchName && (
            <button
              onClick={() => setIsBranchModalOpen(true)}
              className="hidden lg:flex flex-col items-end mr-4 text-right group"
            >
              <span className="text-[10px] font-black uppercase tracking-widest text-[#FFD100]">Current Branch</span>
              <span className="text-sm font-bold text-white group-hover:underline">{selectedBranchName} (Change)</span>
            </button>
          )}
          <button
            onClick={() => setIsCartOpen(true)}
            className="relative w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10 hover:border-[#FFD100]/50 hover:bg-white/10 transition-all"
          >
            <ShoppingCart className="w-5 h-5 text-white" />
            {cartCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-[#FFD100] text-black w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shadow-lg">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </nav>

      {renderContent()}

      <StorefrontItemDetailModal
        detail={storefrontDetail}
        onClose={() => setStorefrontDetail(null)}
        onAddToCart={(item) => {
          addToCart(item);
          setStorefrontDetail(null);
        }}
      />

      {isBranchModalOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center px-4 sm:px-6">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-2xl" onClick={() => setIsBranchModalOpen(false)} />
          <div className="relative w-full max-w-2xl bg-[#111111] rounded-[48px] border border-white/10 shadow-[0_0_100px_rgba(0,0,0,0.8)] overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="p-6 sm:p-10 lg:p-12 space-y-8 sm:space-y-10">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="text-2xl sm:text-3xl lg:text-4xl font-black italic tracking-tight">Confirm Pickup Store</h3>
                  <p className="text-white/40 font-bold">Please select where you will pick up your order.</p>
                </div>
                <button
                  onClick={() => setIsBranchModalOpen(false)}
                  className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex flex-col gap-6">
                <button
                  onClick={findClosestBranch}
                  disabled={isLocating}
                  className="w-full py-6 sm:py-8 bg-[#FFD100] text-black rounded-[32px] font-black uppercase text-sm sm:text-base tracking-[0.22em] sm:tracking-[0.25em] flex items-center justify-center gap-4 hover:scale-[1.02] active:scale-95 transition-all shadow-2xl group disabled:opacity-50"
                >
                  {isLocating ? (
                    <>
                      <Loader2 className="w-6 h-6 animate-spin" /> Calculating Distance...
                    </>
                  ) : (
                    <>
                      <Navigation className="w-6 h-6" /> Use Closest Branch
                    </>
                  )}
                </button>

                <div className="relative flex items-center py-2">
                  <div className="flex-grow border-t border-white/5"></div>
                  <span className="flex-shrink mx-6 text-[11px] font-black uppercase tracking-[0.4em] text-white/20">All Locations</span>
                  <div className="flex-grow border-t border-white/5"></div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[min(55vh,350px)] overflow-y-auto pr-2 custom-scrollbar">
                  {branches.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => setSelectedBranchId(b.id)}
                      className={`p-6 sm:p-8 rounded-[32px] sm:rounded-[40px] border text-left transition-all relative group ${selectedBranchId === b.id ? 'border-[#FFD100] bg-[#FFD100]/5 ring-2 ring-[#FFD100]/10' : 'border-white/5 bg-white/5 hover:border-white/20'}`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-black text-xl sm:text-2xl tracking-tighter">{b.name}</h4>
                        {selectedBranchId === b.id && <CheckCircle2 className="w-6 h-6 text-[#FFD100]" />}
                      </div>
                      <p className="text-sm text-white/40 font-medium mb-6 line-clamp-1">{b.addr}</p>
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-2 h-2 rounded-full ${b.status === 'Open Now' ? 'bg-success animate-pulse' : 'bg-orange-500'}`}
                        />
                        <span className="text-[10px] font-black uppercase text-white/60 tracking-widest">{b.status}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-10 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-8">
                <div className="flex items-center gap-5">
                  <div className={`w-14 h-14 rounded-3xl flex items-center justify-center ${selectedBranchId ? 'bg-success/10' : 'bg-white/5'}`}>
                    <Store className={`w-7 h-7 ${selectedBranchId ? 'text-success' : 'text-white/20'}`} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-white/30 leading-none mb-1">Current Branch</p>
                    <p className={`text-xl font-bold ${selectedBranchName ? 'text-white' : 'text-white/20'}`}>
                      {selectedBranchName || 'None selected'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (!selectedBranchId) {
                      alert('Please select a branch first.');
                      return;
                    }
                    setIsBranchModalOpen(false);
                    if (isCartOpen) void processOrder();
                  }}
                  disabled={orderSubmitting}
                  className={`w-full sm:w-auto px-8 sm:px-12 lg:px-16 py-5 sm:py-6 rounded-3xl font-black uppercase text-xs sm:text-sm tracking-[0.18em] sm:tracking-[0.2em] shadow-2xl transition-all ${selectedBranchId ? 'bg-white text-black hover:scale-105 active:scale-95' : 'bg-white/5 text-white/20 cursor-not-allowed'}`}
                >
                  {orderSubmitting ? 'Placing…' : 'Confirm & Place Order'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isCartOpen && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsCartOpen(false)} />
          <div className="relative w-full max-w-md bg-[#111111] h-full shadow-2xl flex flex-col border-l border-white/10">
            <div className="p-8 border-b border-white/5 flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-black italic">Your Order</h3>
                <p className="text-white/40 text-xs font-bold uppercase tracking-widest mt-1">
                  {selectedBranchName ? `Current Store: ${selectedBranchName}` : 'Confirm store at checkout'}
                </p>
              </div>
              <button
                onClick={() => setIsCartOpen(false)}
                className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-6">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                  <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center">
                    <ShoppingCart className="w-8 h-8 text-white/20" />
                  </div>
                  <p className="text-white/40 font-bold">Your cart is empty</p>
                  <button
                    onClick={() => {
                      setIsCartOpen(false);
                      setActiveSection('menu');
                    }}
                    className="text-[#FFD100] font-black uppercase text-xs tracking-[0.2em] hover:underline"
                  >
                    Start Browsing
                  </button>
                </div>
              ) : (
                cart.map((item) => (
                  <div key={item.id} className="flex gap-4 group">
                    <img src={item.image} className="w-20 h-20 rounded-2xl object-cover" alt={item.name} />
                    <div className="flex-1 space-y-2">
                      <div className="flex justify-between items-start">
                        <h4 className="font-bold text-[15px]">{item.name}</h4>
                        <span className="font-black text-[#FFD100]">₱{item.price * item.quantity}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => updateQuantity(item.id, -1)}
                          className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="font-bold text-sm w-4 text-center">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.id, 1)}
                          className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => updateQuantity(item.id, -item.quantity)}
                          className="ml-auto text-white/20 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {cart.length > 0 && (
              <div className="p-8 bg-black/40 border-t border-white/10 space-y-6">
                <div className="space-y-2">
                  <div className="flex justify-between text-white/40 text-sm font-bold">
                    <span>Subtotal</span>
                    <span>₱{cartTotal}</span>
                  </div>
                  <div className="flex justify-between text-white/40 text-sm font-bold">
                    <span>Delivery Fee</span>
                    <span>₱49</span>
                  </div>
                  <div className="flex justify-between text-white text-xl font-black pt-4 border-t border-white/5">
                    <span>Total</span>
                    <span className="text-[#FFD100]">₱{cartTotal + 49}</span>
                  </div>
                </div>

                <button
                  onClick={handleCheckoutClick}
                  disabled={orderSuccess || orderSubmitting}
                  className={`w-full h-16 rounded-2xl font-black uppercase text-sm tracking-[0.2em] flex items-center justify-center gap-3 shadow-2xl transition-all ${orderSuccess ? 'bg-success text-white' : 'bg-[#FFD100] text-black hover:scale-[1.02] active:scale-95'}`}
                >
                  {orderSuccess ? (
                    <>
                      <CheckCircle2 className="w-5 h-5" /> Order Placed!
                    </>
                  ) : (
                    <>
                      Checkout & Choose Branch <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <footer className="mt-24 sm:mt-32 border-t border-white/5 bg-black py-16 sm:py-20 px-5 sm:px-10 lg:px-16">
        <div className="max-w-[1600px] mx-auto space-y-16">
          <div className="flex flex-col md:flex-row items-center justify-between gap-12">
            <div className="flex items-center gap-4">
              <BrandLogo size="lg" />
            </div>
            <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-12 text-white/50 font-bold text-md">
              <a href="#" className="hover:text-[#FFD100] transition-colors">
                Privacy Policy
              </a>
              <a href="#" className="hover:text-[#FFD100] transition-colors">
                Terms of Service
              </a>
              <a href="#" className="hover:text-[#FFD100] transition-colors">
                Contact Us
              </a>
            </div>
            <div className="flex items-center gap-8">
              <a
                href="#"
                className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-white/40 hover:text-[#FFD100] hover:bg-white/10 transition-all"
              >
                <Instagram className="w-6 h-6" />
              </a>
              <a
                href="#"
                className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-white/40 hover:text-[#FFD100] hover:bg-white/10 transition-all"
              >
                <Twitter className="w-6 h-6" />
              </a>
              <a
                href="#"
                className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-white/40 hover:text-[#FFD100] hover:bg-white/10 transition-all"
              >
                <UtensilsCrossed className="w-6 h-6" />
              </a>
            </div>
          </div>
          <div className="pt-12 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-6">
            <p className="text-white/30 text-sm font-bold tracking-wide">
              © 2024 Mr. K's Crispy Pata Franchise Group. All rights reserved.
            </p>
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
              <span className="text-white/30 text-xs font-bold uppercase tracking-widest">System Operational</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

const LandingContent = ({
  onNavTo,
  onAddToCart,
  onPromoOpen,
  selectedBranchLabel,
  promos,
  loading,
}: {
  onNavTo: (s: Section) => void;
  onAddToCart: (item: { id: string; name: string; price?: string | number; image?: string }) => void;
  onPromoOpen: (p: PromoRow) => void;
  selectedBranchLabel: string | null;
  promos: PromoRow[];
  loading: boolean;
}) => (
  <main className="px-5 sm:px-10 lg:px-16 py-8 sm:py-10 space-y-12 sm:space-y-16 max-w-[1600px] mx-auto">
    {loading && <p className="text-white/40 text-sm font-bold">Loading catalog…</p>}
    <section className="flex flex-col gap-8">
      <div className="relative rounded-[28px] sm:rounded-[48px] overflow-hidden group shadow-2xl h-[440px] sm:h-[520px] lg:h-[560px]">
        <img
          src="https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?auto=format&fit=crop&q=80&w=1600"
          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000"
          alt="Original Mr. K's Crispy Pata"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/30 to-transparent flex flex-col justify-center px-6 sm:px-12 lg:px-20">
          <span className="bg-[#FFD100] text-black px-4 py-1.5 rounded-lg text-[12px] font-black uppercase tracking-[0.25em] w-fit mb-8 shadow-lg">
            Hot Offer
          </span>
          <h1 className="text-white text-4xl sm:text-6xl lg:text-8xl font-extrabold tracking-tighter leading-[0.95] sm:leading-[0.88] mb-3 sm:mb-4">
            The Golden Standard
          </h1>
          <h2 className="text-[#FFD100] text-3xl sm:text-5xl lg:text-7xl font-extrabold italic tracking-tighter mb-7 sm:mb-10 drop-shadow-lg leading-none">
            Family Bundles ₱999
          </h2>
          <p className="text-white/80 max-w-lg text-base sm:text-lg lg:text-xl leading-relaxed mb-8 sm:mb-12 font-medium">
            Taste the heritage in every crunch. Our signature pork knuckle, deep-fried to perfection.
          </p>
          <button
            onClick={() => onNavTo('menu')}
            className="bg-white text-black px-8 sm:px-10 lg:px-12 py-4 sm:py-5 rounded-2xl font-black text-base sm:text-lg lg:text-xl flex items-center gap-4 w-fit hover:bg-[#FFD100] transition-all group shadow-2xl"
          >
            Order Now <ArrowRight className="w-6 h-6 group-hover:translate-x-2 transition-transform" />
          </button>
        </div>
      </div>
    </section>

    <section className="bg-[#FFD100] rounded-[28px] sm:rounded-[48px] p-6 sm:p-10 lg:p-12 flex flex-col xl:flex-row items-center justify-between gap-8 sm:gap-10 shadow-2xl">
      <div className="space-y-3">
        <h2 className="text-black text-2xl sm:text-4xl lg:text-5xl font-extrabold tracking-tighter">Hungry for Crispy Pata?</h2>
        <p className="text-black/70 text-base sm:text-lg lg:text-xl font-bold">
          Choose your city to find the nearest branch and satisfy your cravings.
        </p>
      </div>
      <div className="flex flex-col sm:flex-row items-end gap-6 w-full xl:w-auto">
        <div className="space-y-3 w-full sm:w-80">
          <label className="text-black text-[11px] font-black uppercase tracking-[0.2em] block ml-1 opacity-80">Current Selection</label>
          <div
            onClick={() => onNavTo('branches')}
            className="h-16 bg-black/95 rounded-[24px] flex items-center justify-between px-8 text-white cursor-pointer group hover:bg-black transition-colors border border-white/5"
          >
            <span className="font-extrabold text-base sm:text-lg truncate">{selectedBranchLabel || 'Select City'}</span>
            <ChevronDown className="w-6 h-6 text-[#FFD100]" />
          </div>
        </div>
        <button
          onClick={() => onNavTo('branches')}
          className="h-16 bg-black text-white px-10 rounded-[24px] font-black uppercase text-[14px] tracking-[0.2em] flex items-center justify-center gap-4 hover:bg-black/80 transition-all shadow-xl group w-full sm:w-auto"
        >
          {selectedBranchLabel ? 'Change Branch' : 'Find Closest'}{' '}
          <MapPin className="w-5 h-5 text-[#FFD100] group-hover:scale-125 transition-transform" />
        </button>
      </div>
    </section>

    <section className="space-y-10 sm:space-y-12">
      <div className="flex items-center justify-between">
        <h2 className="text-white text-3xl sm:text-5xl font-extrabold tracking-tighter">Current Promos</h2>
        <button
          onClick={() => onNavTo('promos')}
          className="flex items-center gap-3 text-[#FFD100] font-black text-sm sm:text-lg hover:underline group"
        >
          View All Offers <ExternalLink className="w-5 h-5 group-hover:scale-110 transition-transform" />
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {promos.slice(0, 3).map((p) => (
          <PromoCard
            key={p.id}
            id={p.id}
            image={p.image}
            tag={p.tag}
            title={p.title}
            description={p.description}
            price={p.price}
            onAddToCart={onAddToCart}
            onOpenDetail={() => onPromoOpen(p)}
          />
        ))}
      </div>
    </section>
  </main>
);

const MenuView = ({
  onBack,
  onAddToCart,
  onItemOpen,
  selectedBranchName,
  items,
  loading,
}: {
  onBack: () => void;
  onAddToCart: (item: MenuDisplayRow) => void;
  onItemOpen: (item: MenuDisplayRow) => void;
  selectedBranchName: string | null;
  items: MenuDisplayRow[];
  loading: boolean;
}) => {
  const [q, setQ] = useState('');
  const grouped = useMemo(() => {
    const s = q.trim().toLowerCase();
    const pool =
      s.length === 0
        ? items
        : items.filter(
            (i) =>
              i.name.toLowerCase().includes(s) ||
              i.desc.toLowerCase().includes(s) ||
              i.category.toLowerCase().includes(s)
          );
    const by = new Map<string, MenuDisplayRow[]>();
    for (const i of pool) {
      if (!by.has(i.category)) by.set(i.category, []);
      by.get(i.category)!.push(i);
    }
    const known = new Set<string>(MENU_CATEGORY_ORDER as unknown as string[]);
    const sections: { category: string; items: MenuDisplayRow[] }[] = [];
    for (const c of MENU_CATEGORY_ORDER) {
      const arr = by.get(c);
      if (arr?.length) sections.push({ category: c, items: arr });
    }
    for (const c of [...by.keys()].sort()) {
      if (!known.has(c)) sections.push({ category: c, items: by.get(c)! });
    }
    return sections;
  }, [items, q]);

  return (
    <main className="px-5 sm:px-10 lg:px-16 py-8 sm:py-10 space-y-12 sm:space-y-16 max-w-[1600px] mx-auto min-h-screen">
      {loading && <p className="text-white/40 text-sm font-bold">Loading menu…</p>}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-8">
        <div className="space-y-2">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-[#FFD100] font-bold text-sm uppercase tracking-widest mb-4 hover:translate-x-[-4px] transition-transform"
          >
            <ArrowLeft className="w-4 h-4" /> Back Home
          </button>
          <div className="flex items-center gap-4">
            <h2 className="text-white text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tighter">Our Menu</h2>
            {!selectedBranchName && (
              <span className="bg-white/5 border border-white/10 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest">
                Branch selected later
              </span>
            )}
          </div>
          <p className="text-white/50 text-base sm:text-xl font-medium">Explore the crunchiest heritage of Mr. K's kitchen.</p>
        </div>
        <div className="relative w-full max-w-md xl:w-96 shrink-0">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-white/30 w-5 h-5" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search menu items..."
            className="w-full h-16 bg-white/5 border border-white/10 rounded-3xl pl-16 pr-6 text-lg font-bold focus:border-[#FFD100] outline-none transition-all"
          />
        </div>
      </div>
      <div className="space-y-20">
        {grouped.map(({ category, items: catItems }) => (
          <section key={category} className="space-y-8">
            <h3 className="font-serif italic text-[#FFD100]/95 text-4xl md:text-5xl tracking-wide border-b border-white/10 pb-3">
              {category}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {catItems.map((item) => (
                <div
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onItemOpen(item)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onItemOpen(item);
                    }
                  }}
                  className="bg-[#161616] rounded-[40px] overflow-hidden group border border-white/5 hover:border-[#FFD100]/30 transition-all hover:translate-y-[-8px] flex flex-col cursor-pointer text-left outline-none focus-visible:ring-2 focus-visible:ring-[#FFD100]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B0B0B]"
                >
                  <div className="h-56 overflow-hidden pointer-events-none">
                    <img
                      src={item.image}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                      alt={item.name}
                    />
                  </div>
                  <div className="p-8 space-y-4 flex-1 flex flex-col">
                    <div className="flex items-start justify-between gap-3 pointer-events-none">
                      <h4 className="text-xl font-black leading-tight flex items-start gap-2 min-w-0">
                        {item.recommended && (
                          <Heart
                            className="w-5 h-5 text-red-500 fill-red-500 shrink-0 mt-0.5"
                            aria-label="Customer favorite"
                          />
                        )}
                        <span>{item.name}</span>
                      </h4>
                      <span className="text-[#FFD100] font-black text-xl shrink-0">{item.price}</span>
                    </div>
                    {item.desc ? (
                      <p className="text-white/40 text-sm font-medium leading-relaxed flex-1 pointer-events-none line-clamp-3">
                        {item.desc}
                      </p>
                    ) : (
                      <div className="flex-1 min-h-[1rem] pointer-events-none" />
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddToCart(item);
                      }}
                      className="w-full py-4 bg-white/5 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-[#FFD100] hover:text-black transition-all flex items-center justify-center gap-2 mt-4"
                    >
                      <Plus className="w-4 h-4" /> Add to Order
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
};

const BranchesView = ({
  onBack,
  onSelectBranch,
  onHighlightBranch,
  selectedBranchId,
  branches,
  loading,
}: {
  onBack: () => void;
  onSelectBranch: (id: string) => void;
  onHighlightBranch: (id: string) => void;
  selectedBranchId: string | null;
  branches: StoreBranch[];
  loading: boolean;
}) => (
  <main className="px-5 sm:px-10 lg:px-16 py-8 sm:py-10 space-y-12 sm:space-y-16 max-w-[1600px] mx-auto min-h-screen">
    {loading && <p className="text-white/40 text-sm font-bold">Loading branches…</p>}
    <div className="space-y-2">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-[#FFD100] font-bold text-sm uppercase tracking-widest mb-4 hover:translate-x-[-4px] transition-transform"
      >
        <ArrowLeft className="w-4 h-4" /> Back Home
      </button>
      <h2 className="text-white text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tighter">Our Branches</h2>
      <p className="text-white/50 text-base sm:text-xl font-medium">Select a branch to start your order.</p>
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      <div className="lg:col-span-4 space-y-6 overflow-y-auto max-h-[min(70vh,800px)] pr-0 sm:pr-4 scrollbar-hide">
        {branches.map((b) => (
          <div
            key={b.id}
            onClick={() => onSelectBranch(b.id)}
            className={`bg-[#161616] p-6 sm:p-8 rounded-[28px] sm:rounded-[40px] border transition-all group cursor-pointer ${selectedBranchId === b.id ? 'border-[#FFD100] ring-2 ring-[#FFD100]/20' : 'border-white/5 hover:border-[#FFD100]/50'}`}
          >
            <div className="flex items-center justify-between mb-6">
              <h4 className="text-xl sm:text-2xl font-black">{b.name}</h4>
              <div
                className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${b.status === 'Open Now' ? 'bg-success/10 text-success border border-success/20' : 'bg-orange-500/10 text-orange-400 border border-orange-500/20'}`}
              >
                {b.status}
              </div>
            </div>
            <div className="space-y-4 text-white/50 font-medium">
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-[#FFD100] flex-shrink-0 mt-0.5" />
                <p className="text-sm">{b.addr}</p>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-[#FFD100]" />
                <p className="text-sm">{b.time}</p>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-[#FFD100]" />
                <p className="text-sm">{b.phone}</p>
              </div>
            </div>
            <button
              className={`w-full mt-8 py-4 rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-lg transition-all ${selectedBranchId === b.id ? 'bg-white text-black' : 'bg-[#FFD100] text-black group-hover:scale-[1.02] active:scale-95'}`}
            >
              {selectedBranchId === b.id ? 'Selected for Ordering' : 'Select Branch to Order'}
            </button>
          </div>
        ))}
      </div>
      <div className="lg:col-span-8 h-[min(62vh,700px)] sm:h-[min(70vh,700px)] min-h-[320px] rounded-[28px] sm:rounded-[48px] overflow-hidden border border-white/10 shadow-2xl bg-[#0e0e0e] relative z-0 isolate">
        <BranchesMap
          className="h-full w-full"
          branches={branches.map((b) => ({
            id: b.id,
            name: b.name,
            lat: b.lat,
            lng: b.lng,
            status: b.status,
            addr: b.addr,
            time: b.time,
            phone: b.phone,
          }))}
          selectedBranchId={selectedBranchId}
          onHighlightBranch={onHighlightBranch}
        />
      </div>
    </div>
  </main>
);

const PromosView = ({
  onBack,
  onAddToCart,
  onPromoOpen,
  promos,
  loading,
}: {
  onBack: () => void;
  onAddToCart: (item: { id: string; name: string; price?: string | number; image?: string }) => void;
  onPromoOpen: (p: PromoRow) => void;
  promos: PromoRow[];
  loading: boolean;
}) => (
  <main className="px-5 sm:px-10 lg:px-16 py-8 sm:py-10 space-y-12 sm:space-y-16 max-w-[1600px] mx-auto min-h-screen">
    {loading && <p className="text-white/40 text-sm font-bold">Loading promos…</p>}
    <div className="space-y-2">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-[#FFD100] font-bold text-sm uppercase tracking-widest mb-4 hover:translate-x-[-4px] transition-transform"
      >
        <ArrowLeft className="w-4 h-4" /> Back Home
      </button>
      <h2 className="text-white text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tighter">Promos & Offers</h2>
      <p className="text-white/50 text-base sm:text-xl font-medium">Big crunches for even bigger savings.</p>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      {promos.map((p) => (
        <PromoCard
          key={p.id}
          id={p.id}
          image={p.image}
          tag={p.tag}
          title={p.title}
          description={p.description}
          price={p.price}
          onAddToCart={onAddToCart}
          onOpenDetail={() => onPromoOpen(p)}
        />
      ))}
    </div>
  </main>
);

const PromoCard = ({
  id,
  image,
  tag,
  title,
  description,
  price,
  onAddToCart,
  onOpenDetail,
}: {
  id: string;
  image: string;
  tag: string;
  title: string;
  description: string;
  price: string;
  onAddToCart: (item: { id: string; name: string; price?: string | number; image?: string }) => void;
  onOpenDetail: () => void;
}) => (
  <div
    role="button"
    tabIndex={0}
    onClick={onOpenDetail}
    onKeyDown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onOpenDetail();
      }
    }}
    className="bg-[#161616] border border-white/5 rounded-[48px] overflow-hidden flex flex-col group h-full shadow-xl hover:border-[#FFD100]/30 transition-all hover:translate-y-[-8px] cursor-pointer text-left outline-none focus-visible:ring-2 focus-visible:ring-[#FFD100]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B0B0B]"
  >
    <div className="h-72 relative overflow-hidden pointer-events-none">
      <img src={image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt={title} />
      <div className="absolute top-6 left-6 flex flex-col gap-2">
        <span className="bg-[#FFD100] text-black px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg">{tag}</span>
      </div>
    </div>
    <div className="p-10 flex-1 flex flex-col bg-gradient-to-b from-transparent to-black/20">
      <h3 className="text-white text-2xl font-extrabold mb-4 tracking-tight group-hover:text-[#FFD100] transition-colors pointer-events-none">
        {title}
      </h3>
      <p className="text-white/50 text-[16px] font-medium mb-10 leading-relaxed flex-1 pointer-events-none line-clamp-3">{description}</p>
      <div className="flex items-center justify-between mt-auto gap-4">
        <span className="text-[#FFD100] font-black text-2xl tracking-tighter pointer-events-none">{price}</span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onAddToCart({ id, name: title, price, image });
          }}
          className="bg-white/5 hover:bg-white/10 text-white px-8 py-3.5 rounded-2xl text-[13px] font-black uppercase tracking-widest transition-all border border-white/5 group-hover:border-[#FFD100]/50 active:scale-95 shrink-0"
        >
          Add to Order
        </button>
      </div>
    </div>
  </div>
);
