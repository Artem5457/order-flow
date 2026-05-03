import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableUnique,
} from 'typeorm';
import { OrderStatus } from '../enums';

export class CreateTables1777804815025 implements MigrationInterface {
  name = 'CreateTables1777804815025';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Use OrderStatus enum for status values
    await queryRunner.query(
      `CREATE TYPE "order_status_enum" AS ENUM('${OrderStatus.PENDING}', '${OrderStatus.PAID}', '${OrderStatus.CANCELLED}')`,
    );

    await queryRunner.createTable(
      new Table({
        name: 'user',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isNullable: false,
            default: 'uuid_generate_v4()',
          },
          { name: 'email', type: 'varchar', length: '255', isNullable: false },
          {
            name: 'password',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            isNullable: false,
            default: 'now()',
          },
          { name: 'updatedAt', type: 'timestamp', isNullable: true },
        ],
        uniques: [
          new TableUnique({ name: 'UQ_user_email', columnNames: ['email'] }),
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'product',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isNullable: false,
            default: 'uuid_generate_v4()',
          },
          { name: 'name', type: 'varchar', length: '255', isNullable: false },
          {
            name: 'price',
            type: 'numeric',
            precision: 10,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            isNullable: false,
            default: 'now()',
          },
          { name: 'updatedAt', type: 'timestamp', isNullable: true },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'order',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isNullable: false,
            default: 'uuid_generate_v4()',
          },
          { name: 'userId', type: 'uuid', isNullable: false },
          {
            name: 'status',
            type: 'order_status_enum',
            isNullable: false,
            default: `'${OrderStatus.PENDING}'`,
          },
          {
            name: 'total',
            type: 'numeric',
            precision: 10,
            scale: 2,
            isNullable: false,
          },
          { name: 'cancelledAt', type: 'timestamp', isNullable: true },
          {
            name: 'createdAt',
            type: 'timestamp',
            isNullable: false,
            default: 'now()',
          },
          { name: 'updatedAt', type: 'timestamp', isNullable: true },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'order_item',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isNullable: false,
            default: 'uuid_generate_v4()',
          },
          { name: 'orderId', type: 'uuid', isNullable: false },
          { name: 'productId', type: 'uuid', isNullable: false },
          { name: 'quantity', type: 'int', isNullable: false },
          {
            name: 'priceAtPurchase',
            type: 'numeric',
            precision: 10,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            isNullable: false,
            default: 'now()',
          },
          { name: 'updatedAt', type: 'timestamp', isNullable: true },
        ],
      }),
      true,
    );

    // Foreign keys
    await queryRunner.createForeignKey(
      'order',
      new TableForeignKey({
        columnNames: ['userId'],
        referencedTableName: 'user',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
        name: 'FK_order_userId',
      }),
    );
    await queryRunner.createForeignKey(
      'order_item',
      new TableForeignKey({
        columnNames: ['orderId'],
        referencedTableName: 'order',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
        name: 'FK_order_item_orderId',
      }),
    );
    await queryRunner.createForeignKey(
      'order_item',
      new TableForeignKey({
        columnNames: ['productId'],
        referencedTableName: 'product',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
        name: 'FK_order_item_productId',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign keys in correct order
    const orderItemTable = await queryRunner.getTable('order_item');
    if (orderItemTable) {
      for (const fk of orderItemTable.foreignKeys) {
        await queryRunner.dropForeignKey('order_item', fk);
      }
    }
    const orderTable = await queryRunner.getTable('order');
    if (orderTable) {
      for (const fk of orderTable.foreignKeys) {
        await queryRunner.dropForeignKey('order', fk);
      }
    }
    // Drop tables in reverse order
    await queryRunner.dropTable('order_item');
    await queryRunner.dropTable('order');
    await queryRunner.dropTable('product');
    await queryRunner.dropTable('user');
    await queryRunner.query('DROP TYPE "order_status_enum"');
  }
}
