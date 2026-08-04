# ADR 0003: Lenguaje ubicuo — ModelSet renombrado a Federation

## Estado
Aceptado

## Contexto
El aggregate `ModelSet` administra el conjunto de modelos IFC que operan
juntos dentro de un proyecto. Sin embargo, en toda conversación de diseño
y en la documentación de producto (Vision.md, Roadmap.md), el equipo se
refiere a este concepto de forma natural y consistente como "federación",
nunca como "conjunto de modelos". `ModelSet` es un nombre que describe
una estructura de datos, no un concepto de negocio.

## Decisión
Se renombra `ModelSet` a `Federation` en todo el dominio:

- `ModelSet.ts` → `Federation.ts`
- `ModelSetId.ts` → `FederationId.ts`
- `ModelSetRepository.ts` → `FederationRepository.ts`
- Carpeta `domain/modelset/` → `domain/federation/`

El campo interno `modelIds: readonly ModelId[]` no cambia de nombre —
sigue describiendo correctamente su contenido.

## Justificación
El lenguaje ubicuo de DDD exige que el código use el mismo término que
el equipo ya usa al hablar del negocio. Mantener `ModelSet` en el código
mientras se dice "federación" en cada conversación crea una traducción
mental constante y es la forma más común en que el lenguaje ubicuo se
degrada silenciosamente. El costo de renombrar ahora (un aggregate con
una sola propiedad, un solo caso de uso) es mínimo. Postergarlo hasta
que existan reglas de coordinación espacial, unidades o comportamiento
de federación más complejo encarecería significativamente el rename.

## Consecuencias
- Actualizar los tres commits/archivos afectados y sus imports.
- Actualizar el ADR 0002 y el gate de `dependency-cruiser` si referencian
  la ruta `domain/modelset` explícitamente.
- Ningún cambio de comportamiento; es un rename puro.