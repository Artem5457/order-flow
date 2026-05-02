import { ProductResponseDto } from '../dto';

export interface PaginatedProductsResponse {
  items: ProductResponseDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
