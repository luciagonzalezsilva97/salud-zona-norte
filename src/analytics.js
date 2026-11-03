// Google Analytics 4. Solo se activa si existe VITE_GA_ID (el ID de medición, tipo G-XXXXXXXXXX).
// En tu compu, sin esa variable, no se envía nada (así no ensuciás las estadísticas con tus pruebas).
const GA_ID = import.meta.env.VITE_GA_ID;

export function iniciarAnalytics() {
  if (!GA_ID || window.gtag) return;

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function () {
    window.dataLayer.push(arguments); // gtag necesita 'arguments', no un array
  };
  window.gtag('js', new Date());
  window.gtag('config', GA_ID);
}

// Envía un evento. No mandamos datos personales (ni la ubicación de la persona).
export function evento(nombre, parametros = {}) {
  if (!GA_ID || typeof window.gtag !== 'function') return;
  window.gtag('event', nombre, parametros);
}
