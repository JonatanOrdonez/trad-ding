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

## 3. GHCR necesita `docker login` en el servidor antes del primer deploy

**Problema:** Dokploy no puede bajar imágenes de un repositorio privado de GHCR si el daemon de Docker en el servidor no está autenticado.

**Solución:** Conectarse al servidor una sola vez y hacer login:

```bash
ssh root@46.62.193.225
echo "<GITHUB_TOKEN>" | docker login ghcr.io -u <GITHUB_USER> --password-stdin
```

El token de GitHub necesita el scope `read:packages`. Las credenciales quedan guardadas en `~/.docker/config.json` y no hay que repetirlo.

---

## 4. Traefik: reiniciar para reintentar generación de certificado ACME

**Problema:** El certificado SSL de Let's Encrypt no se generó automáticamente al hacer el primer deploy (Traefik falló silenciosamente en el challenge ACME).

**Solución:** Reiniciar el contenedor de Traefik fuerza un reintento:

```bash
ssh root@46.62.193.225
docker restart traefik
```

Esto suele resolver el problema si el DNS ya apunta correctamente al servidor.

---

## 5. La carpeta `public/` no existe en este proyecto

**Problema:** El `Dockerfile` del frontend incluía `COPY public/ ./public/`, lo que causaba un error de build porque la carpeta no existe en el repositorio.

**Solución:** Eliminar esa línea del Dockerfile. Next.js no requiere `public/` si no hay assets estáticos.

Verificar antes de agregar cualquier `COPY` en el Dockerfile que el directorio o archivo origen realmente exista en el repo.

---

## 6. Arquitectura: toda la lógica vive en Next.js

El proyecto es un monolito Next.js. No hay backend Python separado.

- Toda la lógica API (assets, news, predictions, training) vive en **Next.js Route Handlers** (`web/src/app/`).
- El training se orquesta desde `POST /api/train` (Next.js) → Modal web endpoint (Python serverless).
- El código Python solo existe en `modal/` para la función de entrenamiento en Modal.
