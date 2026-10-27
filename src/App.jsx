import { useEffect, useMemo, useState } from 'react';
import {
  DeckGL,
  ScatterplotLayer,
  TileLayer,
  BitmapLayer,
  FlyToInterpolator,
} from 'deck.gl';
import { supabase, supabaseConfigurado } from './supabaseClient';
import { distanciaKm, esc, formatoKm } from './utils';

// Punto de referencia por defecto (centro de San Isidro) hasta que la persona comparta su ubicación
const REFERENCIA_POR_DEFECTO = { latitud: -34.4708, longitud: -58.5286 };

const VISTA_INICIAL = {
  longitude: -58.5286,
  latitude: -34.4708,
  zoom: 11.2,
  pitch: 0,
  bearing: 0,
};

const COLOR_GUARDIA = [220, 38, 38, 220];
const COLOR_SIN_GUARDIA = [37, 99, 235, 190];

export default function App() {
  const [datos, setDatos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const [soloGuardia, setSoloGuardia] = useState(true);
  const [partido, setPartido] = useState('Todos');
  const [ubicacion, setUbicacion] = useState(null); // ubicación real de la persona
  const [avisoUbicacion, setAvisoUbicacion] = useState('');
  const [seleccionado, setSeleccionado] = useState(null);
  const [viewState, setViewState] = useState(VISTA_INICIAL);

  // 1) Consulta a Supabase
  useEffect(() => {
    async function cargar() {
      if (!supabaseConfigurado) {
        setError('Faltan las variables VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.');
        setCargando(false);
        return;
      }
      const { data, error } = await supabase
        .from('establecimientos')
        .select('id,nombre,categoria,modalidad,partido,localidad,direccion,telefono,latitud,longitud,guardia')
        .eq('tipo', 'establecimiento')
        .limit(5000);

      console.log('Respuesta de Supabase:', data, error); // para comprobar que llegan los datos

      if (error) setError(error.message);
      else setDatos(data);
      setCargando(false);
    }
    cargar();
  }, []);

  const referencia = ubicacion ?? REFERENCIA_POR_DEFECTO;

  // 2) Calcular el "valor" de cada punto: distancia en km a la referencia
  const conDistancia = useMemo(
    () =>
      datos.map((d) => ({
        ...d,
        categoria: d.categoria || 'Sin dato',
        distancia: distanciaKm(referencia, d),
      })),
    [datos, referencia]
  );

  const partidos = useMemo(
    () => ['Todos', ...Array.from(new Set(datos.map((d) => d.partido).filter(Boolean))).sort()],
    [datos]
  );

  // 3) Filtros y orden por cercanía
  const visibles = useMemo(
    () =>
      conDistancia
        .filter((d) => (soloGuardia ? d.guardia : true))
        .filter((d) => (partido === 'Todos' ? true : d.partido === partido))
        .sort((a, b) => a.distancia - b.distancia),
    [conDistancia, soloGuardia, partido]
  );

  // 4) Indicadores (calculados con los datos de Supabase)
  const totalVisibles = visibles.length;
  const totalGuardia = visibles.filter((d) => d.guardia).length;
  const masCercano = visibles[0];

  function usarMiUbicacion() {
    if (!navigator.geolocation) {
      setAvisoUbicacion('Tu navegador no permite obtener la ubicación.');
      return;
    }
    setAvisoUbicacion('Buscando tu ubicación…');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const nueva = { latitud: pos.coords.latitude, longitud: pos.coords.longitude };
        setUbicacion(nueva);
        setAvisoUbicacion('');
        volarA(nueva, 13);
      },
      () => setAvisoUbicacion('No pudimos obtener tu ubicación. Revisá los permisos del navegador.'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  function volarA(punto, zoom = 14.5) {
    setViewState((v) => ({
      ...v,
      longitude: punto.longitud,
      latitude: punto.latitud,
      zoom,
      transitionDuration: 800,
      transitionInterpolator: new FlyToInterpolator(),
    }));
  }

  function elegir(d) {
    setSeleccionado(d.id);
    volarA(d);
  }

  // 5) Capas de deck.gl
  const capas = [
    new TileLayer({
      id: 'mapa-base',
      data: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      minZoom: 0,
      maxZoom: 19,
      tileSize: 256,
      renderSubLayers: (props) => {
        const { west, south, east, north } = props.tile.bbox;
        return new BitmapLayer(props, {
          data: null,
          image: props.data,
          bounds: [west, south, east, north],
        });
      },
    }),
    new ScatterplotLayer({
      id: 'establecimientos',
      data: visibles,
      pickable: true,
      getPosition: (d) => [d.longitud, d.latitud], // deck.gl usa [longitud, latitud]
      getFillColor: (d) => (d.guardia ? COLOR_GUARDIA : COLOR_SIN_GUARDIA),
      getLineColor: (d) => (d.id === seleccionado ? [0, 0, 0, 255] : [255, 255, 255, 255]),
      getLineWidth: (d) => (d.id === seleccionado ? 3 : 1),
      lineWidthUnits: 'pixels',
      stroked: true,
      getRadius: 150,
      radiusUnits: 'meters',
      radiusMinPixels: 6,
      radiusMaxPixels: 20,
      updateTriggers: { getLineColor: seleccionado, getLineWidth: seleccionado },
      onClick: ({ object }) => object && elegir(object),
    }),
    ubicacion &&
      new ScatterplotLayer({
        id: 'mi-ubicacion',
        data: [ubicacion],
        getPosition: (d) => [d.longitud, d.latitud],
        getFillColor: [16, 185, 129, 255],
        getLineColor: [255, 255, 255, 255],
        stroked: true,
        lineWidthMinPixels: 2,
        getRadius: 80,
        radiusUnits: 'meters',
        radiusMinPixels: 8,
      }),
  ];

  function tooltip({ object }) {
    if (!object) return null;
    return {
      html: `<div class="tt">
        <strong>${esc(object.nombre)}</strong><br/>
        Categoría: ${esc(object.categoria)}<br/>
        Valor: ${esc(object.distancia.toFixed(1))} km de distancia<br/>
        ${object.guardia ? '<span class="tt-g">Con guardia</span>' : ''}
      </div>`,
      style: { background: 'transparent', padding: 0 },
    };
  }

  return (
    <div className="app">
      <header className="cabecera">
        <h1>Salud Zona Norte: guardias y hospitales cercanos</h1>
        <p>Tigre · San Fernando · San Isidro · Vicente López</p>
      </header>

      <section className="kpis">
        <div className="kpi">
          <span className="kpi-num">{cargando ? '…' : totalVisibles}</span>
          <span className="kpi-txt">Establecimientos en el mapa</span>
        </div>
        <div className="kpi">
          <span className="kpi-num">{cargando ? '…' : totalGuardia}</span>
          <span className="kpi-txt">Con guardia</span>
        </div>
        <div className="kpi">
          <span className="kpi-num">{masCercano ? formatoKm(masCercano.distancia) : '–'}</span>
          <span className="kpi-txt">
            {masCercano ? `Más cercano: ${masCercano.nombre}` : 'Más cercano'}
          </span>
        </div>
      </section>

      {error && <div className="error">No se pudieron cargar los datos: {error}</div>}

      <section className="controles">
        <button onClick={usarMiUbicacion} className="btn">
          📍 Usar mi ubicación
        </button>
        <label className="chk">
          <input
            type="checkbox"
            checked={soloGuardia}
            onChange={(e) => setSoloGuardia(e.target.checked)}
          />
          Solo con guardia
        </label>
        <select value={partido} onChange={(e) => setPartido(e.target.value)}>
          {partidos.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
        <span className="aviso">
          {avisoUbicacion ||
            (ubicacion ? 'Distancias desde tu ubicación' : 'Distancias desde el centro de San Isidro')}
        </span>
      </section>

      <main className="principal">
        <div className="mapa">
          <DeckGL
            viewState={viewState}
            onViewStateChange={({ viewState }) => setViewState(viewState)}
            controller={true}
            layers={capas}
            getTooltip={tooltip}
          />
          <div className="leyenda">
            <span className="punto rojo" /> Con guardia <span className="punto azul" /> Sin guardia
          </div>
          <div className="atrib">© OpenStreetMap contributors</div>
        </div>

        <aside className="lista">
          <h2>Más cercanos</h2>
          {cargando && <p>Cargando…</p>}
          {!cargando && visibles.length === 0 && <p>No hay resultados con estos filtros.</p>}
          <ol>
            {visibles.slice(0, 10).map((d) => (
              <li
                key={d.id}
                className={d.id === seleccionado ? 'activo' : ''}
                onClick={() => elegir(d)}
              >
                <div className="li-top">
                  <strong>{d.nombre}</strong>
                  <span className="dist">{formatoKm(d.distancia)}</span>
                </div>
                <div className="li-sub">
                  {d.categoria} · {d.partido}
                  {d.guardia && <span className="badge">Guardia</span>}
                </div>
                {d.direccion && <div className="li-sub">{d.direccion}</div>}
                {d.telefono && <div className="li-sub">Tel: {d.telefono}</div>}
              </li>
            ))}
          </ol>
        </aside>
      </main>

      <footer className="pie">
        Información de referencia con datos abiertos de la Provincia de Buenos Aires. Confirmá por teléfono
        antes de ir. En una emergencia llamá al 107 (SAME) o al 911.
      </footer>
    </div>
  );
}
