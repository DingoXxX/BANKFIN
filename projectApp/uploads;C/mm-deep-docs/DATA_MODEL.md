
# Data Model Overview (Cosmos‑DB Containers)

## payments (partitionKey: `/userId`)
```json
{
  "id": "pay_9ab2",
  "userId": "user-123",
  "recipientId": "user-456",
  "amount": 20.00,
  "note": "Lunch",
  "status": "SETTLED",
  "createdAt": 1715100000
}
```

## portfolio
Tracks positions.

PK `/userId`

## points
Ledger of Spark Points (append‑only).

### Example
```json
{
  "id": "pts_11",
  "userId": "user-123",
  "event": "invest_complete",
  "points": 15,
  "ts": 1715100300
}
```

## groups
Group investing metadata.

## challenges
Challenge definitions (admin only).
