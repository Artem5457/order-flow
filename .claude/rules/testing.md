# Testing Rules

## Unit Testing Policy

- Unit tests must cover **business logic only**
- Do NOT test framework behavior (NestJS, TypeORM, Redis clients)
- Do NOT test simple getters/setters or DTO validation decorators
- Do NOT test database layer directly (repositories, ORM internals)

What NOT to test:
- Basic CRUD operations
- Framework decorators (@Controller, @Injectable, etc.)
- Simple data mapping
- External library behavior

What TO test:
- Service layer business logic
- Complex conditions and branching
- Edge cases and error handling
- Pure functions and utilities

## E2E Testing Policy

- E2E tests must cover **full request → response flow**
- Test real application behavior via HTTP endpoints
- Validate integration between layers (Controller → Service → Database)

What TO test:
- Authentication and authorization flows
- API endpoints (success + failure cases)
- Validation and error responses
- Database side effects
- Integration with Redis (if used)

What NOT to test:
- Internal implementation details
- Private methods
- Isolated units (covered by unit tests)

## Framework & Tools

- **Jest** — testing framework
- **Supertest** — HTTP assertions for E2E
- **ts-jest** — TypeScript support

## Test Structure

- **Unit tests MUST be colocated with the modules they test**
- **E2E tests MUST be located in the root `test/` directory**
- Do NOT mix unit and e2e tests in the same directory

## Unit Test Example

```ts
import { UserService } from './user.service';

describe('UserService', () => {
  it('should return user by id', async () => {
    const service = new UserService(/* mocked deps */);

    const result = await service.getUserById(1);

    expect(result).toEqual({ id: 1 });
  });
});
```

## E2E Test Example

```ts
import * as request from 'supertest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';

describe('Auth (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /auth/login returns token', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'test@test.com', password: 'password' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
  });
});
```
