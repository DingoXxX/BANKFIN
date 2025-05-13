
# Money Moves API Specification (v0.1)

## Authentication
All endpoints require a Bearer JWT in the `Authorization` header.
`Authorization: Bearer <token>`

The token must include scopes listed next to each endpoint.

### Common Error Shape
```json
{ "error": { "code": "STRING", "message": "Human‑readable" } }
```

| HTTP | Code | Meaning |
|------|------|---------|
| 400 | `INVALID_REQUEST` |
| 401 | `UNAUTHENTICATED` |
| 403 | `FORBIDDEN` |
| 404 | `NOT_FOUND` |
| 429 | `RATE_LIMIT` |
| 500 | `INTERNAL` |

---

## 1. Payments Service (`payments‑svc`)

### POST /payments/send
*Scope:* `payments:write`

Send cash P2P.

```http
POST /payments/send
Content-Type: application/json
x-idempotency-key: <uuid>

{
  "amount": 20.00,
  "recipientId": "user-456",
  "note": "Lunch"
}
```

#### Response `201 Created`
```json
{ "txId": "pay_9ab2", "status": "PENDING" }
```

### GET /payments/{txId}
*Scope:* `payments:read`

Returns full transaction.

---

## 2. Invest Service (`invest‑svc`)

### GET /investments/home
*Scope:* `invest:read`
Returns personalized list.

Query params: `risk=Balanced`

#### Sample
```json
{
  "portfolios": [
    { "id": "bal-01", "name": "Core Balanced", "1yrReturn": 0.058 }
  ]
}
```

### POST /investments/allocate
*Scope:* `invest:write`

```json
{
  "portfolioId": "bal-01",
  "amount": 50.0,
  "fundingSrc": "wallet"
}
```

Returns orderRef, ticket bonus emitted async.

---

## 3. Rewards Service (`rewards‑svc`)

### POST /rewards/earn
Internal event endpoint.

### GET /rewards/points
*Scope*: `rewards:read`

```json
{ "points": 6045, "tier": "Silver" }
```

### GET /rewards/tickets
Returns tickets and draw ETA.

---

## 4. Community Service (`community‑svc`)

### GET /tips
Public educational feed (no auth needed).

### POST /groups
Create group investing squad.

```json
{ "name": "Moon Squad", "goal": 5000 }
```

Returns `groupId`.

### Webhooks

* `/webhooks/plaid`
* `/webhooks/drivewealth`
* `/webhooks/circle`

Each validates HMAC signature.

---
