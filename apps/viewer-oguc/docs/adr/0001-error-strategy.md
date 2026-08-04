# ADR 0001: Estrategia de errores del dominio

## Estado
Aceptado

## Contexto
El dominio de BWise Engine se declaró desde el inicio como Functional Core:
tipos inmutables, funciones puras, sin estado oculto. Sin embargo, no existía
una decisión formal sobre cómo representar fallos de reglas de negocio
(por ejemplo, intentar registrar un modelo que ya pertenece a una federación).

Existían dos caminos:
- Lanzar excepciones (`throw new ModelAlreadyRegisteredError(...)`)
- Representar el fallo en el tipo de retorno (`Result<T, E>`)

## Decisión
Se adopta `Result<T, DomainError>` para toda violación de una regla de
negocio esperable — es decir, cualquier fallo que un caso de uso puede
producir en el curso normal de su operación.

`throw` queda reservado exclusivamente para invariantes de programación
(bugs), nunca para reglas de negocio. Ejemplo: un valor `Brand` construido
donde el sistema de tipos ya garantizaba que no podía ser inválido.

## Justificación
Una función de dominio que se declara pura pero puede lanzar una excepción
tiene una firma que oculta su verdadero comportamiento: la excepción es un
canal de control que no aparece en el tipo de retorno. Esto contradice
directamente el principio de inmutabilidad y "sin estado oculto" que el
proyecto ya adoptó. Usar `Result<T,E>` hace el posible fallo explícito,
verificable por el compilador, y obliga al llamador a manejarlo.

## Consecuencias
- Se requiere un módulo compartido `domain/shared/result.ts` con
  `ok`, `err`, `map`, `andThen` para evitar reinventar el combinador
  en cada caso de uso.
- Los casos de uso de Application deben propagar el `Result` hacia
  arriba, no convertirlo en excepción.
- Riesgo aceptado: si se abusa del patrón en cadenas largas de
  `.andThen()`, la legibilidad puede degradarse. Se mitiga manteniendo
  el combinador mínimo y evitando dependencias como fp-ts mientras el
  dominio sea pequeño.