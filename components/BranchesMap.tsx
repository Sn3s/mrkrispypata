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
  const tilesRef = useRef<L.TileLayer | null>(null);
  const highlightRef = useRef(onHighlightBranch);
  highlightRef.current = onHighlightBranch;
  const branchesRef = useRef<BranchMapPoint[]>(branches);
  const selectedRef = useRef<string | null>(selectedBranchId);
  branchesRef.current = branches;
  selectedRef.current = selectedBranchId;

  const renderMap = () => {
    const map = mapRef.current;
    const layerGroup = markersLayerRef.current;
    if (!map || !layerGroup) return;

    layerGroup.clearLayers();

    const currentBranches = branchesRef.current;
    const currentSelectedId = selectedRef.current;
    const valid = currentBranches.filter((b) => Number.isFinite(b.lat) && Number.isFinite(b.lng));

    for (const b of valid) {
      const selected = b.id === currentSelectedId;
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
      map.invalidateSize({ pan: false });
      // Some browsers/pages can leave the map "grey" after hide/show.
      // Redraw forces tiles to re-render after size/layout changes.
      tilesRef.current?.redraw();
      if (valid.length === 0) {
        map.setView(FALLBACK_CENTER, FALLBACK_ZOOM);
        return;
      }

      const selected = currentSelectedId ? valid.find((br) => br.id === currentSelectedId) : undefined;
      if (selected) {
        map.flyTo([selected.lat, selected.lng], 14, { duration: 0.45 });
        // After animated moves, schedule a refresh in case the container
        // visibility changed mid-flight.
        setTimeout(() => {
          try {
            map.invalidateSize({ pan: false });
            tilesRef.current?.redraw();
          } catch {
            /* ignore */
          }
        }, 200);
        return;
      }

      if (valid.length === 1) {
        map.setView([valid[0].lat, valid[0].lng], 14);
      } else {
        const bounds = L.latLngBounds(valid.map((br) => [br.lat, br.lng]));
        map.fitBounds(bounds, { padding: [48, 48], maxZoom: 13 });
      }
      setTimeout(() => {
        try {
          map.invalidateSize({ pan: false });
          tilesRef.current?.redraw();
        } catch {
          /* ignore */
        }
      }, 120);
    } catch {
      /* map may be tearing down */
    }
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Leaflet stores an internal `_leaflet_id` on the container element.
    // If React unmount/remount happens quickly (or removal throws), Leaflet can
    // think the container is still initialized and refuse to mount.
    const clearLeafletContainerId = () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const anyEl = el as any;
        if (anyEl && '_leaflet_id' in anyEl) delete anyEl._leaflet_id;
      } catch {
        /* ignore */
      }
    };
    clearLeafletContainerId();

    let cancelled = false;

    const waitForNonZeroSize = async () => {
      // When navigating between sections, the map container can briefly render
      // at 0x0 (layout not settled yet). Initializing Leaflet during that window
      // can lead to a permanently broken map on return.
      const start = Date.now();
      while (!cancelled) {
        const w = el.clientWidth;
        const h = el.clientHeight;
        if (w > 0 && h > 0) return;
        if (Date.now() - start > 1200) return; // don't hang forever
        await new Promise<void>((r) => requestAnimationFrame(() => r()));
      }
    };

    const createMap = () =>
      L.map(el, {
        zoomControl: true,
        scrollWheelZoom: true,
        attributionControl: true,
      });

    let map: L.Map;
    (async () => {
      await waitForNonZeroSize();
      if (cancelled) return;
      try {
        map = createMap();
      } catch {
        // One retry after clearing container id.
        clearLeafletContainerId();
        map = createMap();
      }

      mapRef.current = map;

      const tiles = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20,
      });
      tiles.addTo(map);
      tilesRef.current = tiles;

      const layerGroup = L.layerGroup().addTo(map);
      markersLayerRef.current = layerGroup;

      const fixSize = () => {
        if (mapRef.current && containerRef.current?.isConnected) {
          map.invalidateSize({ pan: false });
          tilesRef.current?.redraw();
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
          // Also re-render markers/view in case props changed while hidden.
          setTimeout(renderMap, 0);
        }
      };
      document.addEventListener('visibilitychange', onVis);

      const ro = new ResizeObserver(fixSize);
      ro.observe(el);

      // Store cleanup hooks on the map instance so outer cleanup can run even
      // if init was delayed.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (map as any).__branchesMapCleanup = () => {
        document.removeEventListener('visibilitychange', onVis);
        window.removeEventListener('orientationchange', onWindowResize);
        window.removeEventListener('resize', onWindowResize);
        ro.disconnect();
      };

      // First render once map is actually ready.
      renderMap();
    })();

    return () => {
      cancelled = true;
      const m = mapRef.current;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (m as any)?.__branchesMapCleanup?.();
      tilesRef.current = null;
      markersLayerRef.current = null;
      mapRef.current = null;
      try {
        m?.remove();
      } catch {
        /* ignore */
      }
      clearLeafletContainerId();
      el.replaceChildren();
    };
  }, []);

  useEffect(() => {
    renderMap();
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
