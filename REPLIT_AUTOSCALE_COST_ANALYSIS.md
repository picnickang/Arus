# ARUS on Replit Autoscale - Cost Analysis

**Date:** October 21, 2025  
**Deployment Type:** Autoscale (Pay-as-you-go)

---

## Replit Autoscaling Pricing Structure

### Base Costs

- **Base fee:** $1.00/month (flat)
- **Compute units:** $3.20 per million units
  - 1 CPU-second = 18 units
  - 1 GB-RAM-second = 2 units
- **Requests:** $1.20 per million requests

### Monthly Credits (Included)

- **Core Plan:** $25/month in credits
- **Teams Plan:** $40/month per user in credits

**Important:** You only pay overages AFTER your credits are used up. Unused credits don't roll over.

---

## ARUS Resource Profile

Based on the running application:

### CPU Usage

```
Idle state:                5-10% CPU (background jobs)
Serving API requests:      15-30% CPU
ML predictions (LSTM):     80-100% CPU (burst)
Model training:            100% CPU (sustained)
```

### Memory Usage

```
Base server:              60 MB
With routes loaded:       100 MB
Normal operations:        150-200 MB
With TensorFlow loaded:   400-600 MB
Peak (ML training):       800 MB - 1.2 GB
```

### Request Volume (Estimated)

```
Dashboard refreshes:      2-5 per minute per user
API calls:               10-20 per minute per user
WebSocket messages:       5-10 per minute per user
Background jobs:          ~1000 requests/day
```

---

## Cost Calculation Scenarios

### Scenario 1: Light Usage (1-2 Active Users, Testing/Demo)

**Monthly Activity:**

- Active hours: 8 hours/day × 30 days = 240 hours
- Average CPU: 0.2 vCPU
- Average RAM: 300 MB (0.3 GB)
- Requests: 50,000/month

**Compute Units:**

```
CPU units:
  240 hours × 3600 seconds × 0.2 CPU × 18 units/CPU-sec
  = 3,110,400 units

RAM units:
  240 hours × 3600 seconds × 0.3 GB × 2 units/GB-sec
  = 518,400 units

Total: 3,628,800 units
Cost: 3.63M units × ($3.20 / 1M) = $11.61
```

**Requests:**

```
50,000 requests × ($1.20 / 1M) = $0.06
```

**Total Monthly Cost:**

```
Base fee:        $1.00
Compute:        $11.61
Requests:        $0.06
─────────────────────────
Subtotal:       $12.67
Credits (Core): -$25.00
─────────────────────────
ACTUAL COST:     $0.00 (fully covered by credits)
```

✅ **With Core Plan ($20/month), you have $12.33 in unused credits**

---

### Scenario 2: Medium Usage (5-10 Users, Small Fleet)

**Monthly Activity:**

- Active hours: 16 hours/day × 30 days = 480 hours
- Average CPU: 0.4 vCPU (more background processing)
- Average RAM: 450 MB (0.45 GB)
- Requests: 200,000/month
- ML predictions: 500/month

**Compute Units:**

```
CPU units:
  480 hours × 3600 seconds × 0.4 CPU × 18 units/CPU-sec
  = 12,441,600 units

RAM units:
  480 hours × 3600 seconds × 0.45 GB × 2 units/GB-sec
  = 1,555,200 units

Total: 13,996,800 units
Cost: 14M units × ($3.20 / 1M) = $44.79
```

**Requests:**

```
200,000 requests × ($1.20 / 1M) = $0.24
```

**Total Monthly Cost:**

```
Base fee:        $1.00
Compute:        $44.79
Requests:        $0.24
─────────────────────────
Subtotal:       $46.03
Credits (Core): -$25.00
─────────────────────────
ACTUAL COST:    $21.03
```

💰 **Total with Core Plan: $20 (subscription) + $21.03 (overage) = $41.03/month**

---

### Scenario 3: Heavy Usage (20+ Users, Production Fleet)

**Monthly Activity:**

- Active 24/7: 720 hours/month
- Average CPU: 0.6 vCPU (continuous operations)
- Average RAM: 600 MB (0.6 GB)
- Requests: 1,000,000/month
- ML predictions: 5,000/month

**Compute Units:**

```
CPU units:
  720 hours × 3600 seconds × 0.6 CPU × 18 units/CPU-sec
  = 27,993,600 units

RAM units:
  720 hours × 3600 seconds × 0.6 GB × 2 units/GB-sec
  = 3,110,400 units

Total: 31,104,000 units
Cost: 31.1M units × ($3.20 / 1M) = $99.53
```

**Requests:**

```
1,000,000 requests × ($1.20 / 1M) = $1.20
```

**Total Monthly Cost:**

```
Base fee:         $1.00
Compute:         $99.53
Requests:         $1.20
─────────────────────────
Subtotal:       $101.73
Credits (Core):  -$25.00
─────────────────────────
ACTUAL COST:     $76.73
```

💰 **Total with Core Plan: $20 (subscription) + $76.73 (overage) = $96.73/month**

⚠️ **Note:** At this usage level, a Reserved VM is more cost-effective!

---

## Cost Comparison: Autoscale vs Reserved VM

| Deployment Type            | Monthly Cost | When to Use                     |
| -------------------------- | ------------ | ------------------------------- |
| **Autoscale (Light)**      | $0-5         | Testing, demos, 1-2 users       |
| **Autoscale (Medium)**     | $20-45       | Small teams, variable load      |
| **Autoscale (Heavy)**      | $75-100+     | High activity - NOT recommended |
| **Reserved VM (0.5 vCPU)** | $20          | Predictable, light-medium load  |
| **Reserved VM (1 vCPU)**   | $40          | Better for 24/7 production      |
| **Reserved VM (2 vCPU)**   | $80          | Heavy ML workloads              |

---

## Recommendations by Use Case

### 🎯 Demo/Portfolio (1-2 users, occasional use)

**Recommendation:** Autoscale

- **Cost:** $0/month (covered by Core Plan credits)
- **Why:** Only pay for what you use, likely under $25/month
- **Setup:** Default autoscale deployment

### 🏢 Small Fleet (5-10 vessels, 5-10 users)

**Recommendation:** Reserved VM 0.5 vCPU

- **Cost:** $20/month (flat)
- **Why:** More predictable than autoscale, better performance
- **Setup:** Deploy with Reserved VM option

### 🚢 Medium Fleet (20-50 vessels, 20+ users)

**Recommendation:** Reserved VM 1 vCPU

- **Cost:** $40/month (flat)
- **Why:** Guaranteed resources, faster ML predictions
- **Setup:** Reserved VM 1 vCPU / 4GB RAM

### 🌊 Large Fleet (50+ vessels, enterprise)

**Recommendation:** Reserved VM 2 vCPU or higher

- **Cost:** $80-160/month
- **Why:** ML features need sustained CPU/RAM
- **Setup:** Reserved VM 2 vCPU / 8GB RAM minimum

---

## Key Insights

### ✅ Autoscale is Perfect For:

- Development and testing
- Variable/unpredictable workload
- Low-usage demos
- Cost optimization when under $40/month usage

### ❌ Autoscale NOT Ideal For:

- 24/7 production with background jobs (costs add up)
- Heavy ML workloads (better on Reserved VM)
- Predictable high usage (Reserved VM cheaper)

### 🎯 Sweet Spot:

**For ARUS specifically:**

- If usage stays under $25/month → Autoscale (free with Core Plan)
- If usage is $25-40/month → Consider Reserved VM 0.5 vCPU ($20)
- If usage exceeds $40/month → Reserved VM 1 vCPU ($40) is better value

---

## Real-World Estimate for ARUS

### Typical Production Usage (10-15 users, 15-20 vessels):

**Expected Pattern:**

- Active 12 hours/day (business hours)
- Background jobs running 24/7
- ML predictions: ~100/day
- Average RAM: 400 MB

**Estimated Cost:**

```
Base:            $1.00
Compute:        ~$35.00
Requests:        $0.15
─────────────────────────
Subtotal:       $36.15
Core credits:   -$25.00
─────────────────────────
Monthly cost:   $11.15
```

💰 **Total: $20 (Core) + $11.15 (overage) = $31.15/month**

**Better Option:** Reserved VM 0.5 vCPU = $20/month (saves $11/month)

---

## Database Costs (Additional)

Replit PostgreSQL pricing is separate:

| Database Plan | Storage | Price         | Good For     |
| ------------- | ------- | ------------- | ------------ |
| **Free**      | 1 GB    | $0            | Testing only |
| **Starter**   | 10 GB   | ~$7-10/month  | Small fleets |
| **Pro**       | 50+ GB  | ~$15-30/month | Production   |

**ARUS Database Size:** ~500 MB - 5 GB depending on telemetry retention

**Recommendation:** Starter plan ($7-10/month) for production

---

## Total Cost of Ownership (Monthly)

### Budget Option (Demo/Testing)

```
Autoscale:       $0 (covered by Core credits)
Database:        $0 (free tier)
Core Plan:      $20
─────────────────────────
TOTAL:          $20/month
```

### Production Option (Small Fleet)

```
Reserved VM:    $20 (0.5 vCPU)
Database:        $7 (Starter)
Core Plan:      $20
─────────────────────────
TOTAL:          $47/month
```

### Production Option (Medium Fleet)

```
Reserved VM:    $40 (1 vCPU)
Database:       $10 (Starter/Pro)
Core Plan:      $20
─────────────────────────
TOTAL:          $70/month
```

---

## Comparison with Other Platforms

| Platform             | Monthly Cost       | Pros                       | Cons            |
| -------------------- | ------------------ | -------------------------- | --------------- |
| **Replit Autoscale** | $20-50             | Scales to zero, integrated | Variable costs  |
| **Replit Reserved**  | $40-80             | Predictable, faster        | Fixed capacity  |
| **Render Standard**  | $32 + DB $7 = $39  | Always-on, reliable        | Slower CPU      |
| **Railway**          | $15-30             | Good value                 | Less integrated |
| **DigitalOcean**     | $12 + DB $15 = $27 | Cheap, stable              | Manual setup    |

---

## My Recommendation for ARUS

### 🎯 Best Choice: **Reserved VM 0.5 vCPU ($20/month)**

**Why:**

1. ✅ Flat, predictable cost ($20 + database)
2. ✅ Better than autoscale for 24/7 background jobs
3. ✅ Covers Core Plan cost (break even)
4. ✅ No surprise bills
5. ✅ Sufficient for 5-15 users

**When to upgrade to 1 vCPU ($40/month):**

- More than 15 concurrent users
- Heavy ML prediction usage (>200/day)
- Need faster response times

**When autoscale makes sense:**

- Pure development/testing
- Highly variable usage (weekends off, etc.)
- Want to test before committing to Reserved VM

---

## How to Deploy

### Option 1: Autoscale (Start Here)

```bash
# Already configured! Just deploy your Replit
# Monitor usage in Replit dashboard
# Switch to Reserved if costs exceed $20/month
```

### Option 2: Reserved VM

```bash
# In Replit deployment settings:
1. Choose "Reserved VM"
2. Select "0.5 vCPU / 2GB RAM" ($20/month)
3. Deploy
```

---

## Bottom Line

**For ARUS:**

- 🟢 **Start with Autoscale** - likely free under Core Plan credits
- 📊 **Monitor for 1 month** - see actual usage
- 🔄 **Switch to Reserved 0.5 vCPU** - if usage exceeds $15-20/month
- 📈 **Upgrade to 1 vCPU** - if you need better ML performance

**Expected real-world cost: $20-50/month total** (including database)

Much better than Render ($32-65) and easier than DigitalOcean/Railway!
