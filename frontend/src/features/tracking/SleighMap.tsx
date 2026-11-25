import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, Polygon, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet';
import { renderToStaticMarkup } from 'react-dom/server';
import { arcPoints, sleighPosition } from '@/lib/time';
import type { Stop } from '@/lib/types';
import { SleighIcon, StopGlyph } from '@/components/ui/Icons';

/** Silueta estilizada de Sudamérica para el mapa ilustrado (sin teselas de terceros). */
const SOUTH_AMERICA: [number, number][] = [
  [9, -79.5], [11, -74.5], [12.2, -71.5], [10.5, -64], [10.6, -61.5], [8.5, -59.8], [6, -57], [5.5, -54],
  [4, -51.5], [0, -50], [-1.5, -48], [-2.5, -44], [-3, -40], [-5, -36.5], [-8, -35], [-13, -38.5],
  [-18, -39.5], [-22.9, -42], [-23.5, -45.5], [-25.5, -48.5], [-29, -49], [-32, -52], [-34.5, -54.5],
  [-35, -57], [-38.5, -57.5], [-40.5, -62], [-42, -64], [-45, -67], [-48, -65.8], [-50.5, -69],
  [-52.3, -68.5], [-54.8, -65], [-55.5, -67.5], [-55, -70.5], [-53, -74.5], [-50, -75.5], [-46, -75.5],
  [-43, -74], [-41.5, -73.8], [-37, -73.6], [-33, -71.7], [-30, -71.4], [-25, -70.5], [-18.5, -70.3],
  [-15, -75.5], [-12, -77.2], [-6, -81.1], [-4, -81], [-1, -80.5], [1.5, -79], [4, -77.4], [7, -77.8],
];
/** Franja aproximada de la Cordillera de los Andes en Chile, como guía visual. */
const ANDES: [number, number][] = [
  [-17.5, -69.4], [-22, -68.2], [-27, -68.6], [-31, -70.0], [-35, -70.4], [-40, -71.6], [-45, -71.8], [-50, -73.2],
];
/** El trineo "entra" al mapa desde el norte. */
const NORTH_ENTRY: [number, number] = [14, -76];

const TILES = import.meta.env.VITE_MAP_TILES_URL as string | undefined;

function iconFor(stop: Stop, done: boolean, current: boolean) {
  const html = renderToStaticMarkup(
    <span
      style={{
        display: 'grid',
        placeItems: 'center',
        width: 34,
        height: 34,
        borderRadius: 999,
        background: done ? '#1d8a4e' : current ? '#ffc531' : '#ffffff',
        color: done ? '#fff' : current ? '#123b5c' : '#123b5c',
        boxShadow: current ? '0 0 0 6px rgba(255,197,49,.35), 0 6px 12px -4px rgba(18,59,92,.5)' : '0 6px 12px -4px rgba(18,59,92,.45)',
        border: '3px solid #ffffff',
      }}
    >
      <StopGlyph icon={stop.icono} size={16} />
    </span>,
  );
  return L.divIcon({ html, className: '', iconSize: [34, 34], iconAnchor: [17, 17] });
}

const sleighIcon = L.divIcon({
  html: renderToStaticMarkup(
    <span style={{ display: 'block', color: '#e3242f', filter: 'drop-shadow(0 4px 4px rgba(18,59,92,.35))' }}>
      <SleighIcon size={38} />
    </span>,
  ),
  className: 'trineo-marker',
  iconSize: [38, 38],
  iconAnchor: [19, 19],
});

function FitRoute({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 1) map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 6 });
    else if (points.length === 1) map.setView(points[0]!, 5);
  }, [map, points]);
  return null;
}

/** Mapa noche polar con el trineo recorriendo una ruta curva entre las paradas. */
export function SleighMap({ stops }: { stops: Stop[] }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const geo = useMemo(() => stops.filter((s) => s.lat != null && s.lng != null), [stops]);
  const route = useMemo(() => {
    const pts: [number, number][] = geo.map((s) => [s.lat!, s.lng!]);
    const all = [NORTH_ENTRY, ...pts];
    const segs: [number, number][][] = [];
    for (let i = 0; i < all.length - 1; i++) segs.push(arcPoints(all[i]!, all[i + 1]!, i % 2 ? -0.18 : 0.18));
    return segs;
  }, [geo]);
  const pos = sleighPosition(stops, now);
  const firstPending = stops.findIndex((s) => !s.completed_at);
  const bounds = useMemo<[number, number][]>(
    () => (geo.length ? [NORTH_ENTRY, ...geo.map((s) => [s.lat!, s.lng!] as [number, number])] : [[-15, -70], [-45, -70]]),
    [geo],
  );

  // Estela: ruta ya recorrida (tramos completados + parte del tramo actual)
  const flown = useMemo(() => {
    if (!pos) return [] as [number, number][];
    const seg = route[pos.segment + 1];
    const done = route.slice(0, pos.segment + 1).flat();
    if (seg) done.push(...seg.slice(0, Math.max(1, Math.round(pos.t * (seg.length - 1))) + 1));
    return done;
  }, [route, pos]);

  return (
    <div className="relative h-[420px] overflow-hidden rounded-[1.6rem] ring-[6px] ring-white shadow-papel">
      <MapContainer
        center={[-25, -68]}
        zoom={4}
        minZoom={3}
        maxZoom={9}
        scrollWheelZoom={false}
        attributionControl={!!TILES}
        className="h-full w-full"
        aria-label="Mapa del viaje del trineo"
      >
        {TILES ? (
          <TileLayer url={TILES} attribution="&copy; OpenStreetMap" />
        ) : (
          <>
            <Polygon positions={SOUTH_AMERICA} pathOptions={{ color: '#ffffff', weight: 3, opacity: 1, fillColor: '#f4fbff', fillOpacity: 1 }} />
            <Polyline positions={ANDES} pathOptions={{ color: '#9fd8e6', weight: 8, opacity: 0.9, lineCap: 'round' }} />
          </>
        )}
        {route.map((seg, i) => (
          <Polyline key={i} positions={seg} pathOptions={{ color: '#123b5c', weight: 3, opacity: 0.35, dashArray: '2 10', lineCap: 'round' }} />
        ))}
        {flown.length > 1 && <Polyline positions={flown} pathOptions={{ color: '#e3242f', weight: 4, opacity: 1, className: 'estela-estrellas' }} />}
        {geo.map((s) => {
          const idx = stops.indexOf(s);
          return (
            <Marker key={s.id} position={[s.lat!, s.lng!]} icon={iconFor(s, !!s.completed_at, idx === firstPending)} keyboard>
              <Tooltip direction="top" offset={[0, -14]}>
                {s.nombre}
              </Tooltip>
            </Marker>
          );
        })}
        {pos && <Marker position={[pos.lat, pos.lng]} icon={sleighIcon} zIndexOffset={1000} title="Trineo del Viejito Pascuero" />}
        <FitRoute points={bounds} />
      </MapContainer>
      {geo.length === 0 && (
        <p className="pointer-events-none absolute inset-x-6 bottom-6 z-[500] rounded-xl bg-white/90 p-3 text-center text-sm font-bold text-marino">
          Cuando las paradas tengan coordenadas, aquí verás volar el trineo.
        </p>
      )}
    </div>
  );
}
