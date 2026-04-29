import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class ProductResponseDto {
  @Expose()
  readonly id: string;

  @Expose()
  readonly name: string;

  @Expose()
  readonly price: number;

  @Expose()
  readonly createdAt: Date;

  @Expose()
  readonly updatedAt?: Date;
}
