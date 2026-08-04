# BWise Engine Architecture

**Version:** 1.0 (Draft)

---

# 1. Vision

BWise Engine is the core technology behind BWise products.

Its purpose is to provide a reusable, framework-agnostic BIM engine for loading, querying, analyzing, navigating and managing Building Information Models (BIM).

The Engine is independent of any user interface technology, rendering library or BIM toolkit.

External technologies are integrations, not architectural building blocks.

The Engine must be capable of supporting multiple applications, including:

- Web Viewers
- Desktop Applications
- Mobile Applications
- BIM Automation Tools
- REST APIs
- Future Products

without requiring changes to its core architecture.

---

# 2. Mission

The mission of BWise Engine is to provide a modular, scalable and maintainable BIM platform capable of evolving for many years without architectural redesign.

Every architectural decision should prioritize:

- Maintainability
- Extensibility
- Simplicity
- Testability
- Clear Separation of Responsibilities
- Independence from External Technologies

over short-term implementation speed.

---

# 3. Core Principles

The architecture of BWise Engine follows these principles.

## 3.1 Domain First

Business concepts define the architecture.

Libraries never define the architecture.

Examples of domain concepts include:

- Project
- Model
- Element
- Selection
- View
- Issue
- Camera
- Classification
- Visibility

The architecture must never expose concepts that belong exclusively to rendering engines or third-party libraries.

---

## 3.2 Headless Engine

The Engine must work without any graphical interface.

Loading models, querying properties, filtering elements or exporting information must never require a visual environment.

The user interface is only one possible consumer of the Engine.

---

## 3.3 UI Agnostic

The Engine must not depend on any user interface framework.

Any frontend technology should be able to consume the same Engine without requiring architectural changes.

---

## 3.4 Framework Independence

External libraries are implementation details.

Rendering engines, BIM toolkits and infrastructure libraries must remain behind abstraction layers.

Replacing one technology should not require redesigning the business domain.

---

## 3.5 Single Source of Truth

Each Engine session has a single source of truth represented by one application state container.

Duplicated state is not allowed.

User interface components must never own business state.

---

## 3.6 Business Logic Separation

Business logic belongs to the Engine.

User interface components are responsible only for rendering information and forwarding user actions.

---

## 3.7 Adapters over Direct Dependencies

The Engine communicates with external technologies exclusively through adapters.

Adapters translate external APIs into BWise domain concepts.

Ports are defined by the Engine.

Integrations implement those ports.

The Engine never depends on contracts defined by external technologies.

External technologies may be replaced without affecting the Engine's public contracts.

---

## 3.8 Serializable Domain

The domain model must remain serializable.

Persistent state must never depend on runtime objects, rendering objects or framework instances.

---

## 3.9 Stable Identity

Persistent element identity is represented using IFC GlobalIds.

Temporary runtime identifiers may exist internally but must never become part of the persisted domain model.

---

## 3.10 Incremental Evolution

The architecture must allow new capabilities without modifying existing modules whenever possible.

New functionality should be added through composition rather than modification.

---

## 3.11 Explicit Contracts

Communication between modules must occur through well-defined contracts.

Modules should expose stable interfaces while hiding implementation details.

---

# 4. System Boundaries

BWise Engine is organized into four logical layers.

## Engine

The Engine contains the business logic.

It owns the domain model, application state and all BIM-related operations.

The Engine never depends on user interface technologies or external implementations.

Responsibilities:

- Domain Model
- Application State
- Services
- Event Bus
- Persistence Contracts
- Business Rules

---

## Integrations

Integrations connect the Engine with external technologies.

Examples include:

- BIM Toolkits
- Rendering Engines
- IFC Libraries
- BCF Libraries
- Cloud Services

Integrations are accessed exclusively through adapters.

The Engine implements no external APIs directly.

---

## Applications

Applications provide user experiences built on top of the Engine.

Examples include:

- Web Viewer
- Desktop Viewer
- Mobile Viewer
- Automation Tools

Applications orchestrate the Engine but never implement business logic.

---

## User Interface

The User Interface renders information and forwards user actions.

It may contain:

- Components
- Layouts
- Panels
- Toolbars
- Dialogs

The User Interface owns no business logic and no persistent application state.

---

# Dependency Rule

Dependencies always flow inward.

Outer layers may depend on inner layers.

Inner layers must never depend on outer layers.

---

# Responsibility Rule

Every class, service or component must belong to exactly one architectural layer.

If a module appears to belong to multiple layers, its responsibilities should be reconsidered.