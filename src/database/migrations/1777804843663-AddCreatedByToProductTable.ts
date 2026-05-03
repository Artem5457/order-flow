import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableForeignKey,
} from 'typeorm';

export class AddCreatedByToProduct1777804843663 implements MigrationInterface {
  name = 'AddCreatedByToProduct1777804843663';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add createdBy column
    await queryRunner.addColumn(
      'product',
      new TableColumn({
        name: 'createdBy',
        type: 'uuid',
        isNullable: false,
      }),
    );

    // Add foreign key constraint
    await queryRunner.createForeignKey(
      'product',
      new TableForeignKey({
        columnNames: ['createdBy'],
        referencedTableName: 'user',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
        name: 'FK_product_createdBy',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key constraint
    const productTable = await queryRunner.getTable('product');
    if (productTable) {
      const foreignKey = productTable.foreignKeys.find(
        (fk) => fk.name === 'FK_product_createdBy',
      );
      if (foreignKey) {
        await queryRunner.dropForeignKey('product', foreignKey);
      }
    }

    // Drop createdBy column
    await queryRunner.dropColumn('product', 'createdBy');
  }
}
