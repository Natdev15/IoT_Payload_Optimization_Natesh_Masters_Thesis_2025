# ------------------------------------------------------------
#  IoT Payload Optimization Framework – Master's Thesis (2025)
#  Copyright (c) 2025 Natesh Kumar (Natdev15)
#  Provided for academic and research reference only.
# ------------------------------------------------------------

const express = require('express');
const cbor = require('cbor');
const app = express();

// Configuration
const PORT = process.env.PORT || 3000; // Server port
const QUEUE_PROCESS_INTERVAL = 5000; // Queue process interval
const OUTBOUND_URL = process.env.OUTBOUND_URL || null; // Outbound URL
const OUTBOUND_RETRY_INTERVAL = 5000; // Outbound retry interval
const MAX_RETRY_ATTEMPTS = 100; // Maximum number of retry attempts

// CBOR decompression
function cborDecompress(compressedData) {
    try {
        const containerData = cbor.decode(compressedData);
        return containerData;
    } catch (error) {
        throw new Error(`CBOR decompression failed: ${error.message}`);
    }
}

// Message queue for processing messages
class MessageQueue {
    constructor() {
        this.queue = [];
        this.processed = 0;
        this.errors = 0;
        this.startTime = Date.now();
        
        this.startProcessor();
        console.log('Message queue initialized');
        console.log(`Processing interval: ${QUEUE_PROCESS_INTERVAL}ms`);
    }
    
    add(message) {
        this.queue.push({
            ...message,
            queuedAt: Date.now()
        });
    }
    
    startProcessor() {
        setInterval(() => {
            this.processQueue();
        }, QUEUE_PROCESS_INTERVAL);
        console.log('Queue processor started');
    }
    
    processQueue() {
        if (this.queue.length === 0) return;
        
        console.log(`Processing ${this.queue.length} messages from queue...`);
        const batch = this.queue.splice(0);
        
        batch.forEach(message => {
            try {
                this.processMessage(message);
                this.processed++;
            } catch (error) {
                console.error('Error processing message:', error.message);
                this.errors++;
            }
        });
        
        if (batch.length > 0) {
            console.log(`Batch processed: ${batch.length} messages`);
            console.log(`Total: ${this.processed} processed, ${this.errors} errors, Rate: ${(this.processed / ((Date.now() - this.startTime) / 1000)).toFixed(1)} msg/sec`);
        }
    }
    
    processMessage(message) {
        const { compressedData, receivedAt, queuedAt } = message;
        
        const containerData = cborDecompress(compressedData);
        
        if (!containerData || typeof containerData !== 'object') {
            throw new Error('Invalid decompressed data structure');
        }
        
        const reconstructedData = {
            "m2m:cin": {
                "con": containerData
            }
        };
        
        this.onDataProcessed(reconstructedData);
    }
    
    onDataProcessed(data) {
        outboundQueue.add(data);
    }
    
    getStats() {
        const uptime = Date.now() - this.startTime;
        return {
            processed: this.processed,
            errors: this.errors,
            queueSize: this.queue.length,
            uptimeMs: uptime,
            ratePerSecond: this.processed / (uptime / 1000)
        };
    }
}

// Outbound queue for forwarding processed data to external M2M endpoint
class OutboundQueue {
    constructor() {
        this.queue = [];
        this.processing = false;
        this.totalSent = 0;
        this.totalErrors = 0;
        this.startTime = Date.now();
        
        if (OUTBOUND_URL) {
            this.startProcessor();
            console.log('Outbound queue initialized');
            console.log(`Target URL: ${OUTBOUND_URL}`);
        } else {
            console.log('OUTBOUND_URL not configured - outbound queue disabled');
        }
    }
    
    add(data) {
        if (!OUTBOUND_URL) return;
        
        const queueItem = {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            data: data,
            attempts: 0,
            nextRetryAt: Date.now()
        };
        
        this.queue.push(queueItem);
    }
    
    startProcessor() {
        setInterval(() => {
            this.processQueue();
        }, OUTBOUND_RETRY_INTERVAL);
    }
    
    async processQueue() {
        if (this.processing || this.queue.length === 0) return;
        
        this.processing = true;
        const now = Date.now();
        const readyItems = this.queue.filter(item => item.nextRetryAt <= now);
        
        if (readyItems.length === 0) {
            this.processing = false;
            return;
        }
        
        for (const item of readyItems) {
            await this.sendItem(item);
        }
        
        this.queue = this.queue.filter(item => item.attempts > 0 && item.attempts <= MAX_RETRY_ATTEMPTS);
        this.processing = false;
    }
    
    async sendItem(item) {
        try {
            item.attempts++;
            
            const payload = {
                "m2m:cin": {
                    "con": item.data["m2m:cin"]["con"]
                }
            };
            
            const response = await fetch(OUTBOUND_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json;ty=4',
                    'X-M2M-RI': new Date().toISOString(),
                    'X-M2M-ORIGIN': 'Natesh'
                },
                body: JSON.stringify(payload)
            });
            
            if (response.status === 201) {
                item.attempts = 0;
                this.totalSent++;
            } else {
                throw new Error(`Unexpected status: ${response.status}`);
            }
            
        } catch (error) {
            if (item.attempts >= MAX_RETRY_ATTEMPTS) {
                this.totalErrors++;
                console.log(`Giving up on item ${item.id} after ${MAX_RETRY_ATTEMPTS} attempts`);
                item.attempts = 0;
            } else {
                const delay = Math.min(OUTBOUND_RETRY_INTERVAL * Math.pow(2, item.attempts - 1), 60000);
                item.nextRetryAt = Date.now() + delay;
            }
        }
    }
    
    getStats() {
        const uptime = Date.now() - this.startTime;
        return {
            queueSize: this.queue.length,
            totalSent: this.totalSent,
            totalErrors: this.totalErrors,
            uptimeMs: uptime,
            ratePerSecond: this.totalSent / (uptime / 1000),
            enabled: !!OUTBOUND_URL,
            targetUrl: OUTBOUND_URL
        };
    }
}

// Initialize queues
const messageQueue = new MessageQueue();
const outboundQueue = new OutboundQueue();

// Middleware
app.use(express.raw({ type: 'application/octet-stream', limit: '1mb' }));
app.use(express.json());

// CORS middleware
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
        return;
    }
    next();
});

// Health check endpoint
app.get('/health', (req, res) => {
    const inboundStats = messageQueue.getStats();
    const outboundStats = outboundQueue.getStats();
    
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        inbound: inboundStats,
        outbound: outboundStats
    });
});

// Statistics endpoint
app.get('/stats', (req, res) => {
    const inboundStats = messageQueue.getStats();
    const outboundStats = outboundQueue.getStats();
    
    res.json({
        timestamp: new Date().toISOString(),
        inbound: inboundStats,
        outbound: outboundStats
    });
});

// Main container data endpoint
app.post('/container-data', (req, res) => {
    try {
        const compressedData = req.body;
        
        if (!Buffer.isBuffer(compressedData)) {
            return res.status(400).json({
                error: 'Invalid data format',
                message: 'Expected binary data (CBOR compressed)'
            });
        }
        
        if (compressedData.length === 0) {
            return res.status(400).json({
                error: 'Empty payload',
                message: 'No data received'
            });
        }
        
        messageQueue.add({
            compressedData: compressedData,
            receivedAt: Date.now(),
            size: compressedData.length
        });
        
        res.status(200).json({
            status: 'received',
            timestamp: new Date().toISOString(),
            size: compressedData.length,
            queueSize: messageQueue.queue.length
        });
        
    } catch (error) {
        console.error('Error receiving container data:', error.message);
        res.status(500).json({
            error: 'Processing error',
            message: error.message
        });
    }
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({
        error: 'Internal server error',
        message: error.message
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not found',
        message: `Endpoint ${req.method} ${req.path} not found`
    });
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down gracefully...');
    
    const stats = messageQueue.getStats();
    console.log('Final Statistics:');
    console.log(`   Processed: ${stats.processed} messages`);
    console.log(`   Errors: ${stats.errors}`);
    console.log(`   Rate: ${stats.ratePerSecond.toFixed(2)} msg/sec`);
    console.log(`   Uptime: ${(stats.uptimeMs / 1000).toFixed(2)}s`);
    
    process.exit(0);
});

// Start server
app.listen(PORT, () => {
    console.log('Container Data Receiver Server Started CBOR');
    console.log('='.repeat(60));
    console.log(`Listening on port ${PORT}`);
    console.log(`Main endpoint: POST /container-data`);
    console.log(`Health check: GET /health`);
    console.log(`Statistics: GET /stats`);
    console.log(`Queue processing: every ${QUEUE_PROCESS_INTERVAL}ms`);
    console.log(`Compression method: CBOR`);
    console.log(`Content-Type: application/octet-stream`);
    console.log('='.repeat(60));
});

module.exports = app; 
