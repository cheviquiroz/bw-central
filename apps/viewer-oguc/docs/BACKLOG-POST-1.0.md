# Backlog Post-1.0

Este documento contiene funcionalidades e iniciativas que se consideran
valiosas, pero que quedan **explícitamente fuera del alcance de la versión
1.0** según la visión definida en `docs/Vision.md`.

No representan trabajo pendiente de la V1.

No se descartan: simplemente se posponen hasta que exista una necesidad
real de negocio o una evolución explícita del producto.

---

# Evolución natural del visor

Estas funcionalidades siguen siendo coherentes con la visión de BWise Viewer
como visor IFC profesional. Se reconsiderarán cuando la V1 esté consolidada.

| Feature | Valor para el usuario | Por qué queda fuera de V1 | Depende de | Señal para reconsiderar |
|----------|-----------------------|---------------------------|------------|-------------------------|
| **BCF** | Compartir y dar seguimiento a incidencias entre distintos softwares BIM | La V1 está enfocada en revisión individual, no colaboración | Selection (GUID), Federación | Clientes solicitan intercambio de incidencias con otros softwares BIM |
| **Versionado de modelos** | Comparar revisiones de un mismo modelo IFC | Aún no existe una estrategia definida para la identidad entre versiones | Model Aggregate | Necesidad real de comparar revisiones de un modelo |
| **API pública** | Permitir integraciones con otras aplicaciones | El Engine aún no posee suficientes casos de uso estables | Engine estabilizado | El Engine tenga una API interna madura y consistente |
| **Plugins** | Extender el visor mediante módulos externos | Depende completamente de una API pública estable | API pública | La API pública se considere estable |
| **Reglas BIM / IDS** | Validar cumplimiento de requisitos BIM | El objetivo actual es revisar modelos, no verificar cumplimiento normativo | — | Se valide una demanda clara por funcionalidades de compliance checking |

---

# Cambio de estrategia de producto

Estas funcionalidades cambian la naturaleza del producto y solo se
considerarán si la visión de BWise Viewer cambia explícitamente.

| Feature | Valor para el usuario | Por qué queda fuera de V1 | Depende de | Señal para reconsiderar |
|----------|-----------------------|---------------------------|------------|-------------------------|
| **Cloud** | Acceso remoto y sincronización de proyectos | La V1 es una aplicación de escritorio | — | Decisión estratégica de evolucionar hacia SaaS |
| **Usuarios / Permisos** | Gestión de acceso y responsabilidades | No existe colaboración en tiempo real en la V1 | Session / Cloud | Se incorpora colaboración multiusuario |
| **Colaboración en tiempo real** | Trabajo simultáneo sobre un mismo proyecto | Cambia completamente la arquitectura del producto | Usuarios + Cloud | Cambio explícito de visión del producto |
| **RFI** | Gestión de consultas y documentación | Corresponde a gestión documental, no a revisión técnica | — | Solo si la visión del producto cambia explícitamente |
| **Automatización** | Ejecución automática de procesos o revisiones | Está fuera del alcance de un visor IFC profesional | — | Solo si la visión del producto cambia explícitamente |

---

# Regla de incorporación

Una funcionalidad de este documento solo podrá ingresar al roadmap oficial
cuando se cumplan ambas condiciones:

1. Exista una necesidad real de usuarios o de negocio.
2. Sea coherente con la visión vigente de BWise Viewer.

Mientras alguna de esas condiciones no se cumpla, la funcionalidad
permanecerá en este backlog.

---

# Filosofía

El objetivo de este documento no es limitar la evolución del producto,
sino proteger el foco de la versión 1.0.

Agregar funcionalidades siempre es más fácil que eliminarlas.

Por ello, BWise Viewer crecerá incorporando únicamente aquellas capacidades
que reduzcan la fricción del trabajo diario de los profesionales AEC al
revisar modelos IFC.