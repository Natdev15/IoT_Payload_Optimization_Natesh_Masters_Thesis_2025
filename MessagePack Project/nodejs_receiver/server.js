const express = require('express');
const axios = require('axios');
const { encode, decode } = require('@msgpack/msgpack');
const app = express();

// Configuration
const PORT = process.env.PORT || 3000;
const QUEUE_PROCESS_INTERVAL = 5000; // 5 seconds
const OUTBOUND_URL = process.env.OUTBOUND_URL || null; // External M2M endpoint
const OUTBOUND_RETRY_INTERVAL = 5000; // 5 seconds between retry attempts
const MAX_RETRY_ATTEMPTS = 100; // Maximum retry attempts before giving up

// Pure MessagePack decompression: direct MessagePack decode to JSON
function msgpackDecompress(compressedData) {
    try {
        // Direct MessagePack decompression to JSON object
        const containerData = decode(compressedData);
        return containerData;
        
    } catch (error) {
        throw new Error(`MessagePack decompression failed: ${error.message}`);
    }
}

// Pseudo queue for processing messages
class MessageQueue {
    constructor() {
        this.queue = [];
        this.processed = 0;
        this.errors = 0;
        this.startTime = Date.now();
        
        // Start queue processor
        this.startProcessor();
        
        console.log('Message queue initialized');
        console.log(`Processing interval: ${QUEUE_PROCESS_INTERVAL}ms`);
    }
    
    add(message) {
        this.queue.push({
            ...message,
            queuedAt: Date.now()
        });
        // console.log(`Message queued (queue size: ${this.queue.length})`);
    }
    
    startProcessor() {
        setInterval(() => {
            this.processQueue();
        }, QUEUE_PROCESS_INTERVAL);
        
        console.log('Queue processor started');
    }
    
    processQueue() {
        if (this.queue.length === 0) {
            return;
        }
        
        console.log(`Processing ${this.queue.length} messages from queue...`);
        
        const batch = this.queue.splice(0); // Process all queued messages
        
        const batchStats = {
            processed: 0,
            errors: 0,
            avgQueueTime: 0,
            avgProcessingTime: 0,
            totalQueueTime: 0,
            totalProcessingTime: 0
        };
        
        batch.forEach(message => {
            try {
                this.processMessage(message);
                this.processed++;
                batchStats.processed++;
                
                // Collect timing stats if available
                if (message.processingStats) {
                    batchStats.totalQueueTime += message.processingStats.queueTime;
                    batchStats.totalProcessingTime += message.processingStats.processingTime;
                }
            } catch (error) {
                console.error('Error processing message:', error.message);
                this.errors++;
                batchStats.errors++;
            }
        });
        
        if (batch.length > 0) {
            // Calculate averages
            if (batchStats.processed > 0) {
                batchStats.avgQueueTime = Math.round(batchStats.totalQueueTime / batchStats.processed);
                batchStats.avgProcessingTime = Math.round(batchStats.totalProcessingTime / batchStats.processed);
            }
            
            console.log(`Batch processed: ${batchStats.processed} messages, ${batchStats.errors} errors`);
            console.log(`   Timing - Queue: ${batchStats.avgQueueTime}ms avg, Processing: ${batchStats.avgProcessingTime}ms avg`);
            console.log(`   Total: ${this.processed} processed, ${this.errors} errors, Rate: ${(this.processed / ((Date.now() - this.startTime) / 1000)).toFixed(1)} msg/sec`);
        }
    }
    
    processMessage(message) {
        const { compressedData, receivedAt, queuedAt } = message;
        
        // Pure MessagePack decompression: direct decode to JSON
        const containerData = msgpackDecompress(compressedData);
        
        // Validate decompressed data has expected structure
        if (!containerData || typeof containerData !== 'object') {
            throw new Error('Invalid decompressed data structure');
        }
        
        // Create full structure (matching stress.py format)
        const reconstructedData = {
            "m2m:cin": {
                "con": containerData
            }
        };
        
        // Calculate processing times (for internal tracking)
        const queueTime = queuedAt - receivedAt;
        const processingTime = Date.now() - queuedAt;
        const totalTime = Date.now() - receivedAt;
        
        // Store timing info for potential use (no console output for individual records)
        message.processingStats = {
            queueTime,
            processingTime,
            totalTime,
            containerId: containerData.iso6346,
            simId: containerData.msisdn
        };
        
        // Here you could store to database, forward to another service, etc.
        this.onDataProcessed(reconstructedData);
    }
    
    onDataProcessed(data) {
        // Forward processed data to external M2M endpoint via outbound queue
        outboundQueue.add(data);
        
        // Additional processing can be added here (database, other APIs, etc.)
        // console.log('Data ready for further processing');
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
        
        // Start processing if URL is configured
        if (OUTBOUND_URL) {
            this.startProcessor();
            console.log('Outbound queue initialized');
            console.log(`Target URL: ${OUTBOUND_URL}`);
        } else {
            console.log('OUTBOUND_URL not configured - outbound queue disabled');
        }
    }
    
    add(data) {
        if (!OUTBOUND_URL) {
            return; // Skip if no URL configured
        }
        
        const queueItem = {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            data: data,
            attempts: 0,
            createdAt: Date.now(),
            lastAttemptAt: null,
            nextRetryAt: Date.now() // Can send immediately
        };
        
        this.queue.push(queueItem);
        // console.log(`Added to outbound queue (size: ${this.queue.length}) - ID: ${queueItem.id}`);
    }
    
    startProcessor() {
        setInterval(() => {
            this.processQueue();
        }, OUTBOUND_RETRY_INTERVAL);
    }
    
    async processQueue() {
        if (this.processing || this.queue.length === 0) {
            return;
        }
        
        this.processing = true;
        const now = Date.now();
        
        // Find items ready for retry
        const readyItems = this.queue.filter(item => item.nextRetryAt <= now);
        
        if (readyItems.length === 0) {
            this.processing = false;
            return;
        }
        
        // console.log(`Processing ${readyItems.length} outbound messages...`);
        
        for (const item of readyItems) {
            await this.sendItem(item);
        }
        
        // Remove successfully sent items (those with attempts = 0 after processing)
        const beforeCount = this.queue.length;
        this.queue = this.queue.filter(item => item.attempts > 0 && item.attempts <= MAX_RETRY_ATTEMPTS);
        const removedCount = beforeCount - this.queue.length;
        
        if (removedCount > 0) {
            // console.log(`Removed ${removedCount} completed/failed items from outbound queue`);
        }
        
        this.processing = false;
    }
    
    async sendItem(item) {
        try {
            item.attempts++;
            item.lastAttemptAt = Date.now();
            
            // Create M2M format payload (same as http-client.js)
            const payload = {
                "m2m:cin": {
                    "con": item.data["m2m:cin"]["con"]
                }
            };
            
            const response = await axios.post(OUTBOUND_URL, payload, {
                headers: {
                    'Content-Type': 'application/json;ty=4',
                    'X-M2M-RI': new Date().toISOString(),
                    'X-M2M-ORIGIN': 'Natesh'
                },
                timeout: 10000 // 10 second timeout
            });
            
            if (response.status === 201) {
                // Success! Mark for removal
                item.attempts = 0;
                this.totalSent++;
                // console.log(`Successfully sent item ${item.id} (attempt ${item.attempts})`);
            } else {
                throw new Error(`Unexpected status: ${response.status}`);
            }
            
        } catch (error) {
            // console.log(`Failed to send item ${item.id} (attempt ${item.attempts}/${MAX_RETRY_ATTEMPTS}): ${error.message}`);
            
            if (item.attempts >= MAX_RETRY_ATTEMPTS) {
                // Give up after max attempts
                this.totalErrors++;
                console.log(`Giving up on item ${item.id} after ${MAX_RETRY_ATTEMPTS} attempts`);
                item.attempts = 0; // Mark for removal
            } else {
                // Schedule retry with exponential backoff
                const delay = Math.min(OUTBOUND_RETRY_INTERVAL * Math.pow(2, item.attempts - 1), 60000); // Max 60s
                item.nextRetryAt = Date.now() + delay;
                console.log(`Retrying item ${item.id} in ${delay}ms`);
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

// Initialize message queue
const messageQueue = new MessageQueue();

// Initialize outbound queue
const outboundQueue = new OutboundQueue();

// Middleware
app.use(express.raw({ type: 'application/octet-stream', limit: '1mb' }));
app.use(express.json());

// CORS middleware for cross-origin requests
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
                message: 'Expected binary data (MessagePack compressed)'
            });
        }
        
        if (compressedData.length === 0) {
            return res.status(400).json({
                error: 'Empty payload',
                message: 'No data received'
            });
        }
        
        // console.log(`Received container data (${compressedData.length} bytes)`);
        
        // Add to queue for processing
        messageQueue.add({
            compressedData: compressedData,
            receivedAt: Date.now(),
            size: compressedData.length
        });
        
        // Respond immediately
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

// Test endpoint for manual testing
app.post('/test', (req, res) => {
    console.log('Test endpoint called');
    console.log('Headers:', req.headers);
    console.log('Body type:', typeof req.body);
    console.log('Body length:', req.body?.length || 0);
    
    res.json({
        status: 'test received',
        contentType: req.headers['content-type'],
        bodyType: typeof req.body,
        bodyLength: req.body?.length || 0
    });
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
    console.log('Container Data Receiver Server Started (MessagePack)');
    console.log('='.repeat(60));
    console.log(`Listening on port ${PORT}`);
    console.log(`Main endpoint: POST /container-data`);
    console.log(`Health check: GET /health`);
    console.log(`Statistics: GET /stats`);
    console.log(`Test endpoint: POST /test`);
    console.log(`Queue processing: every ${QUEUE_PROCESS_INTERVAL}ms`);
    console.log(`Compression method: MessagePack`);
    console.log(`Content-Type: application/octet-stream`);
    console.log('='.repeat(60));
});

module.exports = app; 