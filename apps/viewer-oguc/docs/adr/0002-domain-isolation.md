# ADR 0002: Aislamiento verificable del dominio

## Estado
Superseded — el dominio (`Model`, `ModelId`, `Federation`, `Project`,
`registerModelInFederation`, `removeModelFromFederation`,
`detectDistantModels`) se separó como paquete npm independiente
(`packages/ifc-core` en el monorepo `bw-central`), el escenario que esta
misma ADR ya preveía en "Consecuencias". El aislamiento ahora lo garantiza
el propio límite de paquete (ifc-core no tiene ninguna dependencia de
runtime) en vez del gate de `tsconfig.domain.json` + `dependency-cruiser`
descrito abajo, que fue removido de este proyecto. El resto de esta ADR
queda como registro histórico de la decisión original.

## Contexto
El proyecto afirma desde su origen que "el dominio no depende de
infraestructura" (Three.js, React, That Open Components, persistencia).
Esta afirmación se sostuvo únicamente como intención documentada, sin
ningún mecanismo automático que la verificara. Se detectó evidencia de
que esta propiedad puede violarse sin darse cuenta: el build del Engine
llegó a depender de tipos heredados de `OBC.World`, señal de que la
frontera Engine/Viewer no estaba realmente cerrada.

## Decisión
El aislamiento del dominio se garantiza mediante verificación automática
en dos capas, no mediante convención:

1. Un `tsconfig.domain.json` que compila exclusivamente `src/engine/domain/**`
   sin tipos de DOM, Three.js, React ni ningún framework.
2. Una regla de `dependency-cruiser` que prohíbe explícitamente que
   `domain/` importe `three`, `@thatopen/*`, `react`, `adapters/` o
   `application/`.

Ambas corren mediante un único script:

```bash
npm run check:domain-isolation
```

Este script debe ejecutarse en CI en cada PR y en local antes de cada
commit que toque `domain/`.

## Justificación
No basta con declarar un principio arquitectónico si no existe una
comprobación que falle cuando se viola. La separación física en un
paquete npm independiente se consideró prematura para el tamaño actual
del proyecto (un aggregate con una propiedad, un caso de uso). El gate
automatizado da la misma garantía de aislamiento a una fracción del
costo, y puede evolucionar hacia un paquete separado más adelante sin
perder valor de lo ya invertido.

## Consecuencias
- Cualquier import indebido dentro de `domain/` rompe el build en CI,
  no solo en revisión manual de código.
- No se separa `domain/` como paquete npm independiente por ahora;
  se reevalúa cuando existan varios casos de uso estables en Application.