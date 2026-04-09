/** Mr. Krispy printed menu — used for offline fallback and DB seed reference */

export const MENU_CATEGORY_ORDER = [
  'Main',
  'Veggies and Noodles',
  'Rice',
  'Extras',
  'Specials (3-5 PAX)',
  'Soup',
  'Combo Meals',
  'Drinks',
] as const;

/** Pexels CDN — stable hotlinks; each id chosen to match the dish type. */
const P = (id: number) =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=800`;

export type MenuSeedItem = {
  name: string;
  category: string;
  pricePesos: number;
  recommended?: boolean;
  imageUrl: string;
};

/** Source list from your menu board */
export const MR_K_MENU_SEED: readonly MenuSeedItem[] = [
  { name: 'REGULAR PATA (2 pax)', category: 'Main', pricePesos: 550, imageUrl: P(62097) },
  { name: 'JUMBO PATA (3-4 pax)', category: 'Main', pricePesos: 600, recommended: true, imageUrl: P(769289) },
  { name: 'MEGA PATA (5-6 pax)', category: 'Main', pricePesos: 750, imageUrl: P(1640772) },
  { name: 'KRISPY ULO', category: 'Main', pricePesos: 600, recommended: true, imageUrl: P(236487) },
  { name: 'KRISPY LIEMPO', category: 'Main', pricePesos: 250, imageUrl: P(769289) },
  { name: 'KRISPY CHICKEN (whole)', category: 'Main', pricePesos: 350, imageUrl: P(60616) },
  { name: 'CHICHARON BULAKLAK', category: 'Main', pricePesos: 235, imageUrl: P(1870516) },
  { name: 'PORK SISIG', category: 'Main', pricePesos: 235, recommended: true, imageUrl: P(1640774) },
  { name: 'CHOPSUEY', category: 'Veggies and Noodles', pricePesos: 255, recommended: true, imageUrl: P(1640777) },
  { name: 'PINAKBET', category: 'Veggies and Noodles', pricePesos: 255, imageUrl: P(1640773) },
  { name: 'PANCIT CANTON', category: 'Veggies and Noodles', pricePesos: 320, recommended: true, imageUrl: P(725997) },
  { name: 'PANCIT BIHON', category: 'Veggies and Noodles', pricePesos: 320, imageUrl: P(1907228) },
  { name: 'PLAIN RICE (PER CUP)', category: 'Rice', pricePesos: 30, imageUrl: P(674574) },
  { name: 'GARLIC RICE (PER CUP)', category: 'Rice', pricePesos: 40, imageUrl: P(674680) },
  { name: 'MR. KRISPY FRIED RICE', category: 'Rice', pricePesos: 370, recommended: true, imageUrl: P(842142) },
  { name: 'Sukang Masarap 350 mL', category: 'Extras', pricePesos: 85, imageUrl: P(3373745) },
  { name: 'Sukang Masarap 500 mL', category: 'Extras', pricePesos: 100, imageUrl: P(2664216) },
  { name: 'Sukang Masarap 1L', category: 'Extras', pricePesos: 130, imageUrl: P(3373745) },
  { name: 'KRISPY LIEMPO KARE-KARE', category: 'Specials (3-5 PAX)', pricePesos: 360, recommended: true, imageUrl: P(3659862) },
  { name: 'PORK BINAGOONGAN', category: 'Specials (3-5 PAX)', pricePesos: 350, imageUrl: P(1126359) },
  { name: "TOKWA'T BABOY", category: 'Specials (3-5 PAX)', pricePesos: 275, imageUrl: P(3023478) },
  { name: 'PORK SHANGHAI', category: 'Specials (3-5 PAX)', pricePesos: 240, imageUrl: P(6210746) },
  { name: 'SISIG BANGUS', category: 'Specials (3-5 PAX)', pricePesos: 235, recommended: true, imageUrl: P(725998) },
  { name: 'BONELESS BANGUS', category: 'Specials (3-5 PAX)', pricePesos: 200, imageUrl: P(1647163) },
  { name: 'SINIGANG NA LIEMPO', category: 'Soup', pricePesos: 350, imageUrl: P(3622474) },
  { name: 'SINIGANG NA HIPON', category: 'Soup', pricePesos: 380, recommended: true, imageUrl: P(725991) },
  { name: 'Sizzling Pork Sisig', category: 'Combo Meals', pricePesos: 170, imageUrl: P(1640774) },
  { name: 'Sizzling Sisig Bangus', category: 'Combo Meals', pricePesos: 170, imageUrl: P(725998) },
  { name: 'Chicharon Bulaklak', category: 'Combo Meals', pricePesos: 170, imageUrl: P(1870516) },
  { name: 'Krispy Liempo', category: 'Combo Meals', pricePesos: 180, imageUrl: P(769289) },
  { name: 'Fried Daing Bangus', category: 'Combo Meals', pricePesos: 190, imageUrl: P(725998) },
  { name: 'Half Fried Chicken', category: 'Combo Meals', pricePesos: 285, imageUrl: P(60616) },
  { name: 'Iced Tea (Pitcher)', category: 'Drinks', pricePesos: 150, imageUrl: P(302899) },
  { name: 'Softdrinks (1.5 L)', category: 'Drinks', pricePesos: 120, imageUrl: P(4393021) },
  { name: 'Softdrinks Mismo', category: 'Drinks', pricePesos: 30, imageUrl: P(4393188) },
  { name: 'Coke Zero in can', category: 'Drinks', pricePesos: 50, imageUrl: P(4393197) },
];

function normalizeMenuLookupKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

const STOREFRONT_IMAGE_BY_MENU_NAME: ReadonlyMap<string, string> = new Map(
  MR_K_MENU_SEED.map((m) => [normalizeMenuLookupKey(m.name), m.imageUrl])
);

/**
 * Customer menu: use the catalog photo when the dish name matches the printed menu.
 * New or renamed items fall back to `databaseImageUrl` (from Supabase).
 */
export function storefrontImageForMenuName(
  name: string,
  databaseImageUrl: string | null | undefined
): string {
  const fromCatalog = STOREFRONT_IMAGE_BY_MENU_NAME.get(normalizeMenuLookupKey(name));
  if (fromCatalog) return fromCatalog;
  return (databaseImageUrl ?? '').trim();
}

export type MenuDisplayRow = {
  id: string;
  name: string;
  price: string;
  desc: string;
  image: string;
  category: string;
  recommended: boolean;
};

export function buildFallbackMenuRows(): MenuDisplayRow[] {
  return MR_K_MENU_SEED.map((m, idx) => ({
    id: `fb-${idx}`,
    name: m.name,
    price: `₱${m.pricePesos}`,
    desc: m.recommended ? 'Customer favorite' : '',
    image: m.imageUrl,
    category: m.category,
    recommended: Boolean(m.recommended),
  }));
}

export function sortMenuRows<T extends { category: string; name: string }>(rows: T[]): T[] {
  const order = [...MENU_CATEGORY_ORDER];
  return [...rows].sort((a, b) => {
    const ai = order.indexOf(a.category as (typeof MENU_CATEGORY_ORDER)[number]);
    const bi = order.indexOf(b.category as (typeof MENU_CATEGORY_ORDER)[number]);
    const as = ai === -1 ? 999 : ai;
    const bs = bi === -1 ? 999 : bi;
    if (as !== bs) return as - bs;
    return a.name.localeCompare(b.name);
  });
}
