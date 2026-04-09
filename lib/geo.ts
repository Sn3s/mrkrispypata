export type LatLng = { lat: number; lng: number };

export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)));
}

export function closestOpenBranch<T extends LatLng & { status_admin?: string }>(
  user: LatLng,
  branches: T[]
): T | null {
  const open = branches.filter((b) => (b.status_admin ?? 'Open') === 'Open');
  if (!open.length) return null;
  let best = open[0];
  let bestD = haversineKm(user, best);
  for (let i = 1; i < open.length; i++) {
    const d = haversineKm(user, open[i]);
    if (d < bestD) {
      bestD = d;
      best = open[i];
    }
  }
  return best;
}
