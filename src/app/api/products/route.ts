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
