import { useEffect, useMemo, useRef } from 'react';
import Map, { Marker, NavigationControl, Popup, type MapRef } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';

export type BranchMapPoint = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  status: string;
  addr: string;
  time: string;
  phone: string;
};

type BranchesMapProps = {
  branches: BranchMapPoint[];
  selectedBranchId: string | null;
  /** Sync list highlight when user clicks a dot (does not navigate away). */
  onHighlightBranch?: (id: string) => void;
  /** Bump to force a refresh when the page becomes visible. */
  refreshToken?: number;
  className?: string;
};

/** Metro Manila — used when no branch has valid coordinates */
const FALLBACK_CENTER = { lng: 121.0, lat: 14.58 };
const FALLBACK_ZOOM = 11;

export function BranchesMap({
  branches,
  selectedBranchId,
  onHighlightBranch,
  refreshToken,
  className = '',
}: BranchesMapProps) {
  const mapRef = useRef<MapRef | null>(null);

  const token = (import.meta as ImportMeta).env?.VITE_MAPBOX_TOKEN as string | undefined;
  const valid = useMemo(
    () => branches.filter((b) => Number.isFinite(b.lat) && Number.isFinite(b.lng)),
    [branches]
  );

  const selected = useMemo(
    () => (selectedBranchId ? valid.find((b) => b.id === selectedBranchId) ?? null : null),
    [valid, selectedBranchId]
  );

  const bounds = useMemo(() => {
    if (valid.length === 0) return null;
    let minLng = valid[0].lng;
    let maxLng = valid[0].lng;
    let minLat = valid[0].lat;
    let maxLat = valid[0].lat;
    for (const b of valid) {
      minLng = Math.min(minLng, b.lng);
      maxLng = Math.max(maxLng, b.lng);
      minLat = Math.min(minLat, b.lat);
      maxLat = Math.max(maxLat, b.lat);
    }
    return { minLng, minLat, maxLng, maxLat };
  }, [valid]);

  useEffect(() => {
    // Resize + re-render on page entry.
    if (refreshToken == null) return;
    const m = mapRef.current;
    if (!m) return;
    // Mapbox needs resize when container was hidden.
    setTimeout(() => m.resize(), 0);
    setTimeout(() => m.resize(), 120);
  }, [refreshToken]);

  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    if (selected) {
      m.flyTo({ center: [selected.lng, selected.lat], zoom: Math.max(m.getZoom(), 13), duration: 450 });
      return;
    }
    if (bounds) {
      m.fitBounds(
        [
          [bounds.minLng, bounds.minLat],
          [bounds.maxLng, bounds.maxLat],
        ],
        { padding: 48, maxZoom: 13, duration: 0 }
      );
    } else {
      m.flyTo({ center: [FALLBACK_CENTER.lng, FALLBACK_CENTER.lat], zoom: FALLBACK_ZOOM, duration: 0 });
    }
  }, [selected?.id, bounds?.minLat, bounds?.minLng, bounds?.maxLat, bounds?.maxLng]);

  if (!token) {
    return (
      <div
        className={`branches-map-root ${className}`.trim()}
        role="application"
        aria-label="Map of branch locations"
      >
        <div className="w-full h-full flex items-center justify-center text-white/50 text-sm font-bold">
          Mapbox token missing. Set <span className="text-white/70 mx-2">VITE_MAPBOX_TOKEN</span> in your env.
        </div>
      </div>
    );
  }

  return (
    <div className={`branches-map-root ${className}`.trim()} role="application" aria-label="Map of branch locations">
      <Map
        ref={(r) => {
          mapRef.current = r;
        }}
        mapboxAccessToken={token}
        initialViewState={{
          longitude: FALLBACK_CENTER.lng,
          latitude: FALLBACK_CENTER.lat,
          zoom: FALLBACK_ZOOM,
        }}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        style={{ width: '100%', height: '100%' }}
        attributionControl
        onLoad={() => {
          const m = mapRef.current;
          if (!m) return;
          m.resize();
        }}
      >
        <NavigationControl position="bottom-right" />
        {valid.map((b) => {
          const isSelected = b.id === selectedBranchId;
          return (
            <Marker key={b.id} longitude={b.lng} latitude={b.lat} anchor="center">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onHighlightBranch?.(b.id);
                }}
                onMouseEnter={() => {}}
                className="rounded-full"
                aria-label={`Select ${b.name}`}
                style={{
                  width: isSelected ? 18 : 12,
                  height: isSelected ? 18 : 12,
                  background: '#FFD100',
                  border: isSelected ? '3px solid #0B0B0B' : '2px solid #0B0B0B',
                  boxShadow: '0 6px 18px rgba(0,0,0,0.45)',
                }}
              />
            </Marker>
          );
        })}
        {/* Lightweight popup when selected */}
        {selected ? (
          <Popup
            longitude={selected.lng}
            latitude={selected.lat}
            anchor="top"
            closeButton={false}
            closeOnClick={false}
            offset={18}
            maxWidth="280px"
            className="branches-mapbox-popup"
          >
            <div style={{ minWidth: 220, color: '#EDEDED' }}>
              <div style={{ fontWeight: 900, marginBottom: 6, color: '#FFFFFF' }}>{selected.name}</div>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#FFD100' }}>
                {selected.status}
              </div>
              {selected.addr ? <div style={{ fontSize: 12, opacity: 0.78, marginTop: 6 }}>{selected.addr}</div> : null}
              {selected.time ? <div style={{ fontSize: 12, opacity: 0.78, marginTop: 4 }}>{selected.time}</div> : null}
              {selected.phone ? <div style={{ fontSize: 12, opacity: 0.78, marginTop: 4 }}>{selected.phone}</div> : null}
            </div>
          </Popup>
        ) : null}
      </Map>
    </div>
  );
}
