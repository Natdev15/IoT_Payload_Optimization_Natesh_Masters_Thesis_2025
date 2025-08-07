# Outbound Queue Configuration

The Node.js receiver now supports **automatic forwarding** of processed container data to an external M2M endpoint.

## Environment Variables

### Required
- **`OUTBOUND_URL`** - Target endpoint URL for forwarding data
  - If not set, outbound forwarding is **disabled**
  - Example: `http://your-m2m-endpoint.com/api/data`

### Optional
- **`PORT`** - Server port (default: 3000)
- **`OUTBOUND_RETRY_INTERVAL`** - Retry interval in ms (default: 5000)
- **`MAX_RETRY_ATTEMPTS`** - Max retry attempts (default: 10)

## Usage Examples

### Docker Compose
```yaml
environment:
  - OUTBOUND_URL=http://your-iot-platform.com/api/container-data
  - PORT=3000
```

### Docker Run
```bash
docker run -e OUTBOUND_URL=http://localhost:8080/m2m/data container-receiver
```

### Local Development
```bash
export OUTBOUND_URL=https://webhook.site/your-unique-id
npm start
```

## M2M Format

Data is sent in the same format as your http-client.js:

```javascript
{
  "m2m:cin": {
    "con": {
      "msisdn": "393600504805",
      "iso6346": "LMCU1231237",
      "time": "200423 002940.0",
      // ... all container fields
    }
  }
}
```

### Headers
- `Content-Type: application/json;ty=4`
- `X-M2M-RI: 2024-01-15T10:30:45.123Z`
- `X-M2M-ORIGIN: Natesh`

## Retry Logic

- **Success**: 201 status code → data marked as sent
- **Failure**: Exponential backoff (5s → 10s → 20s → 40s → 60s max)
- **Max attempts**: 10 attempts then give up
- **Queue persistence**: Failed items remain in queue until success or max attempts

## Monitoring

### Health Check - `GET /health`
```json
{
  "status": "healthy",
  "inbound": { "processed": 1500, "errors": 0, "queueSize": 2 },
  "outbound": { "queueSize": 0, "totalSent": 1498, "totalErrors": 2, "enabled": true }
}
```

### Statistics - `GET /stats`
```json
{
  "inbound": { "processed": 1500, "ratePerSecond": 45.2 },
  "outbound": { 
    "queueSize": 0, 
    "totalSent": 1498, 
    "totalErrors": 2,
    "ratePerSecond": 44.8,
    "enabled": true,
    "targetUrl": "http://your-endpoint.com/api/data"
  }
}
``` 