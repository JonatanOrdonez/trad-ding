# Índice de documentación — TradDing

Lee este archivo al inicio de cualquier tarea para saber qué documentación existe y cuándo consultarla.

---

## Documentos disponibles

| Archivo | Descripción | Cuándo leerlo |
|---|---|---|
| `docs/INDEX.md` | Este archivo. Índice general. | Al inicio de cualquier tarea. |
| `docs/DEPLOYMENT.md` | Arquitectura de producción, CI/CD, Dokploy, variables de entorno, redeploy y troubleshooting. | Antes de hacer deploy, cambiar infraestructura, o depurar problemas en producción. |
| `docs/LEARNINGS.md` | Lecciones aprendidas durante el setup inicial: Docker, Next.js build, Alpine vs glibc, Traefik, GHCR. | Antes de tocar Dockerfiles, CI/CD, o configuración de servidor. |
| `CLAUDE.md` | Visión general del proyecto, comandos, arquitectura de código, convenciones y variables de entorno. | Siempre. Es el punto de entrada principal. |

---

## Cuándo actualizar la documentación

- Al completar una tarea de deploy o infraestructura: actualizar `docs/DEPLOYMENT.md` si cambia algo.
- Si descubres algo no obvio sobre el stack (Docker, Next.js, Traefik, etc.): agregar a `docs/LEARNINGS.md`.
- Si agregas un documento nuevo: registrarlo aquí en `docs/INDEX.md`.
