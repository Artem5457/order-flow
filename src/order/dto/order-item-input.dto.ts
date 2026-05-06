import { Type } from 'class-transformer';
import { IsInt, IsUUID, Min } from 'class-validator';

export class OrderItemInputDto {
  @IsUUID()
  readonly productId: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  readonly quantity: number;
}
