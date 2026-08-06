# POS ERP API Reference & cURL Guide

This document lists all active API endpoints, methods, header parameters, payload structures, and cURL commands for the POS ERP system.

**Base URL:** `https://pos-erp-backend.onrender.com`

## Table of Contents
- [Auth APIs](#auth-apis)
- [Products APIs](#products-apis)
- [Categories APIs](#categories-apis)
- [Subcategories APIs](#subcategories-apis)
- [Customers APIs](#customers-apis)
- [Suppliers APIs](#suppliers-apis)
- [Transporters APIs](#transporters-apis)
- [Sales APIs](#sales-apis)
- [Purchases APIs](#purchases-apis)
- [Sale Returns APIs](#sale-returns-apis)
- [Purchase Returns APIs](#purchase-returns-apis)
- [Expenses APIs](#expenses-apis)
- [Expense Categories APIs](#expense-categories-apis)
- [General Returns APIs](#general-returns-apis)
- [Shifts APIs](#shifts-apis)
- [Analytics APIs](#analytics-apis)
- [Reports APIs](#reports-apis)
- [Sales Prices APIs](#sales-prices-apis)
- [Uploads APIs](#uploads-apis)
- [Bank Accounts APIs](#bank-accounts-apis)
- [Loans APIs](#loans-apis)
- [Cheques APIs](#cheques-apis)
- [Business Profile APIs](#business-profile-apis)
- [Payment In APIs](#payment-in-apis)
- [Payment Out APIs](#payment-out-apis)
- [Cash & Bank Book APIs](#cash-&-bank-book-apis)
- [Party Ledger APIs](#party-ledger-apis)
- [Inventory Logs APIs](#inventory-logs-apis)
- [Stock movements APIs](#stock-movements-apis)
- [Activity Audit Logs APIs](#activity-audit-logs-apis)
- [Accounting Engine APIs](#accounting-engine-apis)
- [System Notifications APIs](#system-notifications-apis)

---

## Auth APIs
**Base Mount Path:** `/api/auth`

### `POST` /register

**URL:** `https://pos-erp-backend.onrender.com/api/auth/register`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X POST \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Staff User",
    "email": "staff@poserp.com",
    "password": "password123",
    "role": "cashier"
  }' \
  https://pos-erp-backend.onrender.com/api/auth/register
```

### `POST` /login

**URL:** `https://pos-erp-backend.onrender.com/api/auth/login`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X POST \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@poserp.com",
    "password": "admin123"
  }' \
  https://pos-erp-backend.onrender.com/api/auth/login
```

### `POST` /forgot-password

**URL:** `https://pos-erp-backend.onrender.com/api/auth/forgot-password`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X POST \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "sampleKey": "value"
  }' \
  https://pos-erp-backend.onrender.com/api/auth/forgot-password
```

### `PUT` /reset-password/:token

**URL:** `https://pos-erp-backend.onrender.com/api/auth/reset-password/:token`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X PUT \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "sampleKey": "value"
  }' \
  https://pos-erp-backend.onrender.com/api/auth/reset-password/:token
```

### `GET` /me

**URL:** `https://pos-erp-backend.onrender.com/api/auth/me`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/auth/me
```

### `PUT` /profile

**URL:** `https://pos-erp-backend.onrender.com/api/auth/profile`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X PUT \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "sampleKey": "value"
  }' \
  https://pos-erp-backend.onrender.com/api/auth/profile
```

### `PUT` /change-password

**URL:** `https://pos-erp-backend.onrender.com/api/auth/change-password`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X PUT \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "sampleKey": "value"
  }' \
  https://pos-erp-backend.onrender.com/api/auth/change-password
```


---

## Products APIs
**Base Mount Path:** `/api/products`

### `POST` /bulk-import

**URL:** `https://pos-erp-backend.onrender.com/api/products/bulk-import`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X POST \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Sample Item",
    "sku": "ITEM-001",
    "salesPrice": 250,
    "purchasePrice": 180,
    "taxRate": 18
  }' \
  https://pos-erp-backend.onrender.com/api/products/bulk-import
```

### `GET` /global-library

**URL:** `https://pos-erp-backend.onrender.com/api/products/global-library`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/products/global-library
```

### `GET` /stats/overview

**URL:** `https://pos-erp-backend.onrender.com/api/products/stats/overview`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/products/stats/overview
```

### `GET` /barcode/:barcode

**URL:** `https://pos-erp-backend.onrender.com/api/products/barcode/:barcode`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/products/barcode/:barcode
```

### `GET` /:id/price-options

**URL:** `https://pos-erp-backend.onrender.com/api/products/:id/price-options`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/products/:id/price-options
```

### `GET` /:id/pricing

**URL:** `https://pos-erp-backend.onrender.com/api/products/:id/pricing`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/products/:id/pricing
```

### `GET` 

**URL:** `https://pos-erp-backend.onrender.com/api/products`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/products
```

### `POST` 

**URL:** `https://pos-erp-backend.onrender.com/api/products`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X POST \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Sample Item",
    "sku": "ITEM-001",
    "salesPrice": 250,
    "purchasePrice": 180,
    "taxRate": 18
  }' \
  https://pos-erp-backend.onrender.com/api/products
```

### `GET` /:id

**URL:** `https://pos-erp-backend.onrender.com/api/products/:id`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/products/:id
```

### `PUT` /:id

**URL:** `https://pos-erp-backend.onrender.com/api/products/:id`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X PUT \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Sample Item",
    "sku": "ITEM-001",
    "salesPrice": 250,
    "purchasePrice": 180,
    "taxRate": 18
  }' \
  https://pos-erp-backend.onrender.com/api/products/:id
```

### `DELETE` /:id

**URL:** `https://pos-erp-backend.onrender.com/api/products/:id`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X DELETE \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/products/:id
```


---

## Categories APIs
**Base Mount Path:** `/api/categories`

### `GET` 

**URL:** `https://pos-erp-backend.onrender.com/api/categories`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/categories
```

### `POST` 

**URL:** `https://pos-erp-backend.onrender.com/api/categories`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X POST \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "General Goods",
    "description": "Standard wholesale goods category"
  }' \
  https://pos-erp-backend.onrender.com/api/categories
```

### `PUT` /:id

**URL:** `https://pos-erp-backend.onrender.com/api/categories/:id`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X PUT \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "General Goods",
    "description": "Standard wholesale goods category"
  }' \
  https://pos-erp-backend.onrender.com/api/categories/:id
```

### `DELETE` /:id

**URL:** `https://pos-erp-backend.onrender.com/api/categories/:id`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X DELETE \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/categories/:id
```


---

## Subcategories APIs
**Base Mount Path:** `/api/subcategories`

### `GET` 

**URL:** `https://pos-erp-backend.onrender.com/api/subcategories`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/subcategories
```

### `POST` 

**URL:** `https://pos-erp-backend.onrender.com/api/subcategories`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X POST \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "sampleKey": "value"
  }' \
  https://pos-erp-backend.onrender.com/api/subcategories
```

### `PUT` /:id

**URL:** `https://pos-erp-backend.onrender.com/api/subcategories/:id`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X PUT \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "sampleKey": "value"
  }' \
  https://pos-erp-backend.onrender.com/api/subcategories/:id
```

### `DELETE` /:id

**URL:** `https://pos-erp-backend.onrender.com/api/subcategories/:id`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X DELETE \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/subcategories/:id
```


---

## Customers APIs
**Base Mount Path:** `/api/customers`

### `GET` /search

**URL:** `https://pos-erp-backend.onrender.com/api/customers/search`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/customers/search
```

### `GET` 

**URL:** `https://pos-erp-backend.onrender.com/api/customers`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/customers
```

### `POST` 

**URL:** `https://pos-erp-backend.onrender.com/api/customers`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X POST \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Customer A",
    "phone": "9876543210",
    "email": "customera@example.com"
  }' \
  https://pos-erp-backend.onrender.com/api/customers
```

### `GET` /:id

**URL:** `https://pos-erp-backend.onrender.com/api/customers/:id`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/customers/:id
```

### `PUT` /:id

**URL:** `https://pos-erp-backend.onrender.com/api/customers/:id`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X PUT \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Customer A",
    "phone": "9876543210",
    "email": "customera@example.com"
  }' \
  https://pos-erp-backend.onrender.com/api/customers/:id
```

### `DELETE` /:id

**URL:** `https://pos-erp-backend.onrender.com/api/customers/:id`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X DELETE \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/customers/:id
```


---

## Suppliers APIs
**Base Mount Path:** `/api/suppliers`

### `GET` /search

**URL:** `https://pos-erp-backend.onrender.com/api/suppliers/search`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/suppliers/search
```

### `GET` 

**URL:** `https://pos-erp-backend.onrender.com/api/suppliers`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/suppliers
```

### `POST` 

**URL:** `https://pos-erp-backend.onrender.com/api/suppliers`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X POST \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Supplier Inc",
    "phone": "8877665544",
    "email": "info@supplier.com"
  }' \
  https://pos-erp-backend.onrender.com/api/suppliers
```

### `GET` /:id

**URL:** `https://pos-erp-backend.onrender.com/api/suppliers/:id`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/suppliers/:id
```

### `PUT` /:id

**URL:** `https://pos-erp-backend.onrender.com/api/suppliers/:id`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X PUT \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Supplier Inc",
    "phone": "8877665544",
    "email": "info@supplier.com"
  }' \
  https://pos-erp-backend.onrender.com/api/suppliers/:id
```

### `DELETE` /:id

**URL:** `https://pos-erp-backend.onrender.com/api/suppliers/:id`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X DELETE \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/suppliers/:id
```


---

## Transporters APIs
**Base Mount Path:** `/api/transporters`

### `GET` 

**URL:** `https://pos-erp-backend.onrender.com/api/transporters`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/transporters
```

### `POST` 

**URL:** `https://pos-erp-backend.onrender.com/api/transporters`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X POST \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "sampleKey": "value"
  }' \
  https://pos-erp-backend.onrender.com/api/transporters
```

### `GET` /:id

**URL:** `https://pos-erp-backend.onrender.com/api/transporters/:id`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/transporters/:id
```

### `PUT` /:id

**URL:** `https://pos-erp-backend.onrender.com/api/transporters/:id`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X PUT \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "sampleKey": "value"
  }' \
  https://pos-erp-backend.onrender.com/api/transporters/:id
```

### `DELETE` /:id

**URL:** `https://pos-erp-backend.onrender.com/api/transporters/:id`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X DELETE \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/transporters/:id
```


---

## Sales APIs
**Base Mount Path:** `/api/sales`

### `GET` /stats/dashboard

**URL:** `https://pos-erp-backend.onrender.com/api/sales/stats/dashboard`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/sales/stats/dashboard
```

### `GET` /reports/sales

**URL:** `https://pos-erp-backend.onrender.com/api/sales/reports/sales`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/sales/reports/sales
```

### `GET` /unpaid/:customerId

**URL:** `https://pos-erp-backend.onrender.com/api/sales/unpaid/:customerId`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/sales/unpaid/:customerId
```

### `GET` /customer/:customerId/unreturned

**URL:** `https://pos-erp-backend.onrender.com/api/sales/customer/:customerId/unreturned`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/sales/customer/:customerId/unreturned
```

### `GET` /:id/returnable-items

**URL:** `https://pos-erp-backend.onrender.com/api/sales/:id/returnable-items`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/sales/:id/returnable-items
```

### `GET` 

**URL:** `https://pos-erp-backend.onrender.com/api/sales`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/sales
```

### `POST` 

**URL:** `https://pos-erp-backend.onrender.com/api/sales`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X POST \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "productId": "60c72b2f9b1d8a2c88888888",
        "quantity": 2,
        "unitPrice": 250,
        "total": 500
      }
    ],
    "paymentMethod": "cash",
    "totalAmount": 500
  }' \
  https://pos-erp-backend.onrender.com/api/sales
```

### `GET` /:id

**URL:** `https://pos-erp-backend.onrender.com/api/sales/:id`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/sales/:id
```

### `PUT` /:id

**URL:** `https://pos-erp-backend.onrender.com/api/sales/:id`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X PUT \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "productId": "60c72b2f9b1d8a2c88888888",
        "quantity": 2,
        "unitPrice": 250,
        "total": 500
      }
    ],
    "paymentMethod": "cash",
    "totalAmount": 500
  }' \
  https://pos-erp-backend.onrender.com/api/sales/:id
```

### `DELETE` /:id

**URL:** `https://pos-erp-backend.onrender.com/api/sales/:id`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X DELETE \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/sales/:id
```

### `PUT` /:id/cancel

**URL:** `https://pos-erp-backend.onrender.com/api/sales/:id/cancel`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X PUT \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "productId": "60c72b2f9b1d8a2c88888888",
        "quantity": 2,
        "unitPrice": 250,
        "total": 500
      }
    ],
    "paymentMethod": "cash",
    "totalAmount": 500
  }' \
  https://pos-erp-backend.onrender.com/api/sales/:id/cancel
```


---

## Purchases APIs
**Base Mount Path:** `/api/purchases`

### `GET` /unpaid/:supplierId

**URL:** `https://pos-erp-backend.onrender.com/api/purchases/unpaid/:supplierId`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/purchases/unpaid/:supplierId
```

### `GET` /supplier/:supplierId/unreturned

**URL:** `https://pos-erp-backend.onrender.com/api/purchases/supplier/:supplierId/unreturned`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/purchases/supplier/:supplierId/unreturned
```

### `GET` /:id/returnable-items

**URL:** `https://pos-erp-backend.onrender.com/api/purchases/:id/returnable-items`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/purchases/:id/returnable-items
```

### `GET` 

**URL:** `https://pos-erp-backend.onrender.com/api/purchases`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/purchases
```

### `POST` 

**URL:** `https://pos-erp-backend.onrender.com/api/purchases`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X POST \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "sampleKey": "value"
  }' \
  https://pos-erp-backend.onrender.com/api/purchases
```

### `GET` /:id

**URL:** `https://pos-erp-backend.onrender.com/api/purchases/:id`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/purchases/:id
```

### `PUT` /:id

**URL:** `https://pos-erp-backend.onrender.com/api/purchases/:id`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X PUT \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "sampleKey": "value"
  }' \
  https://pos-erp-backend.onrender.com/api/purchases/:id
```

### `DELETE` /:id

**URL:** `https://pos-erp-backend.onrender.com/api/purchases/:id`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X DELETE \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/purchases/:id
```


---

## Sale Returns APIs
**Base Mount Path:** `/api/sale-returns`

### `GET` /customer/:customerId/unreturned

**URL:** `https://pos-erp-backend.onrender.com/api/sale-returns/customer/:customerId/unreturned`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/sale-returns/customer/:customerId/unreturned
```

### `GET` /invoice/:id/returnable-items

**URL:** `https://pos-erp-backend.onrender.com/api/sale-returns/invoice/:id/returnable-items`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/sale-returns/invoice/:id/returnable-items
```

### `GET` 

**URL:** `https://pos-erp-backend.onrender.com/api/sale-returns`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/sale-returns
```

### `POST` 

**URL:** `https://pos-erp-backend.onrender.com/api/sale-returns`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X POST \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "sampleKey": "value"
  }' \
  https://pos-erp-backend.onrender.com/api/sale-returns
```

### `GET` /:id

**URL:** `https://pos-erp-backend.onrender.com/api/sale-returns/:id`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/sale-returns/:id
```

### `PUT` /:id

**URL:** `https://pos-erp-backend.onrender.com/api/sale-returns/:id`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X PUT \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "sampleKey": "value"
  }' \
  https://pos-erp-backend.onrender.com/api/sale-returns/:id
```

### `DELETE` /:id

**URL:** `https://pos-erp-backend.onrender.com/api/sale-returns/:id`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X DELETE \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/sale-returns/:id
```

### `POST` /:id/cancel

**URL:** `https://pos-erp-backend.onrender.com/api/sale-returns/:id/cancel`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X POST \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "sampleKey": "value"
  }' \
  https://pos-erp-backend.onrender.com/api/sale-returns/:id/cancel
```


---

## Purchase Returns APIs
**Base Mount Path:** `/api/purchase-returns`

### `GET` /supplier/:supplierId/unreturned

**URL:** `https://pos-erp-backend.onrender.com/api/purchase-returns/supplier/:supplierId/unreturned`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/purchase-returns/supplier/:supplierId/unreturned
```

### `GET` /bill/:id/returnable-items

**URL:** `https://pos-erp-backend.onrender.com/api/purchase-returns/bill/:id/returnable-items`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/purchase-returns/bill/:id/returnable-items
```

### `GET` 

**URL:** `https://pos-erp-backend.onrender.com/api/purchase-returns`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/purchase-returns
```

### `POST` 

**URL:** `https://pos-erp-backend.onrender.com/api/purchase-returns`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X POST \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "sampleKey": "value"
  }' \
  https://pos-erp-backend.onrender.com/api/purchase-returns
```

### `GET` /:id

**URL:** `https://pos-erp-backend.onrender.com/api/purchase-returns/:id`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/purchase-returns/:id
```

### `PUT` /:id

**URL:** `https://pos-erp-backend.onrender.com/api/purchase-returns/:id`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X PUT \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "sampleKey": "value"
  }' \
  https://pos-erp-backend.onrender.com/api/purchase-returns/:id
```

### `DELETE` /:id

**URL:** `https://pos-erp-backend.onrender.com/api/purchase-returns/:id`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X DELETE \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/purchase-returns/:id
```

### `POST` /:id/cancel

**URL:** `https://pos-erp-backend.onrender.com/api/purchase-returns/:id/cancel`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X POST \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "sampleKey": "value"
  }' \
  https://pos-erp-backend.onrender.com/api/purchase-returns/:id/cancel
```


---

## Expenses APIs
**Base Mount Path:** `/api/expenses`

### `GET` /reports/summary

**URL:** `https://pos-erp-backend.onrender.com/api/expenses/reports/summary`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/expenses/reports/summary
```

### `GET` /ledgers

**URL:** `https://pos-erp-backend.onrender.com/api/expenses/ledgers`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/expenses/ledgers
```

### `POST` /ledgers/quick-create

**URL:** `https://pos-erp-backend.onrender.com/api/expenses/ledgers/quick-create`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X POST \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "sampleKey": "value"
  }' \
  https://pos-erp-backend.onrender.com/api/expenses/ledgers/quick-create
```

### `GET` 

**URL:** `https://pos-erp-backend.onrender.com/api/expenses`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/expenses
```

### `POST` 

**URL:** `https://pos-erp-backend.onrender.com/api/expenses`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X POST \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "sampleKey": "value"
  }' \
  https://pos-erp-backend.onrender.com/api/expenses
```

### `GET` /:id

**URL:** `https://pos-erp-backend.onrender.com/api/expenses/:id`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/expenses/:id
```

### `PUT` /:id

**URL:** `https://pos-erp-backend.onrender.com/api/expenses/:id`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X PUT \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "sampleKey": "value"
  }' \
  https://pos-erp-backend.onrender.com/api/expenses/:id
```

### `DELETE` /:id

**URL:** `https://pos-erp-backend.onrender.com/api/expenses/:id`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X DELETE \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/expenses/:id
```


---

## Expense Categories APIs
**Base Mount Path:** `/api/expense-categories`

### `GET` 

**URL:** `https://pos-erp-backend.onrender.com/api/expense-categories`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/expense-categories
```

### `POST` 

**URL:** `https://pos-erp-backend.onrender.com/api/expense-categories`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X POST \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "sampleKey": "value"
  }' \
  https://pos-erp-backend.onrender.com/api/expense-categories
```

### `PUT` /:id

**URL:** `https://pos-erp-backend.onrender.com/api/expense-categories/:id`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X PUT \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "sampleKey": "value"
  }' \
  https://pos-erp-backend.onrender.com/api/expense-categories/:id
```

### `DELETE` /:id

**URL:** `https://pos-erp-backend.onrender.com/api/expense-categories/:id`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X DELETE \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/expense-categories/:id
```


---

## General Returns APIs
**Base Mount Path:** `/api/returns`

### `GET` /sales

**URL:** `https://pos-erp-backend.onrender.com/api/returns/sales`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/returns/sales
```

### `POST` /sales

**URL:** `https://pos-erp-backend.onrender.com/api/returns/sales`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X POST \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "sampleKey": "value"
  }' \
  https://pos-erp-backend.onrender.com/api/returns/sales
```

### `GET` /purchases

**URL:** `https://pos-erp-backend.onrender.com/api/returns/purchases`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/returns/purchases
```

### `POST` /purchases

**URL:** `https://pos-erp-backend.onrender.com/api/returns/purchases`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X POST \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "sampleKey": "value"
  }' \
  https://pos-erp-backend.onrender.com/api/returns/purchases
```


---

## Shifts APIs
**Base Mount Path:** `/api/shifts`

### `POST` /open

**URL:** `https://pos-erp-backend.onrender.com/api/shifts/open`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X POST \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "sampleKey": "value"
  }' \
  https://pos-erp-backend.onrender.com/api/shifts/open
```

### `GET` /current

**URL:** `https://pos-erp-backend.onrender.com/api/shifts/current`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/shifts/current
```

### `PUT` /close

**URL:** `https://pos-erp-backend.onrender.com/api/shifts/close`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X PUT \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "sampleKey": "value"
  }' \
  https://pos-erp-backend.onrender.com/api/shifts/close
```


---

## Analytics APIs
**Base Mount Path:** `/api/analytics`

### `GET` /inventory

**URL:** `https://pos-erp-backend.onrender.com/api/analytics/inventory`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/analytics/inventory
```

### `GET` /sales

**URL:** `https://pos-erp-backend.onrender.com/api/analytics/sales`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/analytics/sales
```

### `GET` /revenue

**URL:** `https://pos-erp-backend.onrender.com/api/analytics/revenue`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/analytics/revenue
```

### `GET` /purchases

**URL:** `https://pos-erp-backend.onrender.com/api/analytics/purchases`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/analytics/purchases
```

### `GET` /cashflow

**URL:** `https://pos-erp-backend.onrender.com/api/analytics/cashflow`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/analytics/cashflow
```


---

## Reports APIs
**Base Mount Path:** `/api/reports`

### `GET` /inventory

**URL:** `https://pos-erp-backend.onrender.com/api/reports/inventory`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/reports/inventory
```

### `GET` /sales

**URL:** `https://pos-erp-backend.onrender.com/api/reports/sales`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/reports/sales
```

### `GET` /revenue

**URL:** `https://pos-erp-backend.onrender.com/api/reports/revenue`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/reports/revenue
```

### `GET` /purchases

**URL:** `https://pos-erp-backend.onrender.com/api/reports/purchases`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/reports/purchases
```


---

## Sales Prices APIs
**Base Mount Path:** `/api/sales-prices`

### `GET` /product/:productId

**URL:** `https://pos-erp-backend.onrender.com/api/sales-prices/product/:productId`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/sales-prices/product/:productId
```

### `GET` /barcode/:barcode

**URL:** `https://pos-erp-backend.onrender.com/api/sales-prices/barcode/:barcode`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/sales-prices/barcode/:barcode
```

### `GET` /latest/:barcode

**URL:** `https://pos-erp-backend.onrender.com/api/sales-prices/latest/:barcode`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/sales-prices/latest/:barcode
```


---

## Uploads APIs
**Base Mount Path:** `/api/upload`

### `POST` /single/:folder

**URL:** `https://pos-erp-backend.onrender.com/api/upload/single/:folder`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X POST \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "sampleKey": "value"
  }' \
  https://pos-erp-backend.onrender.com/api/upload/single/:folder
```

### `POST` /multiple/:folder

**URL:** `https://pos-erp-backend.onrender.com/api/upload/multiple/:folder`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X POST \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "sampleKey": "value"
  }' \
  https://pos-erp-backend.onrender.com/api/upload/multiple/:folder
```


---

## Bank Accounts APIs
**Base Mount Path:** `/api/bank`

### `GET` 

**URL:** `https://pos-erp-backend.onrender.com/api/bank`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/bank
```

### `POST` 

**URL:** `https://pos-erp-backend.onrender.com/api/bank`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X POST \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "sampleKey": "value"
  }' \
  https://pos-erp-backend.onrender.com/api/bank
```

### `GET` /transaction

**URL:** `https://pos-erp-backend.onrender.com/api/bank/transaction`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/bank/transaction
```

### `POST` /transaction

**URL:** `https://pos-erp-backend.onrender.com/api/bank/transaction`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X POST \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "sampleKey": "value"
  }' \
  https://pos-erp-backend.onrender.com/api/bank/transaction
```

### `GET` /:id

**URL:** `https://pos-erp-backend.onrender.com/api/bank/:id`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/bank/:id
```

### `PUT` /:id

**URL:** `https://pos-erp-backend.onrender.com/api/bank/:id`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X PUT \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "sampleKey": "value"
  }' \
  https://pos-erp-backend.onrender.com/api/bank/:id
```

### `DELETE` /:id

**URL:** `https://pos-erp-backend.onrender.com/api/bank/:id`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X DELETE \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/bank/:id
```


---

## Loans APIs
**Base Mount Path:** `/api/loans`

### `GET` 

**URL:** `https://pos-erp-backend.onrender.com/api/loans`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/loans
```

### `POST` 

**URL:** `https://pos-erp-backend.onrender.com/api/loans`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X POST \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "sampleKey": "value"
  }' \
  https://pos-erp-backend.onrender.com/api/loans
```

### `PUT` /:id

**URL:** `https://pos-erp-backend.onrender.com/api/loans/:id`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X PUT \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "sampleKey": "value"
  }' \
  https://pos-erp-backend.onrender.com/api/loans/:id
```

### `DELETE` /:id

**URL:** `https://pos-erp-backend.onrender.com/api/loans/:id`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X DELETE \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/loans/:id
```


---

## Cheques APIs
**Base Mount Path:** `/api/cheques`

### `GET` 

**URL:** `https://pos-erp-backend.onrender.com/api/cheques`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/cheques
```

### `POST` 

**URL:** `https://pos-erp-backend.onrender.com/api/cheques`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X POST \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "sampleKey": "value"
  }' \
  https://pos-erp-backend.onrender.com/api/cheques
```

### `PUT` /:id

**URL:** `https://pos-erp-backend.onrender.com/api/cheques/:id`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X PUT \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "sampleKey": "value"
  }' \
  https://pos-erp-backend.onrender.com/api/cheques/:id
```

### `DELETE` /:id

**URL:** `https://pos-erp-backend.onrender.com/api/cheques/:id`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X DELETE \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/cheques/:id
```


---

## Business Profile APIs
**Base Mount Path:** `/api/business`

### `GET` 

**URL:** `https://pos-erp-backend.onrender.com/api/business`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/business
```

### `PUT` 

**URL:** `https://pos-erp-backend.onrender.com/api/business`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X PUT \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "sampleKey": "value"
  }' \
  https://pos-erp-backend.onrender.com/api/business
```


---

## Payment In APIs
**Base Mount Path:** `/api/payment-in`

### `GET` 

**URL:** `https://pos-erp-backend.onrender.com/api/payment-in`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/payment-in
```

### `POST` 

**URL:** `https://pos-erp-backend.onrender.com/api/payment-in`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X POST \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "accountId": "60c72b2f9b1d8a2c99999999",
    "amount": 1500,
    "remarks": "Payment settlement"
  }' \
  https://pos-erp-backend.onrender.com/api/payment-in
```

### `GET` /:id

**URL:** `https://pos-erp-backend.onrender.com/api/payment-in/:id`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/payment-in/:id
```

### `PUT` /:id

**URL:** `https://pos-erp-backend.onrender.com/api/payment-in/:id`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X PUT \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "accountId": "60c72b2f9b1d8a2c99999999",
    "amount": 1500,
    "remarks": "Payment settlement"
  }' \
  https://pos-erp-backend.onrender.com/api/payment-in/:id
```

### `DELETE` /:id

**URL:** `https://pos-erp-backend.onrender.com/api/payment-in/:id`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X DELETE \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/payment-in/:id
```


---

## Payment Out APIs
**Base Mount Path:** `/api/payment-out`

### `GET` 

**URL:** `https://pos-erp-backend.onrender.com/api/payment-out`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/payment-out
```

### `POST` 

**URL:** `https://pos-erp-backend.onrender.com/api/payment-out`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X POST \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "accountId": "60c72b2f9b1d8a2c99999999",
    "amount": 1500,
    "remarks": "Payment settlement"
  }' \
  https://pos-erp-backend.onrender.com/api/payment-out
```

### `GET` /:id

**URL:** `https://pos-erp-backend.onrender.com/api/payment-out/:id`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/payment-out/:id
```

### `PUT` /:id

**URL:** `https://pos-erp-backend.onrender.com/api/payment-out/:id`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X PUT \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "accountId": "60c72b2f9b1d8a2c99999999",
    "amount": 1500,
    "remarks": "Payment settlement"
  }' \
  https://pos-erp-backend.onrender.com/api/payment-out/:id
```

### `DELETE` /:id

**URL:** `https://pos-erp-backend.onrender.com/api/payment-out/:id`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X DELETE \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/payment-out/:id
```


---

## Cash & Bank Book APIs
**Base Mount Path:** `/api/cash-bank`

### `GET` /summary

**URL:** `https://pos-erp-backend.onrender.com/api/cash-bank/summary`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/cash-bank/summary
```

### `GET` /transactions

**URL:** `https://pos-erp-backend.onrender.com/api/cash-bank/transactions`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/cash-bank/transactions
```

### `GET` /transactions/:id

**URL:** `https://pos-erp-backend.onrender.com/api/cash-bank/transactions/:id`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/cash-bank/transactions/:id
```

### `POST` /cash-entry

**URL:** `https://pos-erp-backend.onrender.com/api/cash-bank/cash-entry`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X POST \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "sampleKey": "value"
  }' \
  https://pos-erp-backend.onrender.com/api/cash-bank/cash-entry
```

### `POST` /bank-transfer

**URL:** `https://pos-erp-backend.onrender.com/api/cash-bank/bank-transfer`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X POST \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "sampleKey": "value"
  }' \
  https://pos-erp-backend.onrender.com/api/cash-bank/bank-transfer
```

### `POST` /transactions/:id/reverse

**URL:** `https://pos-erp-backend.onrender.com/api/cash-bank/transactions/:id/reverse`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X POST \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "sampleKey": "value"
  }' \
  https://pos-erp-backend.onrender.com/api/cash-bank/transactions/:id/reverse
```

### `GET` /accounts

**URL:** `https://pos-erp-backend.onrender.com/api/cash-bank/accounts`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/cash-bank/accounts
```

### `POST` /accounts

**URL:** `https://pos-erp-backend.onrender.com/api/cash-bank/accounts`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X POST \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "sampleKey": "value"
  }' \
  https://pos-erp-backend.onrender.com/api/cash-bank/accounts
```

### `PUT` /accounts/:id

**URL:** `https://pos-erp-backend.onrender.com/api/cash-bank/accounts/:id`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X PUT \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "sampleKey": "value"
  }' \
  https://pos-erp-backend.onrender.com/api/cash-bank/accounts/:id
```


---

## Party Ledger APIs
**Base Mount Path:** `/api/ledger`

### `GET` /:partyId

**URL:** `https://pos-erp-backend.onrender.com/api/ledger/:partyId`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/ledger/:partyId
```


---

## Inventory Logs APIs
**Base Mount Path:** `/api/inventory`

### `POST` /opening-stock

**URL:** `https://pos-erp-backend.onrender.com/api/inventory/opening-stock`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X POST \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "sampleKey": "value"
  }' \
  https://pos-erp-backend.onrender.com/api/inventory/opening-stock
```

### `GET` /history

**URL:** `https://pos-erp-backend.onrender.com/api/inventory/history`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/inventory/history
```


---

## Stock movements APIs
**Base Mount Path:** `/api/stock`

### `GET` 

**URL:** `https://pos-erp-backend.onrender.com/api/stock`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/stock
```

### `GET` /adjustments

**URL:** `https://pos-erp-backend.onrender.com/api/stock/adjustments`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/stock/adjustments
```

### `POST` /adjustments

**URL:** `https://pos-erp-backend.onrender.com/api/stock/adjustments`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X POST \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "sampleKey": "value"
  }' \
  https://pos-erp-backend.onrender.com/api/stock/adjustments
```

### `GET` /alerts

**URL:** `https://pos-erp-backend.onrender.com/api/stock/alerts`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/stock/alerts
```

### `GET` /stats

**URL:** `https://pos-erp-backend.onrender.com/api/stock/stats`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/stock/stats
```


---

## Activity Audit Logs APIs
**Base Mount Path:** `/api/activity-logs`

### `GET` 

**URL:** `https://pos-erp-backend.onrender.com/api/activity-logs`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/activity-logs
```


---

## Accounting Engine APIs
**Base Mount Path:** `/api/accounting`

### `GET` /status

**URL:** `https://pos-erp-backend.onrender.com/api/accounting/status`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/accounting/status
```

### `GET` /dashboard

**URL:** `https://pos-erp-backend.onrender.com/api/accounting/dashboard`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/accounting/dashboard
```

### `POST` /initialize

**URL:** `https://pos-erp-backend.onrender.com/api/accounting/initialize`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X POST \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "sampleKey": "value"
  }' \
  https://pos-erp-backend.onrender.com/api/accounting/initialize
```

### `GET` /chart-of-accounts

**URL:** `https://pos-erp-backend.onrender.com/api/accounting/chart-of-accounts`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/accounting/chart-of-accounts
```

### `GET` /day-book

**URL:** `https://pos-erp-backend.onrender.com/api/accounting/day-book`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/accounting/day-book
```

### `GET` /health-check

**URL:** `https://pos-erp-backend.onrender.com/api/accounting/health-check`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/accounting/health-check
```

### `GET` /audit-logs

**URL:** `https://pos-erp-backend.onrender.com/api/accounting/audit-logs`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/accounting/audit-logs
```

### `POST` /journal/draft

**URL:** `https://pos-erp-backend.onrender.com/api/accounting/journal/draft`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X POST \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2026-08-06",
    "remarks": "Adjusting ledger entry",
    "items": [
      {
        "ledgerId": "60c72b2f9b1d8a2c11111111",
        "debit": 500,
        "credit": 0
      },
      {
        "ledgerId": "60c72b2f9b1d8a2c22222222",
        "debit": 0,
        "credit": 500
      }
    ]
  }' \
  https://pos-erp-backend.onrender.com/api/accounting/journal/draft
```

### `POST` /journal/post

**URL:** `https://pos-erp-backend.onrender.com/api/accounting/journal/post`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X POST \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2026-08-06",
    "remarks": "Adjusting ledger entry",
    "items": [
      {
        "ledgerId": "60c72b2f9b1d8a2c11111111",
        "debit": 500,
        "credit": 0
      },
      {
        "ledgerId": "60c72b2f9b1d8a2c22222222",
        "debit": 0,
        "credit": 500
      }
    ]
  }' \
  https://pos-erp-backend.onrender.com/api/accounting/journal/post
```

### `POST` /test-voucher

**URL:** `https://pos-erp-backend.onrender.com/api/accounting/test-voucher`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X POST \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "sampleKey": "value"
  }' \
  https://pos-erp-backend.onrender.com/api/accounting/test-voucher
```

### `POST` /repost/missing

**URL:** `https://pos-erp-backend.onrender.com/api/accounting/repost/missing`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X POST \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "sampleKey": "value"
  }' \
  https://pos-erp-backend.onrender.com/api/accounting/repost/missing
```

### `POST` /repost/missing/batch

**URL:** `https://pos-erp-backend.onrender.com/api/accounting/repost/missing/batch`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X POST \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "sampleKey": "value"
  }' \
  https://pos-erp-backend.onrender.com/api/accounting/repost/missing/batch
```

### `POST` /repost/sale/:saleId

**URL:** `https://pos-erp-backend.onrender.com/api/accounting/repost/sale/:saleId`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X POST \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "sampleKey": "value"
  }' \
  https://pos-erp-backend.onrender.com/api/accounting/repost/sale/:saleId
```

### `POST` /repost/purchase/:purchaseId

**URL:** `https://pos-erp-backend.onrender.com/api/accounting/repost/purchase/:purchaseId`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X POST \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "sampleKey": "value"
  }' \
  https://pos-erp-backend.onrender.com/api/accounting/repost/purchase/:purchaseId
```

### `POST` /repost/sale-return/:returnId

**URL:** `https://pos-erp-backend.onrender.com/api/accounting/repost/sale-return/:returnId`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X POST \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "sampleKey": "value"
  }' \
  https://pos-erp-backend.onrender.com/api/accounting/repost/sale-return/:returnId
```

### `POST` /repost/purchase-return/:returnId

**URL:** `https://pos-erp-backend.onrender.com/api/accounting/repost/purchase-return/:returnId`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X POST \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "sampleKey": "value"
  }' \
  https://pos-erp-backend.onrender.com/api/accounting/repost/purchase-return/:returnId
```

### `POST` /repost/expense/:expenseId

**URL:** `https://pos-erp-backend.onrender.com/api/accounting/repost/expense/:expenseId`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X POST \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "sampleKey": "value"
  }' \
  https://pos-erp-backend.onrender.com/api/accounting/repost/expense/:expenseId
```

### `POST` /repost/cash-bank-transaction/:transactionId

**URL:** `https://pos-erp-backend.onrender.com/api/accounting/repost/cash-bank-transaction/:transactionId`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X POST \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "sampleKey": "value"
  }' \
  https://pos-erp-backend.onrender.com/api/accounting/repost/cash-bank-transaction/:transactionId
```

### `POST` /repost/bank-transfer/:transferId

**URL:** `https://pos-erp-backend.onrender.com/api/accounting/repost/bank-transfer/:transferId`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X POST \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "sampleKey": "value"
  }' \
  https://pos-erp-backend.onrender.com/api/accounting/repost/bank-transfer/:transferId
```

### `GET` /trial-balance/basic

**URL:** `https://pos-erp-backend.onrender.com/api/accounting/trial-balance/basic`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/accounting/trial-balance/basic
```

### `GET` /reports/dashboard

**URL:** `https://pos-erp-backend.onrender.com/api/accounting/reports/dashboard`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/accounting/reports/dashboard
```

### `GET` /reports/trial-balance

**URL:** `https://pos-erp-backend.onrender.com/api/accounting/reports/trial-balance`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/accounting/reports/trial-balance
```

### `GET` /reports/profit-loss

**URL:** `https://pos-erp-backend.onrender.com/api/accounting/reports/profit-loss`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/accounting/reports/profit-loss
```

### `GET` /reports/balance-sheet

**URL:** `https://pos-erp-backend.onrender.com/api/accounting/reports/balance-sheet`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/accounting/reports/balance-sheet
```

### `GET` /reports/cash-book

**URL:** `https://pos-erp-backend.onrender.com/api/accounting/reports/cash-book`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/accounting/reports/cash-book
```

### `GET` /reports/bank-book

**URL:** `https://pos-erp-backend.onrender.com/api/accounting/reports/bank-book`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/accounting/reports/bank-book
```

### `GET` /reports/receivables

**URL:** `https://pos-erp-backend.onrender.com/api/accounting/reports/receivables`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/accounting/reports/receivables
```

### `GET` /reports/payables

**URL:** `https://pos-erp-backend.onrender.com/api/accounting/reports/payables`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/accounting/reports/payables
```

### `GET` /reports/ledger-summary

**URL:** `https://pos-erp-backend.onrender.com/api/accounting/reports/ledger-summary`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/accounting/reports/ledger-summary
```

### `GET` /reports/group-summary

**URL:** `https://pos-erp-backend.onrender.com/api/accounting/reports/group-summary`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/accounting/reports/group-summary
```

### `GET` /gst/summary

**URL:** `https://pos-erp-backend.onrender.com/api/accounting/gst/summary`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/accounting/gst/summary
```

### `GET` /gst/output

**URL:** `https://pos-erp-backend.onrender.com/api/accounting/gst/output`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/accounting/gst/output
```

### `GET` /gst/input

**URL:** `https://pos-erp-backend.onrender.com/api/accounting/gst/input`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/accounting/gst/input
```

### `GET` /gst/payable-summary

**URL:** `https://pos-erp-backend.onrender.com/api/accounting/gst/payable-summary`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/accounting/gst/payable-summary
```

### `GET` /gst/hsn-summary

**URL:** `https://pos-erp-backend.onrender.com/api/accounting/gst/hsn-summary`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/accounting/gst/hsn-summary
```

### `GET` /gst/gstr1

**URL:** `https://pos-erp-backend.onrender.com/api/accounting/gst/gstr1`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/accounting/gst/gstr1
```

### `GET` /gst/gstr3b-summary

**URL:** `https://pos-erp-backend.onrender.com/api/accounting/gst/gstr3b-summary`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/accounting/gst/gstr3b-summary
```

### `GET` /gst/ledger

**URL:** `https://pos-erp-backend.onrender.com/api/accounting/gst/ledger`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/accounting/gst/ledger
```

### `GET` /gst/party-wise

**URL:** `https://pos-erp-backend.onrender.com/api/accounting/gst/party-wise`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/accounting/gst/party-wise
```

### `GET` /gst/exceptions

**URL:** `https://pos-erp-backend.onrender.com/api/accounting/gst/exceptions`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/accounting/gst/exceptions
```

### `GET` /gst/debug

**URL:** `https://pos-erp-backend.onrender.com/api/accounting/gst/debug`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/accounting/gst/debug
```

### `GET` /reconciliation/ledgers

**URL:** `https://pos-erp-backend.onrender.com/api/accounting/reconciliation/ledgers`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/accounting/reconciliation/ledgers
```

### `POST` /reconciliation/ledgers/fix

**URL:** `https://pos-erp-backend.onrender.com/api/accounting/reconciliation/ledgers/fix`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X POST \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "sampleKey": "value"
  }' \
  https://pos-erp-backend.onrender.com/api/accounting/reconciliation/ledgers/fix
```

### `GET` /reconciliation/cash-bank

**URL:** `https://pos-erp-backend.onrender.com/api/accounting/reconciliation/cash-bank`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/accounting/reconciliation/cash-bank
```

### `GET` /reconciliation/cash-bank/details

**URL:** `https://pos-erp-backend.onrender.com/api/accounting/reconciliation/cash-bank/details`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/accounting/reconciliation/cash-bank/details
```

### `POST` /reconciliation/cash-bank/link-ledgers

**URL:** `https://pos-erp-backend.onrender.com/api/accounting/reconciliation/cash-bank/link-ledgers`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X POST \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "sampleKey": "value"
  }' \
  https://pos-erp-backend.onrender.com/api/accounting/reconciliation/cash-bank/link-ledgers
```

### `POST` /reconciliation/parties/link-ledgers

**URL:** `https://pos-erp-backend.onrender.com/api/accounting/reconciliation/parties/link-ledgers`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X POST \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "sampleKey": "value"
  }' \
  https://pos-erp-backend.onrender.com/api/accounting/reconciliation/parties/link-ledgers
```

### `POST` /opening-balances/post-all

**URL:** `https://pos-erp-backend.onrender.com/api/accounting/opening-balances/post-all`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X POST \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "sampleKey": "value"
  }' \
  https://pos-erp-backend.onrender.com/api/accounting/opening-balances/post-all
```

### `POST` /opening-balances/cash-bank/post-all

**URL:** `https://pos-erp-backend.onrender.com/api/accounting/opening-balances/cash-bank/post-all`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X POST \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "sampleKey": "value"
  }' \
  https://pos-erp-backend.onrender.com/api/accounting/opening-balances/cash-bank/post-all
```

### `POST` /opening-balances/cash-bank/:accountId/post

**URL:** `https://pos-erp-backend.onrender.com/api/accounting/opening-balances/cash-bank/:accountId/post`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X POST \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "sampleKey": "value"
  }' \
  https://pos-erp-backend.onrender.com/api/accounting/opening-balances/cash-bank/:accountId/post
```

### `GET` /reconciliation/parties

**URL:** `https://pos-erp-backend.onrender.com/api/accounting/reconciliation/parties`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/accounting/reconciliation/parties
```

### `GET` /reconciliation/gst

**URL:** `https://pos-erp-backend.onrender.com/api/accounting/reconciliation/gst`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/accounting/reconciliation/gst
```

### `GET` /groups

**URL:** `https://pos-erp-backend.onrender.com/api/accounting/groups`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/accounting/groups
```

### `POST` /groups

**URL:** `https://pos-erp-backend.onrender.com/api/accounting/groups`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X POST \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "sampleKey": "value"
  }' \
  https://pos-erp-backend.onrender.com/api/accounting/groups
```

### `GET` /groups/:id

**URL:** `https://pos-erp-backend.onrender.com/api/accounting/groups/:id`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/accounting/groups/:id
```

### `PUT` /groups/:id

**URL:** `https://pos-erp-backend.onrender.com/api/accounting/groups/:id`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X PUT \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "sampleKey": "value"
  }' \
  https://pos-erp-backend.onrender.com/api/accounting/groups/:id
```

### `DELETE` /groups/:id

**URL:** `https://pos-erp-backend.onrender.com/api/accounting/groups/:id`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X DELETE \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/accounting/groups/:id
```

### `GET` /ledgers/code/:code

**URL:** `https://pos-erp-backend.onrender.com/api/accounting/ledgers/code/:code`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/accounting/ledgers/code/:code
```

### `GET` /ledgers/group/:groupId

**URL:** `https://pos-erp-backend.onrender.com/api/accounting/ledgers/group/:groupId`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/accounting/ledgers/group/:groupId
```

### `GET` /ledgers/system/:ledgerType

**URL:** `https://pos-erp-backend.onrender.com/api/accounting/ledgers/system/:ledgerType`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/accounting/ledgers/system/:ledgerType
```

### `GET` /ledgers/defaults

**URL:** `https://pos-erp-backend.onrender.com/api/accounting/ledgers/defaults`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/accounting/ledgers/defaults
```

### `POST` /ledgers/restore-defaults

**URL:** `https://pos-erp-backend.onrender.com/api/accounting/ledgers/restore-defaults`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X POST \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "sampleKey": "value"
  }' \
  https://pos-erp-backend.onrender.com/api/accounting/ledgers/restore-defaults
```

### `GET` /ledgers/:id/balance

**URL:** `https://pos-erp-backend.onrender.com/api/accounting/ledgers/:id/balance`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/accounting/ledgers/:id/balance
```

### `GET` /ledgers/:id/statement

**URL:** `https://pos-erp-backend.onrender.com/api/accounting/ledgers/:id/statement`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/accounting/ledgers/:id/statement
```

### `GET` /ledgers

**URL:** `https://pos-erp-backend.onrender.com/api/accounting/ledgers`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/accounting/ledgers
```

### `POST` /ledgers

**URL:** `https://pos-erp-backend.onrender.com/api/accounting/ledgers`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X POST \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "sampleKey": "value"
  }' \
  https://pos-erp-backend.onrender.com/api/accounting/ledgers
```

### `GET` /ledgers/:id

**URL:** `https://pos-erp-backend.onrender.com/api/accounting/ledgers/:id`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/accounting/ledgers/:id
```

### `PUT` /ledgers/:id

**URL:** `https://pos-erp-backend.onrender.com/api/accounting/ledgers/:id`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X PUT \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "sampleKey": "value"
  }' \
  https://pos-erp-backend.onrender.com/api/accounting/ledgers/:id
```

### `DELETE` /ledgers/:id

**URL:** `https://pos-erp-backend.onrender.com/api/accounting/ledgers/:id`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X DELETE \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/accounting/ledgers/:id
```

### `GET` /voucher-types

**URL:** `https://pos-erp-backend.onrender.com/api/accounting/voucher-types`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/accounting/voucher-types
```

### `POST` /voucher-types

**URL:** `https://pos-erp-backend.onrender.com/api/accounting/voucher-types`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X POST \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "sampleKey": "value"
  }' \
  https://pos-erp-backend.onrender.com/api/accounting/voucher-types
```

### `GET` /voucher-types/:id

**URL:** `https://pos-erp-backend.onrender.com/api/accounting/voucher-types/:id`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/accounting/voucher-types/:id
```

### `PUT` /voucher-types/:id

**URL:** `https://pos-erp-backend.onrender.com/api/accounting/voucher-types/:id`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X PUT \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "sampleKey": "value"
  }' \
  https://pos-erp-backend.onrender.com/api/accounting/voucher-types/:id
```

### `DELETE` /voucher-types/:id

**URL:** `https://pos-erp-backend.onrender.com/api/accounting/voucher-types/:id`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X DELETE \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/accounting/voucher-types/:id
```

### `GET` /vouchers

**URL:** `https://pos-erp-backend.onrender.com/api/accounting/vouchers`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/accounting/vouchers
```

### `POST` /vouchers/draft

**URL:** `https://pos-erp-backend.onrender.com/api/accounting/vouchers/draft`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X POST \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "sampleKey": "value"
  }' \
  https://pos-erp-backend.onrender.com/api/accounting/vouchers/draft
```

### `POST` /vouchers/post

**URL:** `https://pos-erp-backend.onrender.com/api/accounting/vouchers/post`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X POST \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "sampleKey": "value"
  }' \
  https://pos-erp-backend.onrender.com/api/accounting/vouchers/post
```

### `POST` /vouchers

**URL:** `https://pos-erp-backend.onrender.com/api/accounting/vouchers`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X POST \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "sampleKey": "value"
  }' \
  https://pos-erp-backend.onrender.com/api/accounting/vouchers
```

### `POST` /vouchers/:id/post

**URL:** `https://pos-erp-backend.onrender.com/api/accounting/vouchers/:id/post`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X POST \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "sampleKey": "value"
  }' \
  https://pos-erp-backend.onrender.com/api/accounting/vouchers/:id/post
```

### `POST` /vouchers/:id/cancel

**URL:** `https://pos-erp-backend.onrender.com/api/accounting/vouchers/:id/cancel`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X POST \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "sampleKey": "value"
  }' \
  https://pos-erp-backend.onrender.com/api/accounting/vouchers/:id/cancel
```

### `POST` /vouchers/:id/reverse

**URL:** `https://pos-erp-backend.onrender.com/api/accounting/vouchers/:id/reverse`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X POST \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "sampleKey": "value"
  }' \
  https://pos-erp-backend.onrender.com/api/accounting/vouchers/:id/reverse
```

### `GET` /vouchers/:id

**URL:** `https://pos-erp-backend.onrender.com/api/accounting/vouchers/:id`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/accounting/vouchers/:id
```

### `DELETE` /vouchers/:id

**URL:** `https://pos-erp-backend.onrender.com/api/accounting/vouchers/:id`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X DELETE \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/accounting/vouchers/:id
```

### `GET` /settings

**URL:** `https://pos-erp-backend.onrender.com/api/accounting/settings`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/accounting/settings
```

### `PUT` /settings

**URL:** `https://pos-erp-backend.onrender.com/api/accounting/settings`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X PUT \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "sampleKey": "value"
  }' \
  https://pos-erp-backend.onrender.com/api/accounting/settings
```

### `GET` /settings/validate

**URL:** `https://pos-erp-backend.onrender.com/api/accounting/settings/validate`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/accounting/settings/validate
```

### `POST` /bank-statement/import

**URL:** `https://pos-erp-backend.onrender.com/api/accounting/bank-statement/import`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X POST \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "sampleKey": "value"
  }' \
  https://pos-erp-backend.onrender.com/api/accounting/bank-statement/import
```

### `POST` /bank-statement/save

**URL:** `https://pos-erp-backend.onrender.com/api/accounting/bank-statement/save`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X POST \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "sampleKey": "value"
  }' \
  https://pos-erp-backend.onrender.com/api/accounting/bank-statement/save
```

### `POST` /bank-statement/:id/post-entries

**URL:** `https://pos-erp-backend.onrender.com/api/accounting/bank-statement/:id/post-entries`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X POST \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "sampleKey": "value"
  }' \
  https://pos-erp-backend.onrender.com/api/accounting/bank-statement/:id/post-entries
```

### `GET` /bank-statement/history

**URL:** `https://pos-erp-backend.onrender.com/api/accounting/bank-statement/history`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/accounting/bank-statement/history
```

### `GET` /bank-statement/settings

**URL:** `https://pos-erp-backend.onrender.com/api/accounting/bank-statement/settings`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/accounting/bank-statement/settings
```

### `GET` /bank-statement/mappings

**URL:** `https://pos-erp-backend.onrender.com/api/accounting/bank-statement/mappings`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/accounting/bank-statement/mappings
```

### `POST` /bank-statement/mappings

**URL:** `https://pos-erp-backend.onrender.com/api/accounting/bank-statement/mappings`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X POST \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "sampleKey": "value"
  }' \
  https://pos-erp-backend.onrender.com/api/accounting/bank-statement/mappings
```

### `PUT` /bank-statement/mappings/:id

**URL:** `https://pos-erp-backend.onrender.com/api/accounting/bank-statement/mappings/:id`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X PUT \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "sampleKey": "value"
  }' \
  https://pos-erp-backend.onrender.com/api/accounting/bank-statement/mappings/:id
```

### `DELETE` /bank-statement/mappings/:id

**URL:** `https://pos-erp-backend.onrender.com/api/accounting/bank-statement/mappings/:id`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X DELETE \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/accounting/bank-statement/mappings/:id
```

### `GET` /bank-statement/:id

**URL:** `https://pos-erp-backend.onrender.com/api/accounting/bank-statement/:id`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/accounting/bank-statement/:id
```


---

## System Notifications APIs
**Base Mount Path:** `/api/notifications`

### `GET` 

**URL:** `https://pos-erp-backend.onrender.com/api/notifications`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/notifications
```

### `GET` /unread-count

**URL:** `https://pos-erp-backend.onrender.com/api/notifications/unread-count`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X GET \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/notifications/unread-count
```

### `PUT` /read-all

**URL:** `https://pos-erp-backend.onrender.com/api/notifications/read-all`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X PUT \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "sampleKey": "value"
  }' \
  https://pos-erp-backend.onrender.com/api/notifications/read-all
```

### `PUT` /:id/read

**URL:** `https://pos-erp-backend.onrender.com/api/notifications/:id/read`

**Headers:**
- `Authorization: Bearer <TOKEN>`
- `Content-Type: application/json`

**cURL Command:**
```bash
curl -X PUT \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "sampleKey": "value"
  }' \
  https://pos-erp-backend.onrender.com/api/notifications/:id/read
```

### `DELETE` /:id

**URL:** `https://pos-erp-backend.onrender.com/api/notifications/:id`

**Headers:**
- `Authorization: Bearer <TOKEN>`

**cURL Command:**
```bash
curl -X DELETE \
  -H "Authorization: Bearer <TOKEN>" \
  https://pos-erp-backend.onrender.com/api/notifications/:id
```


---

