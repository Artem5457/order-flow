import { Test, TestingModule } from '@nestjs/testing';
import { ProductController } from './product.controller';
import { ProductService } from './product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { RemoveProductsDto } from './dto/remove-products.dto';
import { DeleteResult } from 'typeorm';

type MockProductService = {
  create: jest.Mock;
  findOne: jest.Mock;
  findAll: jest.Mock;
  update: jest.Mock;
  remove: jest.Mock;
  removeMany: jest.Mock;
};

describe('ProductController', () => {
  let productController: ProductController;
  let productService: MockProductService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductController],
      providers: [
        {
          provide: ProductService,
          useValue: {
            create: jest.fn(),
            findOne: jest.fn(),
            findAll: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
            removeMany: jest.fn(),
          },
        },
      ],
    }).compile();

    productController = module.get<ProductController>(ProductController);
    productService = module.get(ProductService);
  });

  describe('create', () => {
    const createDto: CreateProductDto = {
      name: 'New Product',
      price: 199.99,
    };

    const mockProduct = {
      id: 'product-123',
      name: 'New Product',
      price: 199.99,
      createdAt: new Date(),
    };

    it('should call productService.create and return the product', async () => {
      productService.create.mockResolvedValue(mockProduct);

      const result = await productController.create(createDto);

      expect(productService.create).toHaveBeenCalledWith(createDto);
      expect(result).toEqual(mockProduct);
    });
  });

  describe('getById', () => {
    const mockProduct = {
      id: 'product-123',
      name: 'Product',
      price: 99.99,
      createdAt: new Date(),
    };

    it('should call productService.findOne and return the product', async () => {
      productService.findOne.mockResolvedValue(mockProduct);

      const result = await productController.getById('product-123');

      expect(productService.findOne).toHaveBeenCalledWith('product-123');
      expect(result).toEqual(mockProduct);
    });
  });

  describe('getAll', () => {
    const mockPaginated = {
      items: [
        {
          id: 'product-1',
          name: 'Product 1',
          price: 10.99,
          createdAt: new Date(),
        },
        {
          id: 'product-2',
          name: 'Product 2',
          price: 20.99,
          createdAt: new Date(),
        },
      ],
      total: 2,
      page: 1,
      limit: 10,
      totalPages: 1,
    };

    it('should forward query defaults and return paginated products', async () => {
      productService.findAll.mockResolvedValue(mockPaginated);

      const result = await productController.getAll({});

      expect(productService.findAll).toHaveBeenCalledWith({});
      expect(result).toEqual(mockPaginated);
    });

    it('should forward explicit page and limit', async () => {
      productService.findAll.mockResolvedValue({
        ...mockPaginated,
        page: 3,
        limit: 25,
        totalPages: 4,
      });

      await productController.getAll({ page: 3, limit: 25 });

      expect(productService.findAll).toHaveBeenCalledWith({
        page: 3,
        limit: 25,
      });
    });
  });

  describe('update', () => {
    const updateDto: UpdateProductDto = {
      name: 'Updated Product',
      price: 149.99,
    };

    const mockProduct = {
      id: 'product-123',
      name: 'Updated Product',
      price: 149.99,
      createdAt: new Date(),
    };

    it('should call productService.update and return the updated product', async () => {
      productService.update.mockResolvedValue(mockProduct);

      const result = await productController.update('product-123', updateDto);

      expect(productService.update).toHaveBeenCalledWith(
        'product-123',
        updateDto,
      );
      expect(result).toEqual(mockProduct);
    });
  });

  describe('remove', () => {
    it('should call productService.remove', async () => {
      productService.remove.mockResolvedValue(undefined);

      await productController.remove('product-123');

      expect(productService.remove).toHaveBeenCalledWith('product-123');
    });
  });

  describe('removeMany', () => {
    const removeDto: RemoveProductsDto = {
      ids: ['product-1', 'product-2'],
    };

    const mockDeleteResult: DeleteResult = {
      raw: [],
      affected: 2,
    };

    it('should call productService.removeMany', async () => {
      productService.removeMany.mockResolvedValue(mockDeleteResult);

      await productController.removeMany(removeDto);

      expect(productService.removeMany).toHaveBeenCalledWith([
        'product-1',
        'product-2',
      ]);
    });
  });
});
