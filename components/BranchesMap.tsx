import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

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
  className?: string;
};

/** Metro Manila — used when no branch has valid coordinates */
const FALLBACK_CENTER: L.LatLngExpression = [14.58, 121.0];
const FALLBACK_ZOOM = 11;

function branchTooltipHtml(b: BranchMapPoint): string {
  const lines = [
    `<div class="branches-map-tip-title">${escapeHtml(b.name)}</div>`,
    `<div class="branches-map-tip-status">${escapeHtml(b.status)}</div>`,
    b.addr ? `<div class="branches-map-tip-line">${escapeHtml(b.addr)}</div>` : '',
    b.time ? `<div class="branches-map-tip-line">${escapeHtml(b.time)}</div>` : '',
    b.phone ? `<div class="branches-map-tip-line">${escapeHtml(b.phone)}</div>` : '',
  ]
    .filter(Boolean)
    .join('');
  return `<div class="branches-map-tip">${lines}</div>`;
}

export function BranchesMap({
  branches,
  selectedBranchId,
  onHighlightBranch,
  className = '',
}: BranchesMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const highlightRef = useRef(onHighlightBranch);
  highlightRef.current = onHighlightBranch;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const map = L.map(el, {
      zoomControl: true,
      scrollWheelZoom: true,
      attributionControl: true,
    });

    mapRef.current = map;

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20,
    }).addTo(map);

    const layerGroup = L.layerGroup().addTo(map);
    markersLayerRef.current = layerGroup;

    const fixSize = () => {
      if (mapRef.current && containerRef.current?.isConnected) {
        map.invalidateSize();
      }
    };
    // Leaflet often renders blank tiles when mounted while the container is
    // transitioning between hidden/visible states. Be aggressive up-front.
    fixSize();
    requestAnimationFrame(fixSize);
    setTimeout(fixSize, 60);
    setTimeout(fixSize, 250);

    const onWindowResize = () => {
      fixSize();
      requestAnimationFrame(fixSize);
    };
    window.addEventListener('resize', onWindowResize);
    window.addEventListener('orientationchange', onWindowResize);

    const onVis = () => {
      if (document.visibilityState === 'visible') {
        fixSize();
        requestAnimationFrame(fixSize);
        setTimeout(fixSize, 120);
      }
    };
    document.addEventListener('visibilitychange', onVis);

    const ro = new ResizeObserver(fixSize);
    ro.observe(el);

    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('orientationchange', onWindowResize);
      window.removeEventListener('resize', onWindowResize);
      ro.disconnect();
      markersLayerRef.current = null;
      mapRef.current = null;
      try {
        map.remove();
      } catch {
        /* ignore */
      }
      el.replaceChildren();
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layerGroup = markersLayerRef.current;
    if (!map || !layerGroup) return;

    layerGroup.clearLayers();

    const valid = branches.filter((b) => Number.isFinite(b.lat) && Number.isFinite(b.lng));

    for (const b of valid) {
      const selected = b.id === selectedBranchId;
      const marker = L.circleMarker([b.lat, b.lng], {
        radius: selected ? 13 : 8,
        fillColor: '#FFD100',
        color: '#0B0B0B',
        weight: selected ? 3 : 2,
        opacity: 1,
        fillOpacity: 0.95,
      });

      marker.bindTooltip(branchTooltipHtml(b), {
        permanent: false,
        direction: 'top',
        sticky: true,
        opacity: 1,
        className: 'branches-map-tooltip-wrap',
        offset: [0, -6],
      });

      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        highlightRef.current?.(b.id);
      });

      marker.addTo(layerGroup);
    }

    if (!map.getContainer().isConnected) return;

    try {
      // Ensure map has correct size before view operations.
      map.invalidateSize();
      if (valid.length === 0) {
        map.setView(FALLBACK_CENTER, FALLBACK_ZOOM);
        return;
      }

      const selected = selectedBranchId ? valid.find((br) => br.id === selectedBranchId) : undefined;
      if (selected) {
        map.flyTo([selected.lat, selected.lng], 14, { duration: 0.45 });
        return;
      }

      if (valid.length === 1) {
        map.setView([valid[0].lat, valid[0].lng], 14);
      } else {
        const bounds = L.latLngBounds(valid.map((br) => [br.lat, br.lng]));
        map.fitBounds(bounds, { padding: [48, 48], maxZoom: 13 });
      }
    } catch {
      /* map may be tearing down */
    }
  }, [branches, selectedBranchId]);

  return (
    <div
      ref={containerRef}
      className={`branches-map-root ${className}`.trim()}
      role="application"
      aria-label="Map of branch locations — hover a marker for details"
      onClick={(e) => e.stopPropagation()}
    />
  );
}
