## Project Context
- **Architecture**: Node.js REST API
- **Languages**: TypeScript (strict mode)
- **Framework**: Nest.js with Express.js
- **Database**: PostgreSQL with TypeORM
- **Caching**: Redis
- **Testing**: Jest
- **Package Manager**: npm

### Always Include
- Strict TypeScript types and interfaces
- JSDoc comments for public APIs and complex logic
- Logging with proper log levels (debug, info, warn, error)
- Proper Redis key naming conventions and TTL management
- TypeORM relation handling and query optimization
- Database migrations for schema changes

### Never Include
- `any` types without explicit justification
- Hardcoded configuration values or magic strings
- Synchronous blocking operations (use async/await)
- Commented-out code blocks
- Global variables or singletons without proper dependency injection
- Direct database queries without ORM abstraction
- Unvalidated user input
- Exposed error stack traces in API responses
- Redis operations without proper error handling
- N+1 query problems in TypeORM

### TypeScript Standards
- Use strict TypeScript configuration
- Prefer explicit types over implicit inference
- Avoid `any` types without explicit justification
- Always define return types for functions
- Use `readonly` for immutable data structures
- Use enums for status values

### Nest.js Backend Rules
- Use decorators appropriately (@Injectable, @Controller, @Module, @Guard)
- Implement DTO validation with class-validator decorators
- Use exception filters for consistent error handling
- Implement guards for authentication and authorization
- Use dependency injection for all services and providers
- Document endpoints with Swagger/OpenAPI

### TypeORM & PostgreSQL Guidelines
- Define entities with proper decorators (@Entity, @Column, @OneToMany, @ManyToOne)
- Use migrations for all schema changes
- Implement proper relationships with cascading rules
- Use query builders instead of raw SQL
- Avoid N+1 queries using eager loading and proper joins
- Use repositories pattern for data access
- Implement proper transaction handling

### Redis Guidelines
- Use descriptive and namespaced key names (e.g., `user:{userId}:cache`)
- Always set TTL on keys to prevent memory bloat
- Handle Redis connection errors gracefully with fallback logic
- Use Redis transactions for atomic operations
- Implement proper key invalidation strategies
- Never store sensitive data in plaintext
- Implement type safety for cache operations

### API Design Standards
- Use RESTful conventions (GET, POST, PUT, DELETE, PATCH)
- Implement API versioning (e.g., `/api/v1/...`)
- Use proper HTTP status codes
- Implement pagination for list endpoints
- Document all endpoints with Swagger/OpenAPI
- Use DTOs for request and response validation
- Implement proper error responses

### Testing Standards
- Maintain minimum 80% code coverage
- Use Arrange-Act-Assert pattern
- Implement unit and integration tests
- Mock external dependencies (Redis, database, third-party APIs)
- Test both success and failure scenarios
- Use proper test naming (`should...when...`)

### Code Structure & Architecture
- Follow SOLID principles
- Use dependency injection patterns
- Implement proper separation of concerns (controllers, services, repositories)
- Use composition over inheritance
- Implement layered architecture: Controllers → Services → Repositories → Entities
- Keep controllers thin and services focused on business logic

### Security Guidelines
- Never hardcode sensitive information
- Use environment variables for configuration
- Implement proper input validation and sanitization
- Use HTTPS and secure headers
- Implement proper authentication and authorization
- Follow OWASP security guidelines
- Use proper CORS configuration
- Implement rate limiting and request validation
- XSS protection (e.g., sanitize user input, use CSP)
- CSRF protection (e.g., use anti-CSRF tokens)
- SQL injection protection (e.g., use parameterized queries)
- Use Rate Limiting for API requests

### Naming Conventions
- kebab-case for files and directories (`user-service.ts`, `auth-controller.ts`)
- PascalCase for classes and types (`UserService`, `CreateUserDto`)
- camelCase for functions and variables (`getUserById()`, `userId`)
- UPPER_SNAKE_CASE for constants (`DEFAULT_TIMEOUT_MS`)
- Use Entity, Dto, Service, Repository, Guard, Exception suffixes appropriately

### Logging Standards
- Use proper log levels: DEBUG, INFO, WARN, ERROR
- Log request/response metadata (timestamp, request ID, user ID)
- Log errors with stack traces and context
- Avoid logging sensitive information
- Use structured logging when possible

### Manual Review Focus Areas (Required, high attention Copilot)
- Code readability and maintainability
- Performance optimization opportunities (database queries, Redis caching strategy)
- API design consistency and documentation
- TypeORM relationship configuration correctness
- Redis key management and TTL strategies
- Security implications and OWASP compliance

### README Requirements
- Clear project description and purpose
- Setup and installation instructions
- Environment variable documentation (.env.example)
- Database and Redis setup instructions
- API endpoint documentation with Swagger link
- Testing and deployment instructions