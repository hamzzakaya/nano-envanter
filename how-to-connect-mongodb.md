# How to Connect MongoDB to Your Inventory Management System

This guide will help you migrate from localStorage to MongoDB for your inventory management system.

## Prerequisites

- Node.js and npm installed
- MongoDB Atlas account (recommended) or local MongoDB installation
- Basic understanding of environment variables

## Step 1: Set Up MongoDB Database

### Option A: MongoDB Atlas (Cloud - Recommended)

1. **Create MongoDB Atlas Account**
   - Go to [MongoDB Atlas](https://www.mongodb.com/atlas)
   - Sign up for a free account
   - Create a new project

2. **Create a Cluster**
   - Click "Build a Database"
   - Choose "M0 Sandbox" (Free tier)
   - Select your preferred cloud provider and region
   - Name your cluster (e.g., "inventory-cluster")

3. **Configure Database Access**
   - Go to "Database Access" in the left sidebar
   - Click "Add New Database User"
   - Create a username and password (save these!)
   - Set privileges to "Read and write to any database"

4. **Configure Network Access**
   - Go to "Network Access" in the left sidebar
   - Click "Add IP Address"
   - For development, you can use "0.0.0.0/0" (allows access from anywhere)
   - For production, use your specific IP addresses

5. **Get Connection String**
   - Go to "Database" and click "Connect" on your cluster
   - Choose "Connect your application"
   - Copy the connection string (it looks like: `mongodb+srv://username:password@cluster.mongodb.net/`)

### Option B: Local MongoDB Installation

1. **Install MongoDB Community Edition**
   - Follow instructions at [MongoDB Installation Guide](https://docs.mongodb.com/manual/installation/)
   - Start MongoDB service
   - Default connection string: `mongodb://localhost:27017/inventory`

## Step 2: Install Required Dependencies

```bash
npm install mongodb mongoose
npm install --save-dev @types/mongodb
```

## Step 3: Set Up Environment Variables

1. **Create `.env.local` file** in your project root:

```env
MONGODB_URI=mongodb+srv://your-username:your-password@your-cluster.mongodb.net/inventory?retryWrites=true&w=majority
MONGODB_DB=inventory
```

2. **Update `.gitignore`** to include environment files:

```gitignore
# Environment variables
.env
.env.local
.env.production
.env.staging
```

## Step 4: Create Database Connection

Create `src/lib/mongodb.ts`:

```typescript
import { MongoClient, Db } from 'mongodb';

if (!process.env.MONGODB_URI) {
  throw new Error('Please add your MongoDB URI to .env.local');
}

const uri = process.env.MONGODB_URI;
const options = {};

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

if (process.env.NODE_ENV === 'development') {
  // In development mode, use a global variable to preserve the connection
  let globalWithMongo = global as typeof globalThis & {
    _mongoClientPromise?: Promise<MongoClient>;
  };

  if (!globalWithMongo._mongoClientPromise) {
    client = new MongoClient(uri, options);
    globalWithMongo._mongoClientPromise = client.connect();
  }
  clientPromise = globalWithMongo._mongoClientPromise;
} else {
  // In production mode, create a new client for each connection
  client = new MongoClient(uri, options);
  clientPromise = client.connect();
}

export default clientPromise;

export async function getDatabase(): Promise<Db> {
  const client = await clientPromise;
  return client.db(process.env.MONGODB_DB || 'inventory');
}
```

## Step 5: Create Product Model/Schema

Create `src/models/Product.ts`:

```typescript
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
```

## Step 6: Create API Routes

### Create `src/app/api/products/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';
import { ProductDocument, documentToProduct, productToDocument } from '@/models/Product';
import { ObjectId } from 'mongodb';

// GET - Fetch all products
export async function GET() {
  try {
    const db = await getDatabase();
    const products = await db
      .collection<ProductDocument>('products')
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json({
      success: true,
      data: products.map(documentToProduct),
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch products' },
      { status: 500 }
    );
  }
}

// POST - Create new product
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, code, count, description } = body;

    if (!name || !code || count === undefined) {
      return NextResponse.json(
        { success: false, error: 'Name, code, and count are required' },
        { status: 400 }
      );
    }

    const db = await getDatabase();
    
    // Check if product code already exists
    const existingProduct = await db
      .collection<ProductDocument>('products')
      .findOne({ code });

    if (existingProduct) {
      return NextResponse.json(
        { success: false, error: 'Product code already exists' },
        { status: 400 }
      );
    }

    const productDoc = productToDocument({ name, code, count, description });
    const result = await db.collection<ProductDocument>('products').insertOne(productDoc);

    const newProduct = await db
      .collection<ProductDocument>('products')
      .findOne({ _id: result.insertedId });

    return NextResponse.json({
      success: true,
      data: documentToProduct(newProduct!),
    });
  } catch (error) {
    console.error('Error creating product:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create product' },
      { status: 500 }
    );
  }
}
```

### Create `src/app/api/products/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';
import { ProductDocument, documentToProduct, productToDocument } from '@/models/Product';
import { ObjectId } from 'mongodb';

// PUT - Update product
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();
    const { name, code, count, description } = body;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid product ID' },
        { status: 400 }
      );
    }

    const db = await getDatabase();
    const updateDoc = {
      ...productToDocument({ name, code, count, description }),
      updatedAt: new Date(),
    };

    const result = await db
      .collection<ProductDocument>('products')
      .findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set: updateDoc },
        { returnDocument: 'after' }
      );

    if (!result.value) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: documentToProduct(result.value),
    });
  } catch (error) {
    console.error('Error updating product:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update product' },
      { status: 500 }
    );
  }
}

// DELETE - Delete product
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid product ID' },
        { status: 400 }
      );
    }

    const db = await getDatabase();
    const result = await db
      .collection<ProductDocument>('products')
      .deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Product deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting product:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete product' },
      { status: 500 }
    );
  }
}
```

## Step 7: Create API Service Functions

Create `src/services/productService.ts`:

```typescript
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
```

## Step 8: Update Your Components

### Update `src/app/page.tsx`:

Replace localStorage logic with API calls:

```typescript
'use client';

import { useState, useEffect } from 'react';
import InventoryForm from '@/components/InventoryForm';
import InventoryList from '@/components/InventoryList';
import { Product } from '@/models/Product';
import * as productService from '@/services/productService';

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load products from MongoDB on component mount
  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const fetchedProducts = await productService.fetchProducts();
      setProducts(fetchedProducts);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const addProduct = async (product: Omit<Product, 'id'>) => {
    try {
      const newProduct = await productService.createProduct(product);
      setProducts(prev => [newProduct, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add product');
    }
  };

  const updateProduct = async (id: string, updatedProduct: Omit<Product, 'id'>) => {
    try {
      const updated = await productService.updateProduct(id, updatedProduct);
      setProducts(prev => 
        prev.map(product => 
          product.id === id ? updated : product
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update product');
    }
  };

  const deleteProduct = async (id: string) => {
    try {
      await productService.deleteProduct(id);
      setProducts(prev => prev.filter(product => product.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete product');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading inventory...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 sm:px-6 lg:px-8 py-6">
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
            <button 
              onClick={() => setError(null)}
              className="ml-2 text-red-500 hover:text-red-700"
            >
              ×
            </button>
          </div>
        )}

        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Inventory Management System
            </h1>
            <p className="text-gray-600 mt-1">
              Manage your product inventory with ease
            </p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition duration-200 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Add Product
          </button>
        </div>

        <InventoryList 
          products={products}
          onUpdateProduct={updateProduct}
          onDeleteProduct={deleteProduct}
        />

        <InventoryForm 
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onAddProduct={addProduct} 
        />
      </div>
    </div>
  );
}
```

## Step 9: Test the Connection

1. **Start your development server:**
   ```bash
   npm run dev
   ```

2. **Check for errors** in the browser console and terminal

3. **Test CRUD operations:**
   - Add a new product
   - Edit existing products
   - Delete products
   - Verify data persists after page refresh

## Step 10: Data Migration (Optional)

If you have existing data in localStorage, create a migration script:

Create `scripts/migrate-localStorage-to-mongodb.js`:

```javascript
// Run this in browser console to export localStorage data
const products = JSON.parse(localStorage.getItem('inventory-products') || '[]');
console.log('Copy this data:', JSON.stringify(products, null, 2));

// Then use the API to import the data
```

## Troubleshooting

### Common Issues:

1. **Connection String Issues:**
   - Ensure username/password are URL-encoded
   - Check network access settings in MongoDB Atlas

2. **Environment Variables:**
   - Restart development server after adding `.env.local`
   - Verify variable names match exactly

3. **CORS Issues:**
   - Next.js API routes handle CORS automatically
   - Ensure you're using `/api/` routes correctly

4. **Database Permissions:**
   - Verify database user has read/write permissions
   - Check IP whitelist in MongoDB Atlas

### Useful Commands:

```bash
# Check MongoDB connection
npx mongodb-connection-string-url --help

# View environment variables
echo $MONGODB_URI

# Test API endpoints
curl http://localhost:3000/api/products
```

## Next Steps

1. **Add Indexes** for better performance:
   ```javascript
   db.products.createIndex({ "code": 1 }, { unique: true })
   db.products.createIndex({ "name": "text", "description": "text" })
   ```

2. **Add Data Validation** using MongoDB schema validation

3. **Implement Search** functionality using MongoDB text search

4. **Add Backup Strategy** for production data

5. **Consider MongoDB Transactions** for complex operations

## Security Best Practices

- Never commit `.env` files to version control
- Use strong passwords for database users
- Implement proper input validation
- Use connection pooling for production
- Enable MongoDB authentication
- Regularly update dependencies

---

**Congratulations!** You now have a fully functional inventory management system connected to MongoDB. Your data will persist across sessions and be accessible from multiple devices.
