# 🏗️ System Architecture Documentation

## 📋 Table of Contents

1. [System Overview](#system-overview)
2. [System Diagram](#system-diagram)
3. [OSI Model Layer Breakdown](#osi-model-layer-breakdown)
4. [Sequence Diagrams](#sequence-diagrams)
5. [Design Decisions & Trade-offs](#design-decisions--trade-offs)
6. [Why Specific Patterns](#why-specific-patterns)

---

## 🎯 System Overview

### **Architecture Pattern: Stateful In-Memory Aggregation with Batch Persistence**

This system implements a **real-time analytics platform** using:
- **HTTP/2** for efficient metric ingestion
- **SSE (Server-Sent Events)** for real-time dashboard updates
- **Stateful in-memory aggregation** for ultra-low latency
- **MySQL** for durable storage with batch writes

---

## 🗺️ System Diagram



### **Component Details**

```
┌──────────────────────────────────────────────────────────┐
│                   HTTP/2 Server Layer                     │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  ┌──────────────┐    ┌──────────────┐                   │
│  │HTTP/2 Session│───▶│HTTP/2 Streams│                   │
│  │   Manager    │    │  (1000 max)  │                   │
│  └──────────────┘    └──────┬───────┘                   │
│                             │                            │
│                      ┌──────▼───────┐                   │
│                      │Route Handler │                   │
│                      └──────┬───────┘                   │
│                             │                            │
│         ┌───────────────────┼───────────────────┐       │
│         │                   │                   │       │
│  ┌──────▼──────┐    ┌───────▼──────┐    ┌─────▼─────┐│
│  │Metric Stream│    │Dashboard SSE  │    │   Stats   ││
│  │  Controller │    │   Controller   │    │Controller  ││
│  └──────┬──────┘    └───────┬───────┘    └────────────┘│
│         │                   │                           │
└─────────┼───────────────────┼───────────────────────────┘
          │                   │
          ▼                   ▼
┌──────────────────┐  ┌──────────────────┐
│ In-Memory        │  │ SSE Client        │
│ Aggregation Map  │  │ Registry          │
│                  │  │                   │
│ Map<"srv:mtr",  │  │ Set<ClientInfo>   │
│  Aggregation>    │  │                   │
└──────────────────┘  └──────────────────┘
          │                   │
          ▼                   ▼
┌──────────────────────────────────┐
│      Batch Buffer Service         │
│  (Thread-Safe with Mutex)          │
│                                    │
│  Buffer: Array<Metric>            │
│  Batch Size: 100                   │
│  Flush Interval: 5 seconds         │
└────────────┬───────────────────────┘
             │
             ▼
┌──────────────────────────────────┐
│         MySQL Database            │
│                                   │
│  - MetricRaw (raw metrics)        │
│  - MetricMinuteAgg (aggregated)   │
└──────────────────────────────────┘
```

---

## 🌐 OSI Model Layer Breakdown

### **Protocol Stack for Metrics Ingestion**

```
┌─────────────────────────────────────────────────────────┐
│ Layer 7: Application Layer                              │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Custom Metric Protocol                               │ │
│ │ - JSON metric objects                                │ │
│ │ - NDJSON format (newline-delimited)                  │ │
│ │ - Structure: {server_id, metric_name, value, ts}      │ │
│ └─────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────┤
│ Layer 6: Presentation Layer                             │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ JSON Serialization                                    │ │
│ │ - UTF-8 encoding                                       │ │
│ │ - Content-Type: application/json                     │ │
│ └─────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────┤
│ Layer 5: Session Layer                                  │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ HTTP/2 Session                                        │ │
│ │ - Persistent connection                               │ │
│ │ - Stream multiplexing (1000 streams/session)         │ │
│ │ - Flow control                                        │ │
│ └─────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────┤
│ Layer 4: Transport Layer                                │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ TCP                                                  │ │
│ │ - Reliable delivery                                  │ │
│ │ - Port 4002                                          │ │
│ │ - Connection-oriented                                │ │
│ └─────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────┤
│ Layer 3: Network Layer                                  │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ IP                                                   │ │
│ │ - IPv4/IPv6                                          │ │
│ │ - Routing                                            │ │
│ └─────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────┤
│ Layer 2: Data Link Layer                                │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Ethernet / WiFi                                     │ │
│ │ - MAC addressing                                     │ │
│ │ - Frame transmission                                 │ │
│ └─────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────┤
│ Layer 1: Physical Layer                                 │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Network Interface                                    │ │
│ │ - Cable / Wireless                                    │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘

Security Layer (TLS):
┌─────────────────────────────────────────────────────────┐
│ TLS 1.2/1.3                                              │
│ - Handshake (certificate exchange)                       │
│ - Encryption (AES-256-GCM)                               │
│ - Message Authentication                                 │
│ - Wraps HTTP/2                                          │
└─────────────────────────────────────────────────────────┘
```

### **Protocol Stack for Dashboard Updates**

```
┌─────────────────────────────────────────────────────────┐
│ Layer 7: Application Layer                              │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Server-Sent Events (SSE)                            │ │
│ │ - Event format: "event: type\ndata: JSON\n\n"       │ │
│ │ - Content-Type: text/event-stream                    │ │
│ │ - Unidirectional (server → client)                   │ │
│ └─────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────┤
│ Layer 6: Presentation Layer                             │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ JSON for event data                                  │ │
│ │ - UTF-8 encoding                                     │ │
│ └─────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────┤
│ Layer 5: Session Layer                                  │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ HTTP/2 Session (same as metrics)                     │ │
│ │ - Long-lived connection                              │ │
│ │ - Multiple SSE streams per session                   │ │
│ └─────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────┤
│ Layer 4: Transport Layer                                │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ TCP (same connection as metrics)                     │ │
│ │ - Reuses HTTP/2 session                              │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
(Layers 3-1 same as above)
```

---

## 📊 Sequence Diagrams

### **1. Metric Ingestion Flow**

```
Server                    HTTP/2 Server                In-Memory          MySQL
  │                           │                         Aggregation        │
  │                           │                           Map              │
  │                           │                           │                │
  │─── TLS Handshake ─────────▶│                           │                │
  │                           │                           │                │
  │◀── TLS Handshake ──────────│                           │                │
  │                           │                           │                │
  │─── HTTP/2 Connection ─────▶│                           │                │
  │                           │                           │                │
  │─── Stream 1: POST ────────▶│                           │                │
  │    /api/metrics/stream     │                           │                │
  │                           │                           │                │
  │─── Metric 1 (JSON) ───────▶│                           │                │
  │                           │─── Parse ────────────────▶│                │
  │                           │                           │                │
  │                           │                           │─Update Agg────▶│
  │                           │                           │                │
  │                           │◀── Add to Buffer ──────────│                │
  │                           │                           │                │
  │─── Metric 2 (JSON) ────────▶│                           │                │
  │                           │─── Parse ────────────────▶│                │
  │                           │                           │                │
  │                           │                           │─Update Agg────▶│
  │                           │                           │                │
  │                           │◀── Add to Buffer ──────────│                │
  │                           │                           │                │
  │                           │                           │                │
  │                           │  [Every 5 seconds]        │                │
  │                           │                           │                │
  │                           │─── Flush Batch ────────────────────────────▶│
  │                           │    (100 metrics)          │                │
  │                           │                           │                │
  │◀── ACK: 100 ───────────────│                           │                │
  │                           │                           │                │
```

### **2. Dashboard Update Flow (SSE)**

```
Dashboard                 HTTP/2 Server                In-Memory          SSE
Client                    │                         Aggregation        Clients
  │                       │                           Map               │
  │                       │                           │                 │
  │─── TLS Handshake ──────▶│                           │                 │
  │                       │                           │                 │
  │◀── TLS Handshake ───────│                           │                 │
  │                       │                           │                 │
  │─── HTTP/2 Connection ──▶│                           │                 │
  │                       │                           │                 │
  │─── Stream: GET ────────▶│                           │                 │
  │    /api/dashboard/     │                           │                 │
  │       stream           │                           │                 │
  │                       │                           │                 │
  │◀── SSE Headers ────────│                           │                 │
  │    (200 OK)            │                           │                 │
  │    text/event-stream   │                           │                 │
  │                       │                           │                 │
  │◀── event: init ────────│◀── Get Summary ──────────│                 │
  │    data: {...}         │                           │                 │
  │                       │                           │                 │
  │                       │                           │                 │
  │                       │  [Every 1 second]         │                 │
  │                       │                           │                 │
  │                       │◀── Get Summary ────────────│                 │
  │                       │                           │                 │
  │◀── event: update ──────│─── Broadcast ───────────────────────────▶│
  │    data: {...}         │                           │                 │
  │                       │                           │                 │
  │◀── event: update ──────│─── Broadcast ───────────────────────────▶│
  │    data: {...}         │                           │                 │
  │                       │                           │                 │
  │◀── : heartbeat ────────│                           │                 │
  │    (every 30s)         │                           │                 │
  │                       │                           │                 │
```

### **3. Batch Flush to Database**

```
In-Memory              Batch Buffer              MySQL
Aggregation            Service                   Database
  │                       │                        │
  │─── Add Metric ────────▶│                        │
  │                       │                        │
  │─── Add Metric ────────▶│                        │
  │                       │                        │
  │─── Add Metric ────────▶│                        │
  │                       │                        │
  │  [Buffer accumulates] │                        │
  │                       │                        │
  │                       │  [Timer: 5 seconds]   │
  │                       │                        │
  │                       │─── Acquire Mutex ──────│
  │                       │                        │
  │                       │─── Get Batch ──────────│
  │                       │    (100 metrics)      │
  │                       │                        │
  │                       │─── Bulk Insert ───────▶│  │                       │    MetricRaw table    │
  │                       │                        │
  │                       │◀── Success ───────────│
  │                       │                        │
  │                       │─── Release Mutex ─────│
  │                       │                        │
  │                       │─── Clear Buffer ──────│
  │                       │                        │
```

### **4. Concurrent Stream Processing**

```
Server 1    Server 2    Server 3        HTTP/2 Session
  │            │            │                    │
  │─── Stream 1            │                    │
  │            │            │                    │
  │            │─── Stream 2│                    │
  │            │            │                    │
  │            │            │─── Stream 3        │
  │            │            │                    │
  │            │            │                    │
  │            │            │                    │
  │  [All streams multiplexed on one TCP connection]
  │            │            │                    │
  │            │            │                    │
  └────────────┼────────────┼────────────────────┘
               │            │
         ┌─────▼────────────▼─────┐
         │   HTTP/2 Server        │
         │   (Single Connection)  │
         │                        │
         │  Stream 1 ──► Handler 1 │
         │  Stream 2 ──► Handler 2 │
         │  Stream 3 ──► Handler 3 │
         │                        │
         └────────────────────────┘
```

---

## ⚖️ Design Decisions & Trade-offs

### **1. HTTP/2 vs HTTP/1.1**

| Aspect | HTTP/1.1 | HTTP/2 | Choice |
|--------|----------|--------|--------|
| **Multiplexing** | ❌ Multiple connections needed | ✅ 1000 streams/connection | ✅ **HTTP/2** |
| **Header Compression** | ❌ No | ✅ HPACK | ✅ **HTTP/2** |
| **Latency** | Higher (multiple connections) | Lower (single connection) | ✅ **HTTP/2** |
| **Complexity** | Simple | More complex | ⚠️ Accepted trade-off |

**Decision: HTTP/2** - Worth the complexity for 10x better efficiency.

---

### **2. SSE vs WebSocket**

| Aspect | WebSocket | SSE | Choice |
|--------|-----------|-----|--------|
| **Bidirectional** | ✅ Yes | ❌ No (server→client only) | ⚠️ Not needed |
| **Protocol Complexity** | More complex | Simpler | ✅ **SSE** |
| **HTTP/2 Support** | Limited | ✅ Native | ✅ **SSE** |
| **Auto Reconnection** | Manual | ✅ Built-in | ✅ **SSE** |
| **Overhead** | Higher | Lower | ✅ **SSE** |

**Decision: SSE** - Perfect for one-way dashboard updates, simpler and HTTP/2 native.

---

### **3. Stateful In-Memory vs Stateless Database**

| Aspect | Stateless (DB only) | Stateful (In-Memory) | Choice |
|--------|---------------------|---------------------|--------|
| **Read Latency** | ~10-50ms (DB query) | ~0.001ms (memory) | ✅ **In-Memory** |
| **Write Latency** | ~5-20ms per metric | Batched (100 metrics) | ✅ **In-Memory + Batch** |
| **Memory Usage** | Low | Higher | ⚠️ Accepted trade-off |
| **Data Durability** | ✅ Always persisted | ⚠️ Lost on crash | ✅ **Hybrid** |
| **Scalability** | Limited by DB | High throughput | ✅ **In-Memory** |

**Decision: Hybrid Approach**
- ✅ In-memory for real-time reads (dashboard)
- ✅ MySQL for persistence (durability + history)
- ✅ Batch writes (efficiency)

---

### **4. Batch Size: 100 vs 1000**

| Aspect | Batch 100 | Batch 1000 | Choice |
|--------|-----------|------------|--------|
| **Memory Usage** | Lower | Higher | ✅ **100** |
| **Flush Frequency** | More often | Less often | ✅ **100** |
| **Data Freshness** | Better | Worse | ✅ **100** |
| **DB Load** | More queries | Fewer queries | ⚠️ Still acceptable |
| **Risk on Crash** | Less data loss | More data loss | ✅ **100** |

**Decision: 100 metrics/batch** - Better balance of freshness and efficiency.

---

### **5. Flush Interval: 5s vs 1s**

| Aspect | 5 seconds | 1 second | Choice |
|--------|-----------|----------|--------|
| **DB Load** | Lower | Higher | ✅ **5s** |
| **Data Loss Risk** | Higher | Lower | ⚠️ Acceptable |
| **Batch Efficiency** | Better (larger batches) | Worse (smaller batches) | ✅ **5s** |
| **Real-time Accuracy** | Good enough | Better | ⚠️ 5s acceptable |

**Decision: 5 seconds** - Dashboard reads from in-memory (real-time), DB is for persistence.

---

### **6. Connection Pool Management**

| Aspect | Unlimited | Limited (500-1000) | Choice |
|--------|-----------|-------------------|--------|
| **Memory Usage** | High | Controlled | ✅ **Limited** |
| **Stability** | May crash | Stable | ✅ **Limited** |
| **Throughput** | Higher (theoretical) | Lower but stable | ✅ **Limited** |

**Decision: Limited to 1000** - Better stability, sufficient throughput.

---

## 🎯 Why Specific Patterns Were Chosen

### **1. HTTP/2 Multiplexing Pattern**

**Why:**
- **Problem**: HTTP/1.1 requires multiple connections (connection overhead)
- **Solution**: HTTP/2 allows 1000 streams per connection
- **Benefit**: 10x reduction in connection overhead

**Example:**
```
HTTP/1.1: 10,000 servers = 10,000 connections
HTTP/2:   10,000 servers = 10 connections (1000 streams each)
```

---

### **2. Stateful In-Memory Aggregation**

**Why:**
- **Problem**: Dashboard queries need <10ms latency
- **Solution**: Keep aggregations in memory (Map data structure)
- **Benefit**: Microsecond reads vs millisecond DB queries

**Pattern:**
```javascript
// Map<"server_id:metric_name", Aggregation>
const aggregations = new Map();

// O(1) lookup - instant!
const agg = aggregations.get("srv-001:cpu_usage");
```

---

### **3. Batch Writing Pattern**

**Why:**
- **Problem**: Writing 50,000 metrics/sec to DB is inefficient
- **Solution**: Buffer 100 metrics, flush every 5 seconds
- **Benefit**: 100x reduction in DB writes

**Pattern:**
```
Individual writes: 50,000 writes/sec
Batch writes: 100 metrics/batch = 500 writes/sec
Reduction: 100x fewer DB operations
```

---

### **4. SSE Broadcasting Pattern**

**Why:**
- **Problem**: Dashboard needs real-time updates
- **Solution**: Push updates to all connected clients
- **Benefit**: No polling, instant updates

**Pattern:**
```javascript
// When aggregation updates:
for (const client of sseClients) {
  sendSSEEvent(client.stream, {
    type: 'update',
    data: aggregatedMetrics
  });
}
```

---

### **5. Mutex Lock Pattern (Thread-Safe)**

**Why:**
- **Problem**: Concurrent metric processing → race conditions
- **Solution**: Mutex lock for buffer access
- **Benefit**: Thread-safe operations, no data corruption

**Pattern:**
```javascript
const mutex = new Mutex();

async function addMetric(metric) {
  await mutex.acquire();
  try {
    buffer.push(metric);
  } finally {
    mutex.release();
  }
}
```

---

### **6. Stream-Based Processing**

**Why:**
- **Problem**: Large payloads consume too much memory
- **Solution**: Process data as streams (chunk by chunk)
- **Benefit**: Constant memory usage, handles any payload size

**Pattern:**
```javascript
stream.on('data', (chunk) => {
  // Process chunk immediately
  // Don't buffer entire request
});
```

---

## 📐 Architecture Patterns Used

### **1. Stream Processing Pattern**
- Process data as it arrives (not all at once)
- Low memory footprint
- Handles backpressure

### **2. Pub/Sub Pattern (SSE)**
- Server publishes updates
- Clients subscribe via SSE
- One-to-many broadcast

### **3. Write-Behind Cache Pattern**
- Write to fast cache (memory) first
- Flush to slow storage (DB) asynchronously
- Balance speed and durability

### **4. Batch Processing Pattern**
- Accumulate operations
- Process in batches
- Reduce overhead

### **5. Connection Pool Pattern**
- Limit concurrent connections
- Queue excess requests
- Prevent resource exhaustion

---

## 🔄 Data Flow Summary

### **Write Path (Metric Ingestion)**
```
Server → HTTP/2 Stream → Parse → In-Memory Agg → Batch Buffer → MySQL
        (1-2ms)          (0.1ms)  (0.001ms)      (buffered)   (batched)
```

### **Read Path (Dashboard)**
```
In-Memory Agg → SSE Broadcast → Dashboard Client
(0.001ms)      (1ms)           (instant display)
```

### **Persistence Path**
```
Batch Buffer → Mutex Lock → Bulk Insert → MySQL
(accumulates) (thread-safe)  (100 metrics) (durable)
```

---

## 💡 Key Insights

### **Why This Architecture Works**

1. **Separation of Concerns**
   - Fast path: In-memory for real-time
   - Slow path: Database for persistence
   - Each optimized for its purpose

2. **Optimized for Common Case**
   - Reads (dashboard) are 1000x more frequent than writes
   - In-memory reads optimize for this

3. **Scalability Through Batching**
   - Individual metrics → fast aggregation
   - Batched writes → efficient persistence
   - Best of both worlds

4. **HTTP/2 Efficiency**
   - Multiplexing reduces connection overhead
   - Header compression reduces bandwidth
   - Binary framing reduces parsing time

---

## 🎓 Conclusion

This architecture achieves:
- ✅ **Ultra-low latency** (microseconds for reads)
- ✅ **High throughput** (50,000+ metrics/sec)
- ✅ **Real-time updates** (SSE push)
- ✅ **Durability** (MySQL persistence)
- ✅ **Scalability** (10,000+ concurrent connections)

All through careful pattern selection and trade-off analysis!

