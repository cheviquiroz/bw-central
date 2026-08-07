# BWise OGUC — Revisor de Cumplimiento Normativo para modelos IFC

Herramienta para revisar modelos IFC contra la Ordenanza General de Urbanismo
y Construcciones (OGUC) de Chile. Combina un visor 3D con un motor de reglas
normativas y un flujo de revisión estructurado.

## Qué hace actualmente

- **Visor IFC 3D** (That Open Company + Three.js): carga modelos IFC,
  navegación 3D, árbol espacial, panel de propiedades.
- **Motor de cumplimiento OGUC** (`packages/oguc-core`): evalúa un modelo
  contra un conjunto acotado de reglas normativas y genera hallazgos
  (*findings*).
- **Flujo de revisión** en `/revision`: un Pre-Check de calidad de datos
  antes de habilitar la revisión, seguido de un espacio de revisión con
  tabla de hallazgos sincronizada con el visor 3D.
- **Persistencia de revisión** en archivo `.bwrev` (JSON plano,
  client-side, sin backend): guardar, cerrar, reabrir y retomar una
  revisión.
- **Generación de reportes** PDF y Excel a partir de los hallazgos de una
  revisión.

## Estado actual

En desarrollo activo. El núcleo de valor del producto — una capa de
clasificación OGUC asistida y un cuadro de superficies — todavía está en
construcción. Las reglas de cumplimiento implementadas hoy son limitadas
(ver `packages/oguc-core/README.md` para el detalle exacto y sus
limitaciones conocidas). No hay backend ni multiusuario: todo corre en el
navegador.

## Quick Start

Requiere [pnpm](https://pnpm.io/) (el repo usa `workspace:*` para las
dependencias internas) y Node 24+.

```bash
# Desde la raíz del monorepo
pnpm install

# Levantar el visor en modo desarrollo
pnpm dev:viewer-oguc
# o, equivalente, desde apps/viewer-oguc:
cd apps/viewer-oguc && pnpm dev

# Build de producción del visor
pnpm build:viewer-oguc

# Chequeo de arquitectura (reglas de dependencia entre packages/apps)
pnpm check:architecture
```

Cada package tiene sus propios scripts (`test`, `build`, `type-check`)
declarados en su propio `package.json` — correrlos desde ese directorio o
vía `pnpm --filter <nombre> <script>` desde la raíz.

## Estructura del monorepo

```
bw-central/
├── apps/
│   └── viewer-oguc/        # Aplicación principal (React + Vite)
├── packages/
│   ├── ifc-headless/       # Parser IFC headless (Node, sin DOM ni React)
│   ├── ifc-core/           # Utilidades de dominio IFC compartidas
│   ├── oguc-core/          # Motor de reglas de cumplimiento OGUC
│   ├── report-core/        # Generación de reportes PDF/Excel
│   ├── bcf-core/           # Dominio BCF (issues de coordinación)
│   └── ids-core/           # Dominio IDS (Information Delivery Specification)
├── public/                 # Fixtures IFC de referencia para pruebas manuales
└── ARCHITECTURE.md
```

## Packages principales

- **`apps/viewer-oguc`** → la aplicación: visor 3D + flujo de revisión
  `/revision`. Ver [apps/viewer-oguc/README.md](apps/viewer-oguc/README.md).
- **`packages/oguc-core`** → el motor de reglas OGUC, sin dependencias de
  React ni del DOM. Ver
  [packages/oguc-core/README.md](packages/oguc-core/README.md).
- **`packages/report-core`** → generación de documentos de reporte
  (PDF/Excel) a partir de un modelo de datos genérico, reutilizado tanto
  para reportes BCF como para reportes de revisión OGUC.
- **`packages/ifc-headless`** → lector de archivos IFC puro (Node, sin
  `@thatopen/*`), la fuente de datos que consume `oguc-core`.

## Cómo contribuir

- Revisar [ARCHITECTURE.md](ARCHITECTURE.md) antes de tocar `oguc-core` o
  el flujo de `/revision` — documenta las decisiones de diseño vigentes y
  las limitaciones conocidas.
- `pnpm check:architecture` valida las reglas de dependencia entre
  `packages/*` y `apps/*` (por ejemplo, ningún package de dominio puede
  depender de React, Three.js o `@thatopen/*`) — correrlo antes de subir
  cambios que toquen imports entre packages.
- Cada package/app tiene su propio `test` (Vitest) — correrlos localmente
  antes de proponer cambios.

---

Last updated: 2026-08-06
