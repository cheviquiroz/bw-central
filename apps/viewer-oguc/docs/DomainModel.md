# BWise Engine Domain Model

**Version:** 1.0 (Draft)

---

# Purpose

This document defines the business concepts that compose the BWise Engine domain.

It describes the language of the Engine independently of implementation details, programming languages, user interfaces or external libraries.

The domain model is the foundation upon which all Engine services are built.

---

# Design Principles

The domain model follows these principles:

- Business concepts before technical concepts.
- Stable identities.
- Explicit relationships.
- Persistence-independent.
- Serializable by design.
- Framework agnostic.

---

# Core Aggregates

The BWise Engine domain is organized around a small number of core aggregates.

## Project

Represents the complete BIM project managed by the Engine.

A Project is the root aggregate.

It owns the information required to describe a coordinated BIM project.

A Project may contain:

- Model Set
- Issues
- Saved Viewpoints
- Project Metadata

---

## Model Set

Represents a federated collection of BIM models.

A Model Set is responsible for managing one or more Models that together compose a coordinated project.

The Engine assumes federation as a first-class concept.

---

## Model

Represents a single BIM model.

A Model contains:

- Elements
- Spatial Structure
- Metadata
- Classifications

A Model is independent from visualization.

---

## Session

Represents a runtime interaction with a Project.

A Session is not persisted as part of the Project.

Each Session owns transient state such as:

- Current Selection
- Active Viewpoint
- Visibility State
- Measurements
- Temporary Filters

Multiple Sessions may exist simultaneously for the same Project.

---

# Aggregate Relationships

Project
├── Model Set
│       ├── Model
│       └── Model
│
├── Issues
│
├── Saved Viewpoints
│
└── Project Metadata

Session
├── Selection
├── Visibility
├── Active Viewpoint
└── Measurements

---

# Notes

This document intentionally defines aggregates before defining individual entities.

Entities, value objects and services will be specified in subsequent sections.