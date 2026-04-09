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
};

type BranchesMapProps = {
  branches: BranchMapPoint[];
  selectedBranchId: string | null;
  onSelectBranch: (id: string) => void;
  className?: string;
};

/** Metro Manila — used when no branch has valid coordinates */
const FALLBACK_CENTER: L.LatLngExpression = [14.58, 121.0];
const FALLBACK_ZOOM = 11;

export function BranchesMap({ branches, selectedBranchId, onSelectBranch, className = '' }: BranchesMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const selectRef = useRef(onSelectBranch);
  selectRef.current = onSelectBranch;

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

    const fixSize = () => map.invalidateSize();
    fixSize();
    requestAnimationFrame(fixSize);
    const ro = new ResizeObserver(fixSize);
    ro.observe(el);

    return () => {
      ro.disconnect();
      markersLayerRef.current = null;
      map.remove();
      mapRef.current = null;
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

      marker.bindPopup(
        `<div class="branches-map-popup-inner"><strong>${escapeHtml(b.name)}</strong><br/><span style="opacity:0.75;font-size:12px">${escapeHtml(b.status)}</span></div>`,
        { className: 'branches-map-popup', closeButton: true }
      );

      marker.on('click', () => {
        selectRef.current(b.id);
      });

      marker.addTo(layerGroup);
    }

    if (valid.length === 0) {
      map.setView(FALLBACK_CENTER, FALLBACK_ZOOM);
      return;
    }

    const selected = selectedBranchId ? valid.find((b) => b.id === selectedBranchId) : undefined;
    if (selected) {
      map.flyTo([selected.lat, selected.lng], 14, { duration: 0.45 });
      return;
    }

    if (valid.length === 1) {
      map.setView([valid[0].lat, valid[0].lng], 14);
    } else {
      const bounds = L.latLngBounds(valid.map((b) => [b.lat, b.lng]));
      map.fitBounds(bounds, { padding: [48, 48], maxZoom: 13 });
    }
  }, [branches, selectedBranchId]);

  return (
    <div
      ref={containerRef}
      className={`branches-map-root ${className}`.trim()}
      role="application"
      aria-label="Interactive map of branch locations"
    />
  );
}
