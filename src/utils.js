// Distancia en km entre dos puntos (fórmula de Haversine)
export function distanciaKm(a, b) {
  const R = 6371;
  const rad = (g) => (g * Math.PI) / 180;
  const dLat = rad(b.latitud - a.latitud);
  const dLon = rad(b.longitud - a.longitud);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitud)) * Math.cos(rad(b.latitud)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Evita inyectar HTML en el tooltip con datos externos
export function esc(texto) {
  return String(texto ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function formatoKm(km) {
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}

// Minúsculas y sin tildes, para buscar sin importar acentos
export function normalizar(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

// ---- Grupos y colores por tipo de establecimiento ----
export const COLORES = {
  'Con guardia': [220, 38, 38],
  'CAPS (salita)': [37, 99, 235],
  'Salud mental': [147, 51, 234],
  Vacunatorio: [13, 148, 136],
  'Rehabilitación': [234, 88, 12],
  'Cirugía ambulatoria': [202, 138, 4],
  Otros: [107, 114, 128],
};

export function grupoDe(d) {
  if (d.guardia) return 'Con guardia';
  const cat = normalizar(d.categoria);
  if (cat.includes('c.a.p.s') || cat.includes('caps')) return 'CAPS (salita)';
  if (cat.includes('salud mental')) return 'Salud mental';
  if (cat.includes('vacunatorio')) return 'Vacunatorio';
  if (cat.includes('rehabilitacion')) return 'Rehabilitación';
  if (cat.includes('cirugia')) return 'Cirugía ambulatoria';
  return 'Otros';
}

export function colorCss(grupo) {
  const [r, g, b] = COLORES[grupo] ?? COLORES.Otros;
  return `rgb(${r}, ${g}, ${b})`;
}

// ---- Acciones: cómo llegar y llamar ----
// Abre Google Maps con la ruta. Si hay ubicación de la persona, la usa como origen.
export function urlComoLlegar(destino, origen) {
  const dest = `${destino.latitud},${destino.longitud}`;
  const base = `https://www.google.com/maps/dir/?api=1&destination=${dest}`;
  return origen ? `${base}&origin=${origen.latitud},${origen.longitud}` : base;
}

// Devuelve solo los dígitos del primer teléfono, o null si no hay uno usable.
// Ejemplo: "11 45123900 Int: 12" -> "1145123900"
export function telefonoParaLlamar(tel) {
  if (!tel) return null;
  const primero = String(tel).split(/[/;,]|\bint\b|\binterno\b/i)[0];
  const digitos = primero.replace(/\D/g, '');
  return digitos.length >= 6 ? digitos : null;
}
