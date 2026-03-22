# Deployment — TradDing

## Arquitectura de producción

```
Internet
   │
   ├── trad-ding.com        → Frontend (Next.js)   — contenedor en Worker
   └── api.trad-ding.com    → Backend  (FastAPI)    — contenedor en Worker
```

- **Servidor:** Hetzner Worker `46.62.193.225`
- **Reverse proxy / SSL:** Traefik con ACME (Let's Encrypt). Los certificados se generan automáticamente al primer request.
- **Orquestador:** Dokploy gestiona los servicios y lanza `docker compose`.

---

## CI/CD

```
git push origin main
        │
        ▼
GitHub Actions (.github/workflows/)
  ├── Build imagen frontend  →  ghcr.io/<org>/trad-ding-frontend:latest
  └── Build imagen backend   →  ghcr.io/<org>/trad-ding-backend:latest
        │
        ▼
Dokploy webhook  →  docker pull + restart de servicios
```

El workflow se activa en cada push a `main`. Las imágenes se suben a GHCR (GitHub Container Registry) con el tag `latest`.

---

## Imágenes Docker

| Servicio | Base image | Notas |
|---|---|---|
| Frontend (Next.js) | `node:22-slim` | Necesita Node >= 22 por `onnxruntime-node`. No usar Alpine (musl no compatible). |
| Backend (FastAPI) | `python:3.12-slim` | No tiene `curl`; usar `python` para healthchecks. |

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
| URL panel | https://dokploy.trad-ding.com (o la IP del servidor) |

---

## Variables de entorno en producción

Configuradas en Dokploy bajo el servicio correspondiente:

| Variable | Servicio | Descripción |
|---|---|---|
| `SUPABASE_URL` | Frontend + Backend | URL del proyecto Supabase |
| `SUPABASE_KEY` | Frontend + Backend | Service role key de Supabase |
| `NEWS_API_KEY` | Backend | newsapi.org |
| `GROQ_API_KEY` | Backend | console.groq.com (Llama 3.1) |

---

## Cómo hacer redeploy

### Via Dokploy API

```bash
curl -X POST "https://<dokploy-host>/api/compose.redeploy" \
  -H "Authorization: Bearer <DOKPLOY_API_KEY>" \
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

### Healthcheck falla en el backend

`python:3.12-slim` no incluye `curl`. El healthcheck debe usar Python:

```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"
```

### Contenedor no levanta / error en logs

```bash
ssh root@46.62.193.225
docker ps -a                        # ver estado de contenedores
docker logs <container_id>          # ver logs del contenedor
docker compose -f <file> up -d      # relanzar manualmente si hace falta
```
