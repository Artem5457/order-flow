# Code Style Rules

## TypeScript

- Use strict TypeScript mode
- Do not use `any` unless explicitly justified
- Always define explicit types for:
  - function parameters
  - return values
  - variables where type is not obvious
- Prefer `interface` or `type` over implicit structures
- Use `readonly` for immutable data
- Use enums for fixed value sets

## Naming Conventions

- Files and directories: kebab-case (`user-order.service.ts`)
- Classes and types: PascalCase (`UserService`, `CreateUserDto`)
- Functions and variables: camelCase (`getUserById`, `userId`)
- Constants: UPPER_SNAKE_CASE (`DEFAULT_TIMEOUT_MS`)

- Use consistent suffixes:
  - `Service`
  - `Controller`
  - `Dto`
  - `Entity`
  - `Repository`
  - `Guard`
  - `Exception`

## Code Structure

- Keep functions small and focused
- Avoid deeply nested logic
- Prefer early returns over nested conditions
- Use descriptive variable and function names
- Avoid magic strings — extract constants

## NestJS Style

- Use decorators consistently:
  - `@Controller`
  - `@Injectable`
  - `@Module`
  - `@Guard`
- Use DTOs for all external input/output
- Use dependency injection for all services

## TypeORM Style

- Use decorators for entities (`@Entity`, `@Column`, relations)
- Prefer query builder over raw SQL
- Avoid inline database logic outside repository/database layer

## Redis Style

- Use consistent key naming (`entity:{id}:type`)
- Do not hardcode keys inline — use helpers/constants

## Logging Style

- Use structured logging
- Use correct log levels:
  - info
  - warn
  - error
- Do not log sensitive data

## General Rules

- No commented-out code
- No hardcoded configuration values
- No global variables
- Always use async/await for async operations
- Keep code readable and consistent across modules
