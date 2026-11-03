import { useEffect, useMemo, useState } from 'react';
import {
  DeckGL,
  ScatterplotLayer,
  TileLayer,
  BitmapLayer,
  FlyToInterpolator,
} from 'deck.gl';
import { supabase, supabaseConfigurado } from './supabaseClient';
import { evento } from './analytics';
import {
  COLORES,
  colorCss,
  distanciaKm,
  esc,
  formatoKm,
  grupoDe,
  normalizar,
  telefonoParaLlamar,
  urlComoLlegar,
} from './utils';

// Punto de referencia por defecto (centro de San Isidro) hasta que la persona comparta su ubicación
const REFERENCIA_POR_DEFECTO = { latitud: -34.4708, longitud: -58.5286 };

const VISTA_INICIAL = {
  longitude: -58.5286,
  latitude: -34.4708,
  zoom: 11.2,
  pitch: 0,
  bearing: 0,
};

// Datos que se mandan a Analytics con cada evento (sin información personal)
function datosEvento(d) {
  return { nombre_establecimiento: d.nombre, partido: d.partido, grupo: d.grupo };
}

// Botones "Cómo llegar" y "Llamar" (se usan en la lista y en el detalle)
function Acciones({ d, origen }) {
  const tel = telefonoParaLlamar(d.telefono);
  return (
    <div className="acciones" onClick={(e) => e.stopPropagation()}>
      <a
        className="btn-accion principal"
        href={urlComoLlegar(d, origen)}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => evento('como_llegar', datosEvento(d))}
      >
        🧭 Cómo llegar
      </a>
      {tel ? (
        <a className="btn-accion" href={`tel:${tel}`} onClick={() => evento('llamar', datosEvento(d))}>
          📞 Llamar
        </a>
      ) : (
        <span className="sin-tel">Sin teléfono</span>
      )}
    </div>
  );
}

export default function App() {
  const [datos, setDatos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const [soloGuardia, setSoloGuardia] = useState(true);
  const [partido, setPartido] = useState('Todos');
  const [busqueda, setBusqueda] = useState('');
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

  // Búsquedas: se envía el texto cuando la persona deja de escribir un momento
  useEffect(() => {
    const q = busqueda.trim();
    if (q.length < 3) return;
    const t = setTimeout(() => evento('search', { search_term: q }), 1200);
    return () => clearTimeout(t);
  }, [busqueda]);

  const referencia = ubicacion ?? REFERENCIA_POR_DEFECTO;

  // 2) Calcular el "valor" de cada punto (distancia en km) y su grupo/color
  const conDistancia = useMemo(
    () =>
      datos.map((d) => ({
        ...d,
        categoria: d.categoria || 'Sin dato',
        grupo: grupoDe(d),
        distancia: distanciaKm(referencia, d),
        texto: normalizar(`${d.nombre} ${d.localidad} ${d.direccion} ${d.categoria}`),
      })),
    [datos, referencia]
  );

  const partidos = useMemo(
    () => ['Todos', ...Array.from(new Set(datos.map((d) => d.partido).filter(Boolean))).sort()],
    [datos]
  );

  // 3) Filtros (guardia, partido, búsqueda por texto) y orden por cercanía
  const visibles = useMemo(() => {
    const q = normalizar(busqueda);
    return conDistancia
      .filter((d) => (soloGuardia ? d.guardia : true))
      .filter((d) => (partido === 'Todos' ? true : d.partido === partido))
      .filter((d) => (q ? d.texto.includes(q) : true))
      .sort((a, b) => a.distancia - b.distancia);
  }, [conDistancia, soloGuardia, partido, busqueda]);

  // 4) Indicadores (calculados con los datos de Supabase)
  const totalVisibles = visibles.length;
  const totalGuardia = visibles.filter((d) => d.guardia).length;
  const masCercano = visibles[0];

  const gruposPresentes = useMemo(
    () => Object.keys(COLORES).filter((g) => visibles.some((d) => d.grupo === g)),
    [visibles]
  );

  const detalle = seleccionado ? conDistancia.find((d) => d.id === seleccionado) : null;

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
        evento('usar_ubicacion', { resultado: 'permitida' }); // no se envían las coordenadas
      },
      () => {
        setAvisoUbicacion('No pudimos obtener tu ubicación. Revisá los permisos del navegador.');
        evento('usar_ubicacion', { resultado: 'denegada' });
      },
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
    evento('ver_establecimiento', datosEvento(d));
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
      getFillColor: (d) => [...(COLORES[d.grupo] ?? COLORES.Otros), 220],
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
        <input
          className="buscador"
          type="search"
          placeholder="🔎 Buscar por nombre, barrio o dirección"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        <label className="chk">
          <input
            type="checkbox"
            checked={soloGuardia}
            onChange={(e) => {
              setSoloGuardia(e.target.checked);
              evento('filtro_guardia', { solo_guardia: e.target.checked ? 'si' : 'no' });
            }}
          />
          Solo con guardia
        </label>
        <select
          value={partido}
          onChange={(e) => {
            setPartido(e.target.value);
            evento('filtro_partido', { partido: e.target.value });
          }}
        >
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
            {gruposPresentes.map((g) => (
              <span key={g} className="leyenda-item">
                <span className="punto" style={{ background: colorCss(g) }} /> {g}
              </span>
            ))}
          </div>
          <div className="atrib">© OpenStreetMap contributors</div>
        </div>

        <aside className="lista">
          {detalle && (
            <div className="detalle">
              <div className="detalle-top">
                <strong>{detalle.nombre}</strong>
                <button className="cerrar" onClick={() => setSeleccionado(null)} aria-label="Cerrar">
                  ✕
                </button>
              </div>
              <div className="li-sub">
                <span className="punto" style={{ background: colorCss(detalle.grupo) }} /> {detalle.grupo} ·{' '}
                {formatoKm(detalle.distancia)}
              </div>
              <div className="li-sub">{detalle.categoria}</div>
              {detalle.direccion && (
                <div className="li-sub">
                  {detalle.direccion}
                  {detalle.localidad ? `, ${detalle.localidad}` : ''}
                </div>
              )}
              {detalle.telefono && <div className="li-sub">Tel: {detalle.telefono}</div>}
              <Acciones d={detalle} origen={ubicacion} />
            </div>
          )}

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
                  <span className="punto" style={{ background: colorCss(d.grupo) }} /> {d.categoria} ·{' '}
                  {d.partido}
                </div>
                {d.direccion && <div className="li-sub">{d.direccion}</div>}
                <Acciones d={d} origen={ubicacion} />
              </li>
            ))}
          </ol>
        </aside>
      </main>

      <footer className="pie">
        Información de referencia con datos abiertos de la Provincia de Buenos Aires. Confirmá por teléfono
        antes de ir. En una emergencia llamá al 107 (SAME) o al 911. Esta página usa Google Analytics para
        medir el uso de forma anónima.
      </footer>
    </div>
  );
}
