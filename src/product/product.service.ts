import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Product } from '../database/entities/product.entity';
import { Repository, In } from 'typeorm';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductResponseDto } from './dto/product-response.dto';
import { PaginatedProductsQueryDto } from './dto/paginated-products-query.dto';
import { PaginatedProductsResponse } from './interfaces';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

@Injectable()
export class ProductService {
  private readonly logger = new Logger(ProductService.name);

  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  async create(
    dto: CreateProductDto,
    user: AuthenticatedUser,
  ): Promise<ProductResponseDto> {
    const product = this.productRepository.create({
      name: dto.name,
      price: dto.price.toString(),
      createdBy: user.id,
    });

    const savedProduct = await this.productRepository.save(product);

    return this.toDto(savedProduct);
  }

  async findOne(id: string): Promise<ProductResponseDto> {
    const product = await this.productRepository.findOne({ where: { id } });

    if (!product) {
      this.logger.error(`Product with id "${id}" not found`);
      throw new NotFoundException(`Product with id "${id}" not found`);
    }

    return this.toDto(product);
  }

  async findAll(
    query: PaginatedProductsQueryDto,
  ): Promise<PaginatedProductsResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const [products, total] = await this.productRepository.findAndCount({
      skip,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return {
      items: products.map((product) => this.toDto(product)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 0,
    };
  }

  async update(
    id: string,
    dto: UpdateProductDto,
    user: AuthenticatedUser,
  ): Promise<ProductResponseDto> {
    const product = await this.productRepository.findOne({ where: { id } });

    if (!product) {
      this.logger.error(`Product with id "${id}" not found`);
      throw new NotFoundException(`Product with id "${id}" not found`);
    }

    // Check if user is the owner
    if (product.createdBy !== user.id) {
      this.logger.error('You are not allowed to modify this product');
      throw new ForbiddenException(
        'You are not allowed to modify this product',
      );
    }

    if (dto.name) {
      product.name = dto.name;
    }

    if (dto.price !== undefined) {
      product.price = dto.price.toString();
    }

    const updatedProduct = await this.productRepository.save(product);

    return this.toDto(updatedProduct);
  }

  async remove(id: string, user: AuthenticatedUser): Promise<void> {
    const product = await this.productRepository.findOne({ where: { id } });

    if (!product) {
      this.logger.error(`Product with id "${id}" not found`);
      throw new NotFoundException(`Product with id "${id}" not found`);
    }

    // Check if user is the owner
    if (product.createdBy !== user.id) {
      this.logger.error('You are not allowed to delete this product');
      throw new ForbiddenException(
        'You are not allowed to delete this product',
      );
    }

    await this.productRepository.remove(product);
  }

  async removeMany(ids: string[], user: AuthenticatedUser): Promise<void> {
    // First check which products belong to the current user
    const products = await this.productRepository.find({
      where: {
        createdBy: user.id,
        id: In(ids),
      },
    });

    const userProductIds = products.map((product) => product.id);

    if (userProductIds.length === 0) {
      this.logger.error('No products found that belong to you');
      throw new NotFoundException('No products found that belong to you');
    }

    const result = await this.productRepository.delete(userProductIds);

    if (result.affected === 0) {
      this.logger.error('No products were deleted');
      throw new NotFoundException('No products were deleted');
    }
  }

  private toDto(product: Product): ProductResponseDto {
    return Object.assign(new ProductResponseDto(), {
      id: product.id,
      name: product.name,
      price: parseFloat(product.price),
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    });
  }
}
