import { Product } from '@/models/Product';

const API_BASE = '/api/products';

export async function fetchProducts(): Promise<Product[]> {
  const response = await fetch(API_BASE);
  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.error || 'Failed to fetch products');
  }
  
  return data.data;
}

export async function createProduct(product: Omit<Product, 'id'>): Promise<Product> {
  const response = await fetch(API_BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(product),
  });
  
  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.error || 'Failed to create product');
  }
  
  return data.data;
}

export async function updateProduct(id: string, product: Omit<Product, 'id'>): Promise<Product> {
  const response = await fetch(`${API_BASE}/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(product),
  });
  
  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.error || 'Failed to update product');
  }
  
  return data.data;
}

export async function deleteProduct(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/${id}`, {
    method: 'DELETE',
  });
  
  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.error || 'Failed to delete product');
  }
}
