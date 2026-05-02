import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  CreateProductDto,
  PaginatedProductsQueryDto,
  ProductResponseDto,
  RemoveProductsDto,
  UpdateProductDto,
} from './dto';
import { ProductService } from './product.service';
import { Auth } from '../auth/decorators/auth.decorator';
import { PaginatedProductsResponse } from './interfaces';

@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Post()
  @Auth()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateProductDto): Promise<ProductResponseDto> {
    return this.productService.create(dto);
  }

  @Get()
  @Auth()
  async getAll(
    @Query() query: PaginatedProductsQueryDto,
  ): Promise<PaginatedProductsResponse> {
    return this.productService.findAll(query);
  }

  @Get(':id')
  @Auth()
  async getById(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<ProductResponseDto> {
    return this.productService.findOne(id);
  }

  @Patch(':id')
  @Auth()
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateProductDto,
  ): Promise<ProductResponseDto> {
    return this.productService.update(id, dto);
  }

  @Delete(':id')
  @Auth()
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', new ParseUUIDPipe()) id: string): Promise<void> {
    await this.productService.remove(id);
  }

  @Delete()
  @Auth()
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeMany(@Body() dto: RemoveProductsDto): Promise<void> {
    await this.productService.removeMany(dto.ids);
  }
}
