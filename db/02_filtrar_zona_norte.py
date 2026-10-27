"""
Filtra el dataset "Establecimientos de salud" (datos.gba.gob.ar)
a los partidos de zona norte y lo deja listo para importar en Supabase.

Uso:
    pip install pandas
    python 02_filtrar_zona_norte.py establecimientos.csv

Genera: establecimientos_zona_norte.csv
"""
import re
import sys
import unicodedata

import pandas as pd

PARTIDOS = {"TIGRE", "SAN FERNANDO", "SAN ISIDRO", "VICENTE LOPEZ"}

# --- Categorías que NO sirven para una app de "dónde me atiendo" ------------
# (ambulancias, residencias, zoonosis, etc.). Si querés conservar alguna,
# borrala de esta lista.
EXCLUIR_CATEGORIAS = [
    "SPEMM",                 # sistemas de emergencias móviles (ambulancias)
    "UNIDAD MOVIL",
    "ZOONOSIS",
    "RED ASISTENCIAL",
    "HOGAR DE DIA",
    "RESIDENCIA PARA ADULTOS",
    "CENTRO DE DIA",
    "DISPOSITIVO DE INCLUSION",
    "ESTIMULACION TEMPRANA",
]

# --- Cómo decidimos que un establecimiento "tiene guardia" -------------------
# El dataset NO trae un campo "guardia". Usamos dos reglas:
#  1) Es un establecimiento polivalente CON INTERNACION (hospitales y clínicas
#     generales, que normalmente tienen guardia).
#  2) La especialidad menciona "guardia".
# Es una aproximación: revisá la lista que imprime el script.
CATEGORIA_CON_GUARDIA = "POLIVALENTE"
MODALIDAD_CON_GUARDIA = "CON INTERNACION"
ESPECIALIDAD_REGEX = re.compile(r"GUARDIA")


def normalizar(texto) -> str:
    """Mayúsculas, sin tildes, sin espacios sobrantes."""
    if pd.isna(texto):
        return ""
    t = unicodedata.normalize("NFKD", str(texto))
    t = "".join(c for c in t if not unicodedata.combining(c))
    return t.upper().strip()


def leer_csv(ruta: str) -> pd.DataFrame:
    for enc in ("utf-8-sig", "utf-8", "latin-1"):
        try:
            df = pd.read_csv(ruta, encoding=enc, dtype=str, sep=None, engine="python")
            # nombres de columna en minúscula y sin caracteres raros (BOM)
            df.columns = [c.replace("\ufeff", "").strip().lower() for c in df.columns]
            return df
        except UnicodeDecodeError:
            continue
    raise SystemExit("No pude leer el archivo con ninguna codificación conocida.")


def main(ruta: str) -> None:
    df = leer_csv(ruta)
    print(f"Filas totales: {len(df)}")
    print("Columnas:", list(df.columns))

    faltan = {"nor", "nde", "lat", "long"} - set(df.columns)
    if faltan:
        sys.exit(f"Faltan columnas esperadas: {faltan}. Revisá los nombres de columnas arriba.")

    # 1) Filtrar por partido
    df["_partido_norm"] = df["nde"].map(normalizar)
    df = df[df["_partido_norm"].isin(PARTIDOS)].copy()
    print(f"\nFilas en zona norte: {len(df)}")

    # 2) Coordenadas válidas
    df["lat"] = pd.to_numeric(df["lat"].str.replace(",", "."), errors="coerce")
    df["long"] = pd.to_numeric(df["long"].str.replace(",", "."), errors="coerce")
    antes = len(df)
    df = df.dropna(subset=["lat", "long"])
    print(f"Descartadas sin coordenadas: {antes - len(df)}")

    fuera = df[(df["lat"] < -34.8) | (df["lat"] > -34.3) | (df["long"] < -59.0) | (df["long"] > -58.2)]
    if len(fuera):
        print(f"\nDescartadas por estar fuera de la zona ({len(fuera)}):")
        print(fuera[["nor", "nde", "lat", "long"]].to_string())
        df = df.drop(fuera.index)

    # 3) Excluir categorías que no aplican
    def col(nombre):
        return df[nombre].map(normalizar) if nombre in df.columns else pd.Series("", index=df.index)

    excluir = col("cat").str.contains("|".join(EXCLUIR_CATEGORIAS))
    print(f"Descartadas por categoría no aplicable: {int(excluir.sum())}")
    df = df[~excluir].copy()

    # 4) Marcar guardias
    guardia = (
        (col("cat").str.contains(CATEGORIA_CON_GUARDIA) & col("mod").str.contains(MODALIDAD_CON_GUARDIA))
        | col("esp").str.contains(ESPECIALIDAD_REGEX)
    )

    # 5) Armar salida con las columnas de la tabla de Supabase
    salida = pd.DataFrame(
        {
            "refes": df.get("cnr"),
            "nombre": df["nor"],
            "tipo": "establecimiento",
            "categoria": df.get("cat"),
            "modalidad": df.get("mod"),
            "especialidad": df.get("esp"),
            "financiamiento": df.get("tes"),
            "guardia": guardia.map({True: "true", False: "false"}),
            "partido": df["nde"],
            "localidad": df.get("nba"),
            "direccion": df.get("dom"),
            "telefono": df.get("tel"),
            "latitud": df["lat"],
            "longitud": df["long"],
            "fuente": "datos.gba.gob.ar",
        }
    ).dropna(subset=["nombre"])

    # 6) Resúmenes para revisar
    print(f"\nTOTAL que va a Supabase: {len(salida)}")
    print("\nPor partido:\n", salida["partido"].value_counts())
    print("\nPor categoría:\n", salida["categoria"].value_counts())
    print("\nCon guardia (según la regla):\n", salida["guardia"].value_counts())
    print("\nLISTA COMPLETA marcada con guardia (revisala):")
    print(salida.loc[salida["guardia"] == "true", ["nombre", "partido"]].to_string())

    salida.to_csv("establecimientos_zona_norte.csv", index=False, encoding="utf-8")
    print("\nListo: establecimientos_zona_norte.csv")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("Uso: python 02_filtrar_zona_norte.py <archivo.csv>")
    main(sys.argv[1])
