# Deploy trad-ding

trad-ding tiene **dos targets de deploy**:

| Target | Qué despliega | Cómo |
|---|---|---|
| **Dokploy (Hetzner)** | Next.js app (UI + toda la API) | `git push origin main` — CI/CD automático |
| **Modal** | Función de ML training | `modal deploy modal/modal_app.py` |

Ver `docs/DEPLOYMENT.md` para detalles completos de infraestructura.

---

## Flujo normal (recomendado)

```bash
git push origin main
```

GitHub Actions (`.github/workflows/build-and-push.yml`) hace automáticamente:
1. Build de la imagen Docker desde `Dockerfile.frontend`
2. Push a GHCR (`ghcr.io/jonatanordonez/trad-ding/frontend:latest`)
3. Dispara el webhook de Dokploy → `docker pull` + restart del contenedor

Monitorear el build en la pestaña **Actions** de GitHub.

---

## 1. Build check antes de hacer push

```bash
cd web && npm run build
```

Corregir cualquier error de TypeScript o build antes de continuar.

---

## 2. Deploy a Dokploy

```bash
git push origin main
```

### Redeploy manual (si es necesario)

Via Dokploy API:

```bash
curl -X POST "https://dokploy.trad-ding.com/api/compose.redeploy" \
  -H "Authorization: Bearer <DOKPLOY_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"composeId": "M1htexJlpnKvp5xeyr3BN"}'
```

Via panel web:
1. Abrir https://dokploy.trad-ding.com
2. Seleccionar el proyecto TradDing
3. Click en **Redeploy**

### Verificar el deploy

```bash
curl https://trad-ding.com/health
# → {"status":"OK"}
```

---

## 3. Deploy de la función de ML training a Modal

Solo necesario cuando cambia `modal/modal_app.py` o `modal/features.py`:

```bash
modal deploy modal/modal_app.py
```

Crea/actualiza el web endpoint e imprime la nueva URL. Si la URL cambia, actualizar `MODAL_TRAIN_URL` en las variables de entorno de Dokploy.

```bash
modal app list
# trad-ding-training debe aparecer como deployed
```

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
| `TRAIN_API_KEY` | Secreto compartido para `POST /api/train` + Modal auth |
| `MODAL_TRAIN_URL` | URL del web endpoint de Modal para training |

---

## Troubleshooting

### SSL / certificados Traefik

Si el certificado no se genera o está expirado:

```bash
ssh root@46.62.193.225
docker restart traefik
```

### GHCR: error al hacer pull en el servidor

```bash
ssh root@46.62.193.225
echo "<GITHUB_TOKEN>" | docker login ghcr.io -u <GITHUB_USER> --password-stdin
```

Solo hace falta hacerlo una vez. El token necesita el scope `read:packages`.

### Contenedor no levanta / error en logs

```bash
ssh root@46.62.193.225
docker ps -a                       # ver estado de contenedores
docker logs <container_id>         # ver logs
docker compose -f <file> up -d     # relanzar manualmente si hace falta
```

### Build falla por variables de entorno

Next.js evalúa los Route Handlers en tiempo de build. Si faltan variables, el build falla. El `Dockerfile.frontend` ya pasa valores dummy — si agregas una nueva variable de entorno usada al inicializar un módulo, también agrégala como `ARG` en el Dockerfile:

```dockerfile
ARG NUEVA_VAR=placeholder
ENV NUEVA_VAR=$NUEVA_VAR
```

---

## Notas

- **Sin migraciones de base de datos** — el esquema se gestiona directamente en Supabase.
- **Contenedor único** — Next.js maneja todo. No hay backend separado que desplegar.
- **Feature engineering** — si cambias `modal/features.py`, actualiza también `web/src/lib/features.ts` antes de hacer deploy.
