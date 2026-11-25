import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, Polygon, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet';
import { renderToStaticMarkup } from 'react-dom/server';
import { AnimatePresence, motion } from 'framer-motion';
import { Swap, fadeUp, lifecycle } from '@/lib/motion';
import { POLO_NORTE, flightRoute } from '@/lib/time';
import type { Stop } from '@/lib/types';
import { SleighIcon, StopGlyph } from '@/components/ui/Icons';
import './stages.css';

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
/** Cordillera de los Andes: una cadena de montañitas dibujadas a lo largo de Chile. */
const ANDES_PEAKS: [number, number][] = [
  [-18, -69.2], [-21.5, -68.3], [-25, -68.6], [-28.5, -69.3], [-32, -70.1], [-35.5, -70.5], [-39, -71.4], [-43, -71.8], [-47, -72.6], [-51, -73.2],
];
/** Paralelos de fondo, como en un mapa de cuento. */
const PARALLELS = [0, -20, -40].map((lat) => [
  [lat, -95],
  [lat, -30],
] as [number, number][]);

const TILES = import.meta.env.VITE_MAP_TILES_URL as string | undefined;
const COLOR = { pino: '#2f6b3d', oro: '#d9a441', rojo: '#b8352b', cafe: '#4a2e1e', crema: '#fbf6ec', ruta: '#7a5236' };

const html = (node: React.ReactElement) => renderToStaticMarkup(node);

function stopIcon(stop: Stop, done: boolean, current: boolean) {
  return L.divIcon({
    className: '',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    html: html(
      <span
        style={{
          display: 'grid',
          placeItems: 'center',
          width: 36,
          height: 36,
          borderRadius: 999,
          background: done ? COLOR.pino : current ? COLOR.oro : COLOR.crema,
          color: done ? '#fff' : COLOR.cafe,
          border: `3px solid ${COLOR.crema}`,
          boxShadow: current ? `0 0 0 6px rgb(217 164 65 / .35), 0 6px 12px -4px rgb(74 46 30 / .5)` : '0 6px 12px -4px rgb(74 46 30 / .45)',
        }}
      >
        <StopGlyph icon={stop.icono} size={17} />
      </span>,
    ),
  });
}

/** Etiqueta de lugar (Polo Norte, destino). */
function placeIcon(text: string, emoji: string) {
  return L.divIcon({
    className: '',
    iconSize: [0, 0],
    iconAnchor: [0, 0],
    html: html(
      <span
        style={{
          position: 'absolute',
          transform: 'translate(-50%, -50%)',
          whiteSpace: 'nowrap',
          padding: '4px 10px',
          borderRadius: 999,
          background: COLOR.crema,
          color: COLOR.cafe,
          font: '800 12px Nunito, system-ui, sans-serif',
          boxShadow: '0 4px 10px -4px rgb(74 46 30 / .5)',
          border: `2px solid ${COLOR.oro}`,
        }}
      >
        {emoji} {text}
      </span>,
    ),
  });
}

const peakIcon = L.divIcon({
  className: '',
  iconSize: [22, 16],
  iconAnchor: [11, 14],
  html: html(
    <svg width="22" height="16" viewBox="0 0 22 16" aria-hidden="true">
      <path d="M1 15 L8 3 L12 9 L15 5 L21 15Z" fill="#a98a72" stroke="#7c6553" strokeWidth="1" />
      <path d="M8 3 L6 7 L8 6 L10 7Z" fill="#fff" />
    </svg>,
  ),
});

const sleighIcon = L.divIcon({
  className: 'trineo-marker',
  iconSize: [44, 44],
  iconAnchor: [22, 22],
  html: html(
    <span className="trineo-mece" style={{ color: COLOR.rojo, filter: 'drop-shadow(0 0 6px rgb(217 164 65 / .9)) drop-shadow(0 4px 3px rgb(74 46 30 / .35))' }}>
      <SleighIcon size={44} />
    </span>,
  ),
});

function FitRoute({ points }: { points: [number, number][] }) {
  const map = useMap();
  const key = points.map((p) => p.join(',')).join(';');
  useEffect(() => {
    if (points.length > 1) map.fitBounds(L.latLngBounds(points), { padding: [36, 36], maxZoom: 5 });
    // solo cuando cambian las paradas, no en cada segundo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key]);
  return null;
}

/** Mapa de cuento: el trineo sale del Polo Norte y vuela por la ruta hasta tu ciudad. */
export function SleighMap({ stops }: { stops: Stop[] }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const route = useMemo(() => flightRoute(stops, now), [stops, now]);
  const geo = useMemo(() => stops.filter((s) => s.lat != null && s.lng != null), [stops]);
  const firstPending = stops.findIndex((s) => !s.completed_at);
  const destination = geo[geo.length - 1];
  const bounds = route?.points ?? [POLO_NORTE, [-35, -70]];

  return (
    <div className="relative h-[440px] overflow-hidden rounded-[1.6rem] ring-[6px] ring-crema shadow-papel">
      <MapContainer
        center={[-20, -68]}
        zoom={3}
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
            {PARALLELS.map((p, i) => (
              <Polyline key={i} positions={p} pathOptions={{ color: '#ffffff', weight: 1, opacity: 0.5, dashArray: '4 8' }} />
            ))}
            <Polygon positions={SOUTH_AMERICA} pathOptions={{ color: '#d8c3a0', weight: 3, opacity: 1, fillColor: '#f7eedd', fillOpacity: 1 }} />
            {ANDES_PEAKS.map((p) => (
              <Marker key={p.join()} position={p} icon={peakIcon} interactive={false} keyboard={false} />
            ))}
          </>
        )}

        {/* ruta completa (por recorrer) */}
        {route?.segments.map((seg, i) => (
          <Polyline key={i} positions={seg} pathOptions={{ color: COLOR.ruta, weight: 3, opacity: 0.55, dashArray: '2 9', lineCap: 'round' }} />
        ))}
        {/* tramo ya recorrido */}
        {route && route.flown.length > 1 && (
          <Polyline positions={route.flown} pathOptions={{ color: COLOR.oro, weight: 5, opacity: 1, lineCap: 'round', className: 'estela-estrellas' }} />
        )}

        <Marker position={[POLO_NORTE[0] + 4, POLO_NORTE[1]]} icon={placeIcon('Polo Norte', '❄️')} interactive={false} keyboard={false} />
        {geo.map((s) => {
          const idx = stops.indexOf(s);
          return (
            <Marker key={s.id} position={[s.lat!, s.lng!]} icon={stopIcon(s, !!s.completed_at, idx === firstPending)} keyboard>
              <Tooltip direction="top" offset={[0, -16]}>
                {s.nombre}
              </Tooltip>
            </Marker>
          );
        })}
        {destination && (
          <Marker
            position={[destination.lat!, destination.lng! - 11]}
            icon={placeIcon('Tu ciudad', '🏠')}
            interactive={false}
            keyboard={false}
          />
        )}
        {route && (
          <Marker
            position={[route.sleigh.lat, route.sleigh.lng]}
            icon={sleighIcon}
            zIndexOffset={1000}
            title={route.departed ? 'Trineo del Viejito Pascuero en camino' : 'Trineo esperando en el Polo Norte'}
          />
        )}
        <FitRoute points={bounds} />
      </MapContainer>

      {/* leyenda */}
      <AnimatePresence>
      {route && (
        <motion.div key="leyenda" {...lifecycle} variants={fadeUp} className="pointer-events-none absolute bottom-3 left-3 z-[500] rounded-xl bg-crema/95 px-3 py-2 text-xs font-bold text-tinta shadow-papel">
          <p className="flex items-center gap-2">
            <span className="inline-block h-1.5 w-6 rounded-full bg-oro" /> Recorrido
          </p>
          <p className="mt-1 flex items-center gap-2">
            <span className="inline-block w-6 border-t-[3px] border-dotted border-[#7a5236]" /> Por recorrer
          </p>
          <Swap id={route.departed ? 'vuela' : 'espera'}>
            <p className="mt-1 text-tinta-suave">{route.departed ? '¡El trineo va en camino!' : 'El trineo espera en el Polo Norte.'}</p>
          </Swap>
        </motion.div>
      )}
      </AnimatePresence>
      <AnimatePresence>
        {geo.length === 0 && (
          <motion.p
            key="sin-mapa"
            {...lifecycle}
            variants={fadeUp}
            className="pointer-events-none absolute inset-x-6 bottom-6 z-[500] rounded-xl bg-crema/95 p-3 text-center text-sm font-bold text-marino"
          >
            Cuando las paradas tengan coordenadas, aquí verás volar el trineo.
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
