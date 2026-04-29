# Migrations

## Migration Conventions (TypeORM)

- **Naming**: `create_posts_table`, `add_slug_to_posts_table`, `drop_legacy_field_from_users_table`
- Every migration must implement both `up()` and `down()` methods for full reversibility
- Never modify existing migrations — always create a new one for any change
- All schema changes must be implemented using **TypeORM Migration API (QueryRunner)**
- Entity files must NOT be used as a source of schema changes
- Migrations must be explicit, deterministic, and safe for production execution
- Prefer small, atomic migrations (one logical change per migration)
- Avoid mixing unrelated schema changes in a single migration

## TypeORM Migration Structure

- Use `MigrationInterface` and `QueryRunner`
- Use TypeORM schema methods (`addColumn`, `createTable`, `dropColumn`, `dropTable`, etc.)
- Prefer strongly typed schema objects (`Table`, `TableColumn`, `TableIndex`)
- Avoid raw SQL unless absolutely necessary
- Always ensure `up()` and `down()` are symmetrical

## Example

```ts
import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddSlugToPostsTable1700000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      "posts",
      new TableColumn({
        name: "slug",
        type: "varchar",
        isUnique: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn("posts", "slug");
  }
}