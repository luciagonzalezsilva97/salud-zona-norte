import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseConfigurado = Boolean(url && anonKey);

// Si faltan las variables no creamos el cliente (la app muestra un aviso).
export const supabase = supabaseConfigurado ? createClient(url, anonKey) : null;
