# Deployment — TradDing

## Arquitectura de producción

```
Internet
   │
   ├── trad-ding.com        → Next.js container (UI + API + training)
   └── api.trad-ding.com    → Same Next.js container
```

- **Servidor:** Hetzner Worker `46.62.193.225`
- **Reverse proxy / SSL:** Traefik con ACME (Let's Encrypt). Los certificados se generan automáticamente al primer request.
- **Orquestador:** Dokploy gestiona el servicio y lanza `docker compose`.
- **Contenedor único:** Next.js 15 standalone maneja toda la lógica (UI, API, training orchestration).

---

## CI/CD

```
git push origin main
        │
        ▼
GitHub Actions (.github/workflows/)
  └── Build imagen frontend  →  ghcr.io/<org>/trad-ding/frontend:latest
        │
        ▼
Dokploy webhook  →  docker pull + restart de servicios
```

El workflow se activa en cada push a `main`. Las imágenes se suben a GHCR (GitHub Container Registry) con el tag `latest`.

---

## Imágenes Docker

| Servicio | Base image | Notas |
|---|---|---|
| Next.js (único contenedor) | `node:22-slim` | Necesita Node >= 22 por `onnxruntime-node`. No usar Alpine (musl no compatible). |

### Build-time: variables de entorno dummy en el frontend

Next.js evalúa los Route Handlers en tiempo de build. Si alguna variable de entorno requerida no existe, el build falla. Solución: pasar valores dummy en el `Dockerfile` durante el `npm run build`:

```dockerfile
ARG SUPABASE_URL=http://placeholder
ARG SUPABASE_KEY=placeholder
ARG GROQ_API_KEY=placeholder
ARG NEWS_API_KEY=placeholder
ENV SUPABASE_URL=$SUPABASE_URL
...
RUN npm run build
```

---

## Dokploy

| Dato | Valor |
|---|---|
| Project ID | `pBxhlBCL1hu5paPYL90DG` |
| Compose ID | `M1htexJlpnKvp5xeyr3BN` |
| URL panel | https://dokploy.astrolab.com.co |
| Deploy webhook | `POST https://dokploy.astrolab.com.co/api/deploy/compose/755eJFwdVX0QWiVly_1Mj` |

### Compose actualizado (monolito Next.js)

El compose en Dokploy define un **único contenedor** (sin backend Python):

```yaml
services:
  tradding-frontend:
    image: ghcr.io/jonatanordonez/trad-ding/frontend:latest
    pull_policy: always
    restart: always
    environment:
      SUPABASE_URL: ${SUPABASE_URL}
      SUPABASE_KEY: ${SUPABASE_KEY}
      NEWS_API_KEY: ${NEWS_API_KEY}
      GROQ_API_KEY: ${GROQ_API_KEY}
      TRAIN_API_KEY: ${TRAIN_API_KEY}
    networks:
      - dokploy-network
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.tradding-frontend.rule=Host(`trad-ding.com`) || Host(`www.trad-ding.com`) || Host(`api.trad-ding.com`)"
      - "traefik.http.routers.tradding-frontend.entrypoints=websecure"
      - "traefik.http.routers.tradding-frontend.tls.certresolver=letsencrypt"
      - "traefik.http.services.tradding-frontend.loadbalancer.server.port=3000"

networks:
  dokploy-network:
    external: true
```

> **Importante:** `pull_policy: always` es obligatorio. Sin él, Docker reutiliza la imagen cacheada con tag `latest` y no baja la nueva versión.

---

## Variables de entorno en producción

Configuradas en Dokploy bajo el servicio correspondiente:

| Variable | Descripción |
|---|---|
| `SUPABASE_URL` | URL del proyecto Supabase |
| `SUPABASE_KEY` | Service role key de Supabase |
| `NEWS_API_KEY` | newsapi.org |
| `GROQ_API_KEY` | console.groq.com (Llama 3.1) |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST endpoint |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis auth token |
| `TRAIN_API_KEY` | Secreto compartido para POST /api/train + Modal |
| `MODAL_TRAIN_URL` | URL del web endpoint de Modal para training |

---

## Endpoint de training (`POST /api/train`)

El entrenamiento ML se dispara via HTTP, protegido por API key:

```bash
curl -X POST https://trad-ding.com/api/train \
  -H "X-API-Key: <TRAIN_API_KEY>"
```

### Protecciones

| Capa | Comportamiento | Requisito |
|---|---|---|
| **Auth** | Valida header `X-API-Key` contra env `TRAIN_API_KEY` | Siempre activa |
| **Rate limit** | Máximo 1 ejecución cada 30 minutos | Requiere Upstash Redis |
| **Concurrency lock** | Impide ejecución paralela | Requiere Upstash Redis |

### Configurar TRAIN_API_KEY

1. Generar una key segura:
   ```bash
   openssl rand -hex 32
   ```

2. Configurar en Dokploy via API:
   ```bash
   curl -X POST "https://dokploy.astrolab.com.co/api/compose.update" \
     -H "x-api-key: <DOKPLOY_API_KEY>" \
     -H "Content-Type: application/json" \
     -d '{"composeId": "M1htexJlpnKvp5xeyr3BN", "env": "...todas las vars...\nTRAIN_API_KEY=<la key generada>"}'
   ```

   O desde el panel web de Dokploy → TradDing → Environment Variables.

3. Redeploy para que tome efecto.

### Flujo completo

```
POST /api/train (X-API-Key header)
  → Auth check (403 si inválida)
  → Rate limit check (429 si <30 min desde última ejecución)
  → Concurrency lock (409 si ya hay uno corriendo)
  → Para cada asset:
      → Fetch 1 año de datos de Yahoo Finance
      → Llama Modal web endpoint (XGBoost training)
      → Guarda modelo en Supabase si mejoró o es >5 días antiguo
  → Retorna resultados JSON
```

---

## Cómo hacer redeploy

### Via Dokploy API

```bash
curl -X POST "https://dokploy.astrolab.com.co/api/compose.deploy" \
  -H "x-api-key: <DOKPLOY_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"composeId": "M1htexJlpnKvp5xeyr3BN"}'
```

### Via panel web

1. Entrar al panel de Dokploy.
2. Seleccionar el proyecto TradDing.
3. Click en "Redeploy".

### Flujo normal (recomendado)

Hacer `git push origin main` y dejar que GitHub Actions + el webhook de Dokploy hagan el resto.

---

## Troubleshooting

### SSL / certificados Traefik

Si el certificado no se genera o está expirado:

```bash
ssh root@46.62.193.225
docker restart traefik
```

Traefik reintentará el challenge ACME al reiniciar.

### GHCR: error al hacer pull en el servidor

El servidor necesita autenticarse en GHCR antes de poder bajar imágenes privadas:

```bash
ssh root@46.62.193.225
echo "<GITHUB_TOKEN>" | docker login ghcr.io -u <GITHUB_USER> --password-stdin
```

Hacer esto una sola vez; Docker guarda las credenciales en `~/.docker/config.json`.

### Contenedor no levanta / error en logs

```bash
ssh root@46.62.193.225
docker ps -a                        # ver estado de contenedores
docker logs <container_id>          # ver logs del contenedor
docker compose -f <file> up -d      # relanzar manualmente si hace falta
```
