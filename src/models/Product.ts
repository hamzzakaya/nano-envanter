import { ObjectId } from 'mongodb';

export interface ProductDocument {
  _id?: ObjectId;
  name: string;
  code: string;
  count: number;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Product {
  id: string;
  name: string;
  code: string;
  count: number;
  description?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// Helper functions to convert between MongoDB document and frontend Product
export function documentToProduct(doc: ProductDocument): Product {
  return {
    id: doc._id!.toString(),
    name: doc.name,
    code: doc.code,
    count: doc.count,
    description: doc.description,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export function productToDocument(product: Omit<Product, 'id'>): Omit<ProductDocument, '_id'> {
  return {
    name: product.name,
    code: product.code,
    count: product.count,
    description: product.description,
    createdAt: product.createdAt || new Date(),
    updatedAt: new Date(),
  };
}
