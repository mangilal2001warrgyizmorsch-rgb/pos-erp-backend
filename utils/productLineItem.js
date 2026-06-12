import mongoose from 'mongoose';
import { randomInt } from 'crypto';
import Product from '../models/Product.js';
import Category from '../models/Category.js';
import Counter from '../models/Counter.js';

const AUTO_PRODUCT_CATEGORY_NAME = 'General';
const VALID_UNITS = new Set(['piece', 'kg', 'liter', 'meter', 'box', 'dozen']);

export const normalizeProductName = (value = '') =>
  String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();

const cleanString = (value) => String(value || '').trim();

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const nameRegexFromNormalized = (normalizedName) => {
  const parts = normalizedName.split(' ').filter(Boolean).map(escapeRegex);
  return new RegExp(`^\\s*${parts.join('\\s+')}\\s*$`, 'i');
};

const queryWithSession = (query, session) => (session ? query.session(session) : query);

const getObjectId = (value) => {
  if (!value) return null;
  if (value instanceof mongoose.Types.ObjectId) return value;
  if (typeof value === 'object' && value._id) return getObjectId(value._id);
  return mongoose.Types.ObjectId.isValid(value) ? new mongoose.Types.ObjectId(value) : null;
};

const getLineProductName = (lineItem) =>
  cleanString(lineItem.itemName || lineItem.productName || lineItem.name || lineItem.product?.name);

const normalizeUnit = (unit) => {
  const value = cleanString(unit).toLowerCase();
  return VALID_UNITS.has(value) ? value : 'piece';
};

const findProductByNormalizedName = async (normalizedName, unit, session) => {
  if (!normalizedName) return null;
  const nameMatch = {
    $or: [
      { normalizedName },
      { name: nameRegexFromNormalized(normalizedName) },
    ],
    isActive: true,
  };

  if (unit) {
    const sameUnitProduct = await queryWithSession(Product.findOne({ ...nameMatch, unit }), session);
    if (sameUnitProduct) return sameUnitProduct;
  }

  return queryWithSession(Product.findOne(nameMatch), session);
};

const ensureDefaultCategory = async (session) => {
  let category = await queryWithSession(Category.findOne({ name: new RegExp(`^${AUTO_PRODUCT_CATEGORY_NAME}$`, 'i') }), session);
  if (category) return category._id;

  const created = await Category.create([{
    name: AUTO_PRODUCT_CATEGORY_NAME,
    description: 'Default category for auto-created products',
    isActive: true,
  }], { session });
  return created[0]._id;
};

const getCategoryId = async (lineItem, session) => {
  const categoryId = getObjectId(lineItem.category);
  if (categoryId) {
    const category = await queryWithSession(Category.findById(categoryId), session);
    if (category) return category._id;
  }
  return ensureDefaultCategory(session);
};

const getSequence = async (sequenceId, session) => {
  const counter = await Counter.findByIdAndUpdate(
    sequenceId,
    { $inc: { seq: 1 } },
    { new: true, upsert: true, session }
  );
  return counter.seq;
};

export const generateUniqueBarcode = async (session = null) => {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const barcode = String(randomInt(100000000000, 1000000000000));
    const exists = await queryWithSession(Product.exists({ barcode }), session);
    if (!exists) return barcode;
  }
  throw new Error('Unable to generate a unique product barcode. Please try again.');
};

export const generateUniqueHsnCode = async (session = null) => {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const seq = await getSequence('AUTO-HSN', session);
    const hsnCode = `900000${String(seq).padStart(2, '0')}`;
    const exists = await queryWithSession(Product.exists({ hsnCode }), session);
    if (!exists) return hsnCode;
  }
  throw new Error('Unable to generate a unique HSN code. Please try again.');
};

const generateUniqueSku = async (name, barcode, session = null) => {
  const source = cleanString(barcode) || normalizeProductName(name).replace(/[^a-z0-9]+/gi, '-').toUpperCase();
  const prefix = (source || 'AUTO-PRODUCT').replace(/^-+|-+$/g, '').slice(0, 18) || 'AUTO-PRODUCT';

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const seq = await getSequence(`SKU-${prefix}`, session);
    const sku = `${prefix}-${String(seq).padStart(4, '0')}`.toUpperCase();
    const exists = await queryWithSession(Product.exists({ sku }), session);
    if (!exists) return sku;
  }
  throw new Error('Unable to generate a unique SKU. Please try again.');
};

const updateExistingBarcodeIfAllowed = async (product, barcode, session) => {
  const incomingBarcode = cleanString(barcode);
  if (!incomingBarcode) return product;
  if (product.barcode === incomingBarcode) return product;

  if (product.barcode) {
    throw new Error('Product already exists with a different barcode.');
  }

  const barcodeOwner = await queryWithSession(Product.findOne({ barcode: incomingBarcode, _id: { $ne: product._id } }), session);
  if (barcodeOwner) {
    throw new Error('Barcode already exists for another product.');
  }

  product.barcode = incomingBarcode;
  await product.save({ session });
  return product;
};

export const findOrCreateProductFromLineItem = async (lineItem = {}, context, session = null) => {
  if (!['purchase', 'opening_stock'].includes(context)) {
    throw new Error('Invalid product creation context.');
  }

  const productObjectId = getObjectId(lineItem.productId || lineItem.product);
  if (productObjectId) {
    const product = await queryWithSession(Product.findById(productObjectId), session);
    if (!product) throw new Error('Selected product does not exist.');
    return {
      product,
      created: false,
      generatedBarcode: false,
      generatedHsnCode: false,
    };
  }

  const itemName = getLineProductName(lineItem);
  const normalizedName = normalizeProductName(itemName);
  const barcode = cleanString(lineItem.barcode);
  const unit = normalizeUnit(lineItem.unit);

  if (!normalizedName && !barcode) {
    throw new Error('Product name is required.');
  }

  if (barcode) {
    const barcodeProduct = await queryWithSession(Product.findOne({ barcode, isActive: true }), session);
    if (barcodeProduct) {
      if (normalizedName && normalizeProductName(barcodeProduct.name) !== normalizedName) {
        throw new Error('Barcode already exists for another product.');
      }
      return {
        product: barcodeProduct,
        created: false,
        generatedBarcode: false,
        generatedHsnCode: false,
      };
    }
  }

  let nameProduct = await findProductByNormalizedName(normalizedName, unit, session);
  if (nameProduct) {
    nameProduct = await updateExistingBarcodeIfAllowed(nameProduct, barcode, session);
    return {
      product: nameProduct,
      created: false,
      generatedBarcode: false,
      generatedHsnCode: false,
    };
  }

  const finalBarcode = barcode || await generateUniqueBarcode(session);
  const providedHsn = cleanString(lineItem.hsnCode || lineItem.hsn);
  const finalHsnCode = providedHsn || await generateUniqueHsnCode(session);
  const generatedHsnCode = !providedHsn;
  const providedSku = cleanString(lineItem.sku).toUpperCase();
  const skuExists = providedSku ? await queryWithSession(Product.exists({ sku: providedSku }), session) : null;
  const sku = providedSku && !skuExists
    ? providedSku
    : await generateUniqueSku(itemName || finalBarcode, finalBarcode, session);

  const [product] = await Product.create([{
    name: itemName || finalBarcode,
    normalizedName,
    sku,
    barcode: finalBarcode,
    hsnCode: finalHsnCode,
    hsnAutoGenerated: generatedHsnCode,
    category: await getCategoryId(lineItem, session),
    subcategoryId: getObjectId(lineItem.subcategory || lineItem.subcategoryId) || undefined,
    unit,
    purchasePrice: Number(lineItem.purchasePrice ?? lineItem.rate ?? 0),
    salesPrice: Number(lineItem.salePrice ?? lineItem.salesPrice ?? lineItem.purchasePrice ?? lineItem.rate ?? 0),
    taxRate: Number(lineItem.taxRate ?? lineItem.gstRate ?? 0),
    openingStockPrice: Number(lineItem.purchasePrice ?? lineItem.rate ?? 0),
    openingStockDate: lineItem.openingStockDate || new Date(),
    stock: 0,
    isActive: true,
    source: context,
  }], { session });

  return {
    product,
    created: true,
    generatedBarcode: !barcode,
    generatedHsnCode,
  };
};
