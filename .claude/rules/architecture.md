# Architecture Patterns

## Business Logic

- Business logic is implemented in the **Service layer**
- Controllers handle only HTTP requests and responses
- Services coordinate application logic and interact with the database layer
- Direct database access outside the database layer is forbidden

## Application Structure

- Modular architecture based on NestJS modules
- Each domain (Auth, Users, Orders, etc.) is a separate module
- Each module contains:
  - Controller
  - Service

- All database-related logic is centralized in the **`database/` directory**

## Database Layer (database/)

- All database logic is located in `src/database/`
- Includes:
  - Entities (`database/entities/`)
  - Migrations (`database/migrations/`)
  - Repositories (`database/repositories/`)

- Services MUST access the database only through this layer
- No database logic inside controllers or modules
- PostgreSQL is used as the primary database
- TypeORM is used as ORM

## API Layer

- REST API built with NestJS (Express)
- Controllers expose endpoints and delegate logic to services
- DTOs are used for request validation and data transfer

## Caching Layer

- Redis is used as a caching and temporary storage layer
- Used for caching, sessions, queue jobs and rate-limiting
- TTL-based strategy is applied to all cache entries
- Key naming is namespaced by domain

## Cross-Cutting Concerns

- Dependency Injection is used across all layers
- Configuration is managed via environment variables
- Error handling is centralized via NestJS exception filters

## Module Design

- Each module is domain-focused and self-contained
- Modules do not contain database logic
- All data access goes through the database layer
- Shared logic is extracted into common modules
- Avoid circular dependencies