# ADR 0004: Ubicación de Session

## Estado
Aceptado

## Contexto
Existía la hipótesis de que `Session` sería un futuro Aggregate Root de
Domain, al mismo nivel que `Project` y `Federation`. Al analizar su
naturaleza, se concluyó que representa estado de interacción del usuario
(selección activa, visibilidad, cámara) — mayormente efímero — mientras
que `Project` y `Federation` representan estado persistente con su
propio repositorio.

## Decisión
`Session` no es un Aggregate Root de Domain. Vive en la capa Application
como un concepto que compone:

- Referencias por ID a aggregates de dominio (`ProjectId`, `FederationId`)
- Selección activa, representada como `Record<ModelId, GUID[]>`
  (GUIDs de IFC, no localIds internos del motor de renderizado)
- Historial de comandos para undo/redo, específico de la interacción

Solo lo que el usuario nombra explícitamente como "vista guardada" se
persiste como parte del Domain, con su propio esquema serializable
versionado.

## Justificación
Forzar `Session` al mismo patrón que `Project`/`Federation` (Aggregate
Root con Repository) trataría como persistente algo que en su mayoría
es efímero, y mezclaría dos naturalezas de estado distintas bajo el
mismo mecanismo. Modelar la selección en GUIDs desde el inicio (en vez
de identificadores internos del motor) es lo que permite que Selección,
Visibilidad, Clasificación y una futura integración BCF compartan el
mismo tipo sin conversiones ad-hoc, y que el historial de undo/redo se
construya sobre comandos serializables en vez de snapshots de objetos
del motor de renderizado.

## Consecuencias
- `Session` se implementa en `application/session/`, no en `domain/`.
- El gate de aislamiento del ADR 0002 no necesita reglas adicionales
  para `Session`, ya que vive fuera de `domain/` por diseño.
- Cuando se implemente "vistas guardadas", su esquema de persistencia
  debe expresarse en GUIDs planos y serializables, nunca en tipos del
  motor de renderizado.