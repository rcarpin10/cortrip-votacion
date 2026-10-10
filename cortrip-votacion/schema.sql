-- CORTRIP backend: esquema PostgreSQL
CREATE TABLE socios (
  cedula TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  categoria TEXT NOT NULL CHECK (categoria IN ('activo','honorario','vitalicio')),
  al_dia BOOLEAN NOT NULL DEFAULT false,
  correo TEXT, whatsapp TEXT,
  fuente TEXT NOT NULL, creado_en TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE elecciones (
  id SERIAL PRIMARY KEY, nombre TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador','abierta','cerrada','escrutada')),
  clave_publica TEXT, padron_hash TEXT,
  umbral INT NOT NULL DEFAULT 3, miembros INT NOT NULL DEFAULT 5
);
CREATE TABLE listas (id SERIAL PRIMARY KEY, eleccion_id INT REFERENCES elecciones, nombre TEXT NOT NULL);
-- Padrón congelado: copia inmutable de quienes pueden votar
CREATE TABLE padron_congelado (eleccion_id INT REFERENCES elecciones, cedula TEXT, PRIMARY KEY (eleccion_id, cedula));
-- Participación: SOLO quién votó (sin qué votó)
CREATE TABLE participacion (eleccion_id INT, cedula TEXT, PRIMARY KEY (eleccion_id, cedula));
-- Votos: SIN cédula, SIN hora; contenido cifrado con la clave de la elección
CREATE TABLE votos (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), eleccion_id INT NOT NULL, cifrado TEXT NOT NULL);
CREATE TABLE otp (cedula TEXT, eleccion_id INT, codigo_hash TEXT, expira TIMESTAMPTZ, intentos INT DEFAULT 0, usado BOOLEAN DEFAULT false);
-- Bitácora con hash encadenado (no se puede alterar sin romper la cadena)
CREATE TABLE auditoria (seq BIGSERIAL PRIMARY KEY, evento TEXT NOT NULL, detalle JSONB, prev_hash TEXT NOT NULL, hash TEXT NOT NULL, ts TIMESTAMPTZ DEFAULT now());
-- Impedir UPDATE/DELETE en tablas críticas
CREATE FUNCTION inmutable() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'tabla inmutable'; END $$ LANGUAGE plpgsql;
CREATE TRIGGER t1 BEFORE UPDATE OR DELETE ON votos FOR EACH ROW EXECUTE FUNCTION inmutable();
CREATE TRIGGER t2 BEFORE UPDATE OR DELETE ON auditoria FOR EACH ROW EXECUTE FUNCTION inmutable();
CREATE TRIGGER t3 BEFORE UPDATE OR DELETE ON padron_congelado FOR EACH ROW EXECUTE FUNCTION inmutable();
CREATE TRIGGER t4 BEFORE UPDATE OR DELETE ON participacion FOR EACH ROW EXECUTE FUNCTION inmutable();
