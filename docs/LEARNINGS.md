# Lecciones aprendidas — TradDing

Cosas no obvias que descubrimos durante el setup y deploy inicial. Leer antes de tocar Dockerfiles, CI/CD o configuración del servidor.

---

## 1. Next.js evalúa Route Handlers en tiempo de build

**Problema:** `npm run build` fallaba con errores de módulos que intentaban leer variables de entorno (`SUPABASE_URL`, `GROQ_API_KEY`, etc.) que no existían en el contexto del contenedor durante el build.

**Por qué:** Next.js 15 con App Router ejecuta los Route Handlers (`route.ts`) en tiempo de build para análisis estático. Si el módulo importado accede a `process.env` al inicializarse, falla.

**Solución:** Pasar valores dummy como `ARG` en el `Dockerfile` antes del paso `RUN npm run build`. No necesitan ser reales; solo evitar que el proceso explote.

```dockerfile
ARG SUPABASE_URL=http://placeholder
ENV SUPABASE_URL=$SUPABASE_URL
RUN npm run build
```

---

## 2. Alpine Linux no funciona con `onnxruntime-node`

**Problema:** El frontend usaba `node:22-alpine` y el build o runtime fallaba al cargar `onnxruntime-node`.

**Por qué:** `onnxruntime-node` incluye binarios nativos compilados contra `glibc`. Alpine usa `musl` como libc alternativa, lo cual es incompatible.

**Solución:** Usar `node:22-slim` (Debian slim, tiene glibc). Nunca usar Alpine para este proyecto en el frontend.

**Requisito adicional:** Node >= 22. Versiones anteriores no son compatibles con la versión de `onnxruntime-node` usada.

---

## 3. `python:3.12-slim` no tiene `curl`

**Problema:** El `HEALTHCHECK` del Dockerfile del backend usaba `curl`, que no está instalado en `python:3.12-slim`.

**Solución:** Usar Python directamente para el healthcheck:

```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"
```

Alternativa: instalar `curl` con `apt-get install -y curl`, pero agrega peso innecesario a la imagen.

---

## 4. GHCR necesita `docker login` en el servidor antes del primer deploy

**Problema:** Dokploy no puede bajar imágenes de un repositorio privado de GHCR si el daemon de Docker en el servidor no está autenticado.

**Solución:** Conectarse al servidor una sola vez y hacer login:

```bash
ssh root@46.62.193.225
echo "<GITHUB_TOKEN>" | docker login ghcr.io -u <GITHUB_USER> --password-stdin
```

El token de GitHub necesita el scope `read:packages`. Las credenciales quedan guardadas en `~/.docker/config.json` y no hay que repetirlo.

---

## 5. Traefik: reiniciar para reintentar generación de certificado ACME

**Problema:** El certificado SSL de Let's Encrypt no se generó automáticamente al hacer el primer deploy (Traefik falló silenciosamente en el challenge ACME).

**Solución:** Reiniciar el contenedor de Traefik fuerza un reintento:

```bash
ssh root@46.62.193.225
docker restart traefik
```

Esto suele resolver el problema si el DNS ya apunta correctamente al servidor.

---

## 6. La carpeta `public/` no existe en este proyecto

**Problema:** El `Dockerfile` del frontend incluía `COPY public/ ./public/`, lo que causaba un error de build porque la carpeta no existe en el repositorio.

**Solución:** Eliminar esa línea del Dockerfile. Next.js no requiere `public/` si no hay assets estáticos.

Verificar antes de agregar cualquier `COPY` en el Dockerfile que el directorio o archivo origen realmente exista en el repo.

---

## 7. Estructura del proyecto: la mayoría de la lógica API está en Next.js Route Handlers

El proyecto fue reestructurado. Hoy en día:

- La lógica de análisis, noticias y predicciones vive en **Next.js Route Handlers** (`src/app/api/`).
- El **backend Python (FastAPI)** solo maneja `/train`.

Al agregar nuevos endpoints o modificar la lógica de la API, buscar primero en `src/app/api/` antes de asumir que está en `backend/`.
