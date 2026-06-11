# Advanced Inventory Management API

## Overview

The Advanced Inventory Management API provides intelligent inventory optimization, supplier evaluation, and part substitution capabilities for marine fleet operations.

**Base URL**: `/api/inventory`

**Authentication**: All endpoints require `x-org-id` header for multi-tenant isolation.

---

## Endpoints

### 1. Part Substitutions

Find approved substitutes for unavailable or critical parts.

**Endpoint**: `GET /api/inventory/substitutions/:partNo`

**Parameters**:

- `partNo` (path, required): Part number to find substitutes for

**Response**: Array of substitute parts with availability and pricing

```json
[
  {
    "partNo": "PUMP-101",
    "name": "Hydraulic Pump Type B",
    "substitutionType": "equivalent",
    "stockStatus": "critical",
    "quantityAvailable": 2,
    "priceDifference": 50.0,
    "priceImpact": "higher",
    "primarySupplier": {
      "id": "uuid",
      "name": "Marine Parts Inc",
      "leadTimeDays": 7
    }
  }
]
```

**Use Cases**:

- Emergency part replacement during vessel downtime
- Cost optimization by finding cheaper equivalents
- Supply chain risk mitigation

---

### 2. Inventory Optimization

Calculate optimal order quantities and reorder points using Economic Order Quantity (EOQ) model.

**Endpoint**: `POST /api/inventory/optimize`

**Request Body**:

```json
{
  "partNumbers": ["PUMP-100", "FILTER-500"],
  "usageHistory": {
    "PUMP-100": [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
    "FILTER-500": [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10]
  },
  "costs": {
    "PUMP-100": {
      "orderingCost": 50,
      "holdingCostRate": 0.2
    },
    "FILTER-500": {
      "orderingCost": 25,
      "holdingCostRate": 0.15
    }
  },
  "currentStock": {
    "PUMP-100": 3,
    "FILTER-500": 15
  }
}
```

**Response**:

```json
[
  {
    "partNo": "PUMP-100",
    "currentStock": 3,
    "averageUsagePerMonth": 2,
    "economicOrderQuantity": 4,
    "reorderPoint": 2,
    "recommendation": "increase",
    "potentialSavings": 64.0,
    "rationale": "Current stock below optimal level"
  }
]
```

**EOQ Calculation**:

```
EOQ = √((2 × Annual Demand × Ordering Cost) / Holding Cost)
ROP = (Average Daily Usage × Lead Time) + Safety Stock
```

---

### 3. Supplier Performance Evaluation

Evaluate suppliers based on delivery performance, quality, and reliability.

**Endpoint**: `POST /api/inventory/suppliers/performance`

**Request Body**:

```json
{
  "supplierIds": ["uuid1", "uuid2"],
  "deliveryHistory": [
    {
      "supplierId": "uuid1",
      "partNo": "PUMP-100",
      "orderDate": "2024-10-01",
      "expectedDeliveryDate": "2024-10-15",
      "deliveryDate": "2024-10-14",
      "quantityOrdered": 5,
      "quantityDelivered": 5,
      "qualityIssues": 0
    }
  ]
}
```

**Response**:

```json
[
  {
    "supplierId": "uuid1",
    "name": "Marine Parts Inc",
    "performanceScore": 95.5,
    "status": "active",
    "totalOrders": 1,
    "onTimeRate": 100,
    "qualityRate": 100,
    "averageLeadTime": 14
  }
]
```

**Performance Score Calculation**:

```
Score = (On-Time Rate × 0.4) + (Quality Rate × 0.4) + (Lead Time Score × 0.2)
```

---

### 4. Parts Availability Check

Batch check stock availability for multiple parts.

**Endpoint**: `POST /api/parts/availability`

**Request Body**:

```json
{
  "partNumbers": ["PUMP-100", "FILTER-500", "BEARING-200"]
}
```

**Response**:

```json
[
  {
    "partNo": "PUMP-100",
    "available": true,
    "totalQuantity": 5,
    "status": "adequate",
    "locations": [
      {
        "warehouseId": "WH-001",
        "quantity": 3,
        "reservedQuantity": 1
      }
    ]
  }
]
```

---

### 5. Maintenance Cost Planning

Calculate total costs for maintenance jobs including substitution opportunities.

**Endpoint**: `POST /api/inventory/cost-planning`

**Request Body**:

```json
{
  "jobs": [
    {
      "jobId": "JOB-001",
      "parts": [
        { "partNo": "PUMP-100", "quantity": 2 },
        { "partNo": "FILTER-500", "quantity": 5 }
      ]
    }
  ],
  "includeSubstitutes": true,
  "laborRatePerHour": 85
}
```

**Response**:

```json
[
  {
    "jobId": "JOB-001",
    "totalCost": 1250.0,
    "partsCost": 850.0,
    "laborCost": 400.0,
    "breakdown": [
      {
        "partNo": "PUMP-100",
        "quantity": 2,
        "unitCost": 200.0,
        "subtotal": 400.0,
        "substituteAvailable": true,
        "substituteSavings": 100.0
      }
    ]
  }
]
```

---

## Error Handling

All endpoints return consistent error responses:

```json
{
  "error": "Error message here",
  "code": "ERROR_CODE",
  "details": {
    "field": "Additional context"
  }
}
```

**Common Error Codes**:

- `VALIDATION_ERROR` (400): Invalid request data
- `NOT_FOUND` (404): Resource not found
- `INTERNAL_ERROR` (500): Server error

---

## Rate Limiting

- **Rate Limit**: 100 requests per minute per organization
- **Burst Limit**: 20 requests per second

Headers returned:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1699564800
```

---

## Performance Considerations

**Caching**:

- Part substitutions: 15-minute cache TTL
- Supplier data: 5-minute cache TTL
- Inventory levels: Real-time (no cache)

**Batch Limits**:

- Parts availability: Max 100 parts per request
- Optimization: Max 50 parts per request
- Supplier evaluation: Max 20 suppliers per request

---

## Examples

### Example 1: Emergency Part Replacement

```bash
# Find substitutes for critical pump failure
curl -X GET \
  -H "x-org-id: my-org-id" \
  https://api.arus.com/api/inventory/substitutions/PUMP-100
```

### Example 2: Monthly Inventory Review

```bash
# Optimize inventory levels based on 12-month usage
curl -X POST \
  -H "x-org-id: my-org-id" \
  -H "Content-Type: application/json" \
  -d '{
    "partNumbers": ["PUMP-100", "FILTER-500"],
    "usageHistory": {...},
    "costs": {...},
    "currentStock": {...}
  }' \
  https://api.arus.com/api/inventory/optimize
```

### Example 3: Quarterly Supplier Review

```bash
# Evaluate supplier performance for contract renewal
curl -X POST \
  -H "x-org-id: my-org-id" \
  -H "Content-Type: application/json" \
  -d '{
    "supplierIds": ["uuid1", "uuid2"],
    "deliveryHistory": [...]
  }' \
  https://api.arus.com/api/inventory/suppliers/performance
```

---

## Changelog

### Version 1.0.0 (2025-11-06)

- Initial release with 5 core endpoints
- EOQ-based inventory optimization
- Multi-supplier performance evaluation
- Intelligent part substitution
- Batch availability checks
- Maintenance cost planning

---

## Support

For API issues or feature requests:

- GitHub Issues: https://github.com/your-org/arus/issues
- Email: api-support@arus.com
- Documentation: https://docs.arus.com/api
