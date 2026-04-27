import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Product } from '../database/entities/product.entity';
import { Repository } from 'typeorm';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductResponseDto } from './dto/product-response.dto';

@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  async create(dto: CreateProductDto): Promise<ProductResponseDto> {
    const product = this.productRepository.create({
      name: dto.name,
      price: dto.price.toString(),
    });

    const savedProduct = await this.productRepository.save(product);

    return this.toDto(savedProduct);
  }

  async findOne(id: string): Promise<ProductResponseDto> {
    const product = await this.productRepository.findOne({ where: { id } });

    if (!product) {
      throw new NotFoundException(`Product with id "${id}" not found`);
    }

    return this.toDto(product);
  }

  async findAll(): Promise<ProductResponseDto[]> {
    const products = await this.productRepository.find();

    return products.map((product) => this.toDto(product));
  }

  async update(id: string, dto: UpdateProductDto): Promise<ProductResponseDto> {
    const product = await this.productRepository.findOne({ where: { id } });

    if (!product) {
      throw new NotFoundException(`Product with id "${id}" not found`);
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

  async remove(id: string): Promise<void> {
    const product = await this.productRepository.findOne({ where: { id } });

    if (!product) {
      throw new NotFoundException(`Product with id "${id}" not found`);
    }

    await this.productRepository.remove(product);
  }

  async removeMany(ids: string[]): Promise<void> {
    if (!ids || ids.length === 0) {
      throw new BadRequestException('Product IDs array cannot be empty');
    }

    const result = await this.productRepository.delete(ids);

    if (result.affected === 0) {
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
