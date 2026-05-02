import { Test, TestingModule } from '@nestjs/testing';
import { ProductService } from './product.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DeleteResult } from 'typeorm';
import { Product } from '../database/entities/product.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { NotFoundException } from '@nestjs/common';

type MockProductRepository = {
  find: jest.Mock;
  findAndCount: jest.Mock;
  findOne: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
  delete: jest.Mock;
  remove: jest.Mock;
};

describe('ProductService', () => {
  let productService: ProductService;
  let productRepository: MockProductRepository;

  const mockProduct: Product = {
    id: 'product-123',
    name: 'Test Product',
    price: '99.99',
    createdAt: new Date(),
  };

  beforeEach(async () => {
    const mockProductRepository = {
      find: jest.fn(),
      findAndCount: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductService,
        {
          provide: getRepositoryToken(Product),
          useValue: mockProductRepository,
        },
      ],
    }).compile();

    productService = module.get<ProductService>(ProductService);
    productRepository = module.get(getRepositoryToken(Product));
  });

  describe('create', () => {
    const createDto: CreateProductDto = {
      name: 'New Product',
      price: 199.99,
    };

    const createdProduct: Product = {
      id: 'product-123',
      name: 'New Product',
      price: '199.99',
      createdAt: new Date(),
    };

    it('should create a new product', async () => {
      productRepository.create.mockReturnValue(createdProduct);
      productRepository.save.mockResolvedValue(createdProduct);

      const result = await productService.create(createDto);

      expect(productRepository.create).toHaveBeenCalledWith({
        name: createDto.name,
        price: '199.99',
      });
      expect(productRepository.save).toHaveBeenCalledWith(createdProduct);

      expect(result).toEqual({
        id: createdProduct.id,
        name: createdProduct.name,
        price: 199.99,
        createdAt: createdProduct.createdAt,
        updatedAt: undefined,
      });
    });
  });

  describe('findOne', () => {
    it('should return a product by id', async () => {
      productRepository.findOne.mockResolvedValue(mockProduct);

      const result = await productService.findOne('product-123');

      expect(productRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'product-123' },
      });
      expect(result).toEqual({
        id: mockProduct.id,
        name: mockProduct.name,
        price: 99.99,
        createdAt: mockProduct.createdAt,
        updatedAt: undefined,
      });
    });

    it('should throw NotFoundException if product not found', async () => {
      productRepository.findOne.mockResolvedValue(null);

      await expect(productService.findOne('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
      await expect(productService.findOne('non-existent-id')).rejects.toThrow(
        'Product with id "non-existent-id" not found',
      );
    });
  });

  describe('findAll', () => {
    it('should use default page 1 and limit 10', async () => {
      productRepository.findAndCount.mockResolvedValue([[mockProduct], 25]);

      const result = await productService.findAll({});

      expect(productRepository.findAndCount).toHaveBeenCalledWith({
        skip: 0,
        take: 10,
        order: { createdAt: 'DESC' },
      });
      expect(result).toMatchObject({
        total: 25,
        page: 1,
        limit: 10,
        totalPages: 3,
      });
      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toEqual({
        id: mockProduct.id,
        name: mockProduct.name,
        price: 99.99,
        createdAt: mockProduct.createdAt,
        updatedAt: undefined,
      });
    });

    it('should apply skip/take for page 2', async () => {
      productRepository.findAndCount.mockResolvedValue([[mockProduct], 15]);

      const result = await productService.findAll({ page: 2, limit: 5 });

      expect(productRepository.findAndCount).toHaveBeenCalledWith({
        skip: 5,
        take: 5,
        order: { createdAt: 'DESC' },
      });
      expect(result.page).toBe(2);
      expect(result.limit).toBe(5);
      expect(result.totalPages).toBe(3);
    });

    it('should return zero totalPages when empty', async () => {
      productRepository.findAndCount.mockResolvedValue([[], 0]);

      const result = await productService.findAll({});

      expect(result.totalPages).toBe(0);
      expect(result.items).toEqual([]);
    });
  });

  describe('update', () => {
    it('should update a product', async () => {
      const updatedProduct: Product = {
        ...mockProduct,
        name: 'Updated Product',
        price: '149.99',
        createdAt: new Date(),
      };
      productRepository.findOne.mockResolvedValue(mockProduct);
      productRepository.save.mockResolvedValue(updatedProduct);

      const updateDto: UpdateProductDto = {
        name: 'Updated Product',
        price: 149.99,
      };

      const result = await productService.update('product-123', updateDto);

      expect(productRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'product-123' },
      });
      expect(productRepository.save).toHaveBeenCalledWith({
        ...mockProduct,
        name: 'Updated Product',
        price: '149.99',
      });

      expect(result).toEqual({
        id: updatedProduct.id,
        name: 'Updated Product',
        price: 149.99,
        createdAt: updatedProduct.createdAt,
        updatedAt: undefined,
      });
    });

    it('should throw NotFoundException if product not found', async () => {
      productRepository.findOne.mockResolvedValue(null);

      await expect(
        productService.update('non-existent-id', {}),
      ).rejects.toThrow(NotFoundException);
      await expect(
        productService.update('non-existent-id', {}),
      ).rejects.toThrow('Product with id "non-existent-id" not found');
    });
  });

  describe('remove', () => {
    it('should remove a product', async () => {
      productRepository.findOne.mockResolvedValue(mockProduct);
      productRepository.remove.mockResolvedValue(mockProduct);

      await productService.remove('product-123');

      expect(productRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'product-123' },
      });
      expect(productRepository.remove).toHaveBeenCalledWith(mockProduct);
    });

    it('should throw NotFoundException if product not found', async () => {
      productRepository.findOne.mockResolvedValue(null);

      await expect(productService.remove('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
      await expect(productService.remove('non-existent-id')).rejects.toThrow(
        'Product with id "non-existent-id" not found',
      );
    });
  });

  describe('removeMany', () => {
    it('should remove multiple products', async () => {
      const mockDeleteResult: DeleteResult = {
        raw: [],
        affected: 2,
      };
      productRepository.delete.mockResolvedValue(mockDeleteResult);

      await productService.removeMany(['product-1', 'product-2']);

      expect(productRepository.delete).toHaveBeenCalledWith([
        'product-1',
        'product-2',
      ]);
    });

    it('should throw NotFoundException if no products were deleted', async () => {
      const mockDeleteResult: DeleteResult = {
        raw: [],
        affected: 0,
      };
      productRepository.delete.mockResolvedValue(mockDeleteResult);

      await expect(productService.removeMany(['product-1'])).rejects.toThrow(
        NotFoundException,
      );
      await expect(productService.removeMany(['product-1'])).rejects.toThrow(
        'No products were deleted',
      );
    });
  });
});
