# Índice de documentación — TradDing

Lee este archivo al inicio de cualquier tarea para saber qué documentación existe y cuándo consultarla.

---

## Documentos disponibles (Diataxis)

### Explanation (¿por qué? ¿cómo funciona?)

| Archivo | Descripción | Cuándo leerlo |
|---|---|---|
| [`architecture.md`](architecture.md) | Arquitectura completa: componentes, flujos de datos, servicios externos, modelo de datos, deployment. | Antes de agregar features, cambiar integraciones, o entender cómo encajan las piezas. |

### How-to (¿cómo hago X?)

| Archivo | Descripción | Cuándo leerlo |
|---|---|---|
| [`DEPLOYMENT.md`](DEPLOYMENT.md) | Arquitectura de producción, CI/CD, Dokploy, variables de entorno, redeploy y troubleshooting. | Antes de hacer deploy, cambiar infraestructura, o depurar problemas en producción. |

### Reference (datos puntuales)

| Archivo | Descripción | Cuándo leerlo |
|---|---|---|
| [`LEARNINGS.md`](LEARNINGS.md) | Lecciones aprendidas: Docker, Next.js build-time, Alpine vs glibc, Traefik, GHCR, estructura del proyecto. | Antes de tocar Dockerfiles, CI/CD, o configuración de servidor. |

### Otros

| Archivo | Descripción |
|---|---|
| [`../INDEX.md`](../INDEX.md) | Catálogo maestro del proyecto (<100 líneas). Visión general, invariantes, quick reference. |
| [`../CLAUDE.md`](../CLAUDE.md) | Instrucciones para el asistente AI: convenciones, comandos, resumen de arquitectura. |

---

## Cuándo actualizar la documentación

- Al completar una tarea de deploy o infraestructura: actualizar `DEPLOYMENT.md` si cambia algo.
- Si descubres algo no obvio sobre el stack: agregar a `LEARNINGS.md`.
- Si cambia la arquitectura (nuevos servicios, flujos, componentes): actualizar `architecture.md`.
- Si agregas un documento nuevo: registrarlo aquí y en `../INDEX.md`.
