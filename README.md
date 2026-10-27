# Salud Zona Norte: guardias y hospitales cercanos

PoC de datos georreferenciados: **Dataset → Supabase → React/Vite → deck.gl → Vercel**.
Muestra hospitales y establecimientos de salud de Tigre, San Fernando, San Isidro y Vicente López,
con filtro de guardias y distancia a tu ubicación.

## Paso 1. Crear el proyecto en Supabase
1. Entrá a https://supabase.com, creá una cuenta y un proyecto nuevo (guardá la contraseña de la base).
2. Menú **SQL Editor → New query**, pegá el contenido de `db/01_schema.sql` y apretá **Run**.
3. Verificá en **Table Editor** que existan las tablas `establecimientos` y `turnos`.

## Paso 2. Descargar y preparar el dataset
1. Entrá a https://catalogo.datos.gba.gob.ar y buscá el dataset **"Establecimientos de salud"**.
2. Descargá el archivo en formato **CSV**.
3. Ejecutá (necesitás Python y pandas: `pip install pandas`):
   ```
   python db/02_filtrar_zona_norte.py ARCHIVO_DESCARGADO.csv
   ```
4. Mirá lo que imprime: partidos, categorías, modalidades y qué quedó marcado con guardia.
   Si la regla de guardias no te convence, editá `GUARDIA_REGEX` y `HOSPITALES_CUENTAN_COMO_GUARDIA`
   al comienzo del script y volvé a correrlo.
5. Se genera `establecimientos_zona_norte.csv`.

## Paso 3. Cargar los datos en Supabase
1. **Table Editor → establecimientos → Insert → Import data from CSV**.
2. Subí `establecimientos_zona_norte.csv`. No tenés que cargar `id` ni `actualizado` (se completan solos).
3. Verificá que las filas estén y que `latitud`/`longitud` tengan valores como -34.47 / -58.51.

## Paso 4. Conectar la app
1. En Supabase: **Project Settings → API**. Copiá la **Project URL** y la clave **anon / public**.
2. Copiá `.env.example` como `.env` y pegá esos dos valores.
   (Nunca uses la clave `service_role` en la app.)

## Paso 5. Probar en tu computadora
```
npm install
npm run dev
```
Abrí la dirección que aparece (http://localhost:5173). Abrí la consola del navegador (F12):
vas a ver `Respuesta de Supabase` con los registros (eso cumple la etapa 4 de la consigna).

## Paso 6. Publicar en Vercel
1. Subí esta carpeta a un repositorio de GitHub (el `.gitignore` ya excluye `.env` y `node_modules`).
2. En https://vercel.com: **Add New → Project → importá el repositorio**. Vercel detecta Vite solo.
3. Antes de **Deploy**, en **Environment Variables** agregá:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy. Te da una URL pública `https://tu-proyecto.vercel.app`. Probala desde el celular.
   (El botón "Usar mi ubicación" funciona porque Vercel usa HTTPS.)

## Entrega (según la consigna)
1. URL de Vercel.
2. Captura de pantalla del tablero.
3. Repositorio o código.
4. Dataset utilizado (`establecimientos_zona_norte.csv`).
5. Descripción de máximo 5 líneas. Borrador para ajustar:
   > Analizamos qué hospitales y establecimientos con guardia hay disponibles cerca de una persona en la zona norte del GBA.
   > Los datos son del catálogo de datos abiertos de la Provincia de Buenos Aires (establecimientos de salud).
   > El mapa muestra cada establecimiento como un punto (rojo: con guardia, azul: sin guardia).
   > Permite ver cuáles están más cerca de la ubicación de la persona, su categoría, dirección y teléfono.
   > En una segunda versión sumaríamos farmacias de turno actualizadas automáticamente y rutas hasta el destino.

## Notas honestas
- "Con guardia" es una **regla aproximada** calculada por el script, no un dato oficial. Verificala.
- La app no sabe si una guardia está colapsada o abierta en este momento: es información de referencia.
- Segunda etapa (farmacias de turno): la tabla `turnos` ya está creada para eso.
