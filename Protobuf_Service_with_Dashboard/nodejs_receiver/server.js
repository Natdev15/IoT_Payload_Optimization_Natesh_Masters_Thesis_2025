# ------------------------------------------------------------
#  IoT Payload Optimization Framework – Master's Thesis (2025)
#  Copyright (c) 2025 Natesh Kumar (Natdev15)
#  Provided for academic and research reference only.
# ------------------------------------------------------------


const express = require('express');
const axios = require('axios');
const protobuf = require('protobufjs');
const path = require('path');
const ContainerDatabase = require('./database');

// ================= CONFIG =================
const CONFIG = {
    PORT: process.env.PORT || 3000,
    QUEUE_PROCESS_INTERVAL: 5000,
    OUTBOUND_URL: process.env.OUTBOUND_URL || null,
    OUTBOUND_RETRY_INTERVAL: 5000,
    MAX_RETRY_ATTEMPTS: 100,
    MAX_DB_RETRIES: 5
};

// Container field definitions
const CONTAINER_FIELDS = [
    'msisdn', 'iso6346', 'time', 'rssi', 'cgi', 'ble-m', 'bat-soc', 'acc',
    'temperature', 'humidity', 'pressure', 'door', 'gnss', 'latitude',
    'longitude', 'altitude', 'speed', 'heading', 'nsat', 'hdop'
];

// ================= GLOBALS =================
let ContainerData;
let database = null;
let dbRetryCount = 0;

const app = express();

// ================= PROTOBUF INIT =================
async function initializeProtobuf() {
    try {
        const root = await protobuf.load('./container_data.proto');
        ContainerData = root.lookupType('container.ContainerData');
        console.log('Protocol Buffer schema loaded successfully');
    } catch (error) {
        console.error('Failed to load protobuf schema:', error.message);
        process.exit(1);
    }
}

// Utility helpers
const safeToString = (value, def = '0') =>
    (value === undefined || value === null) ? def : value.toString();

const safeToFixed = (value, decimals = 2, def = '0.00') =>
    (value === undefined || value === null) ? def : Number(value).toFixed(decimals);

// Decompress Protobuf
function protobufDecompress(compressedData) {
    try {
        const pbMessage = ContainerData.decode(compressedData);
        return {
            msisdn: pbMessage.msisdn || '',
            iso6346: pbMessage.iso6346 || '',
            time: pbMessage.time || '',
            cgi: pbMessage.cgi || '',
            door: pbMessage.door || '',
            rssi: safeToString(pbMessage.rssi, '0'),
            'ble-m': safeToString(pbMessage.bleM, '0'),
            'bat-soc': safeToString(pbMessage.batSoc, '0'),
            gnss: safeToString(pbMessage.gnss, '0'),
            nsat: safeToString(pbMessage.nsat, '00').padStart(2, '0'),
            acc: `${safeToFixed(pbMessage.accX, 4)} ${safeToFixed(pbMessage.accY, 4)} ${safeToFixed(pbMessage.accZ, 4)}`,
            temperature: safeToFixed(pbMessage.temperature, 2),
            humidity: safeToFixed(pbMessage.humidity, 2),
            pressure: safeToFixed(pbMessage.pressure, 4),
            latitude: safeToFixed(pbMessage.latitude, 2),
            longitude: safeToFixed(pbMessage.longitude, 2),
            altitude: safeToFixed(pbMessage.altitude, 2),
            speed: safeToFixed(pbMessage.speed, 1),
            heading: safeToFixed(pbMessage.heading, 2),
            hdop: safeToFixed(pbMessage.hdop, 1)
        };
    } catch (err) {
        throw new Error(`Protocol Buffer decompression failed: ${err.message}`);
    }
}

// ================= MESSAGE QUEUE =================
class MessageQueue {
    constructor() {
        this.queue = [];
        this.processed = 0;
        this.errors = 0;
        this.startTime = Date.now();
        this.startProcessor();
        console.log('Message queue initialized');
    }

    add(message) {
        this.queue.push({ ...message, queuedAt: Date.now() });
    }

    startProcessor() {
        setInterval(() => this.processQueue(), CONFIG.QUEUE_PROCESS_INTERVAL);
    }

    processQueue() {
        if (this.queue.length === 0) return;

        const batch = this.queue.splice(0);
        let processed = 0, errors = 0;

        batch.forEach(msg => {
            try {
                this.processMessage(msg);
                processed++; this.processed++;
            } catch (err) {
                console.error('Error processing message:', err.message);
                errors++; this.errors++;
            }
        });

        if (batch.length > 0) {
            const rate = (this.processed / ((Date.now() - this.startTime) / 1000)).toFixed(1);
            console.log(`Processed: ${processed}, Errors: ${errors} | Rate: ${rate}/sec`);
        }
    }

    processMessage(message) {
        const { compressedData } = message;
        const containerData = protobufDecompress(compressedData);

        if (Object.keys(containerData).length !== CONTAINER_FIELDS.length) {
            throw new Error(`Invalid field count: expected ${CONTAINER_FIELDS.length}, got ${Object.keys(containerData).length}`);
        }

        const reconstructedData = { "m2m:cin": { "con": containerData } };
        const originalJsonSize = Buffer.byteLength(JSON.stringify(reconstructedData), 'utf8');
        const compressedSize = compressedData.length;

        containerData.original_size = originalJsonSize;
        containerData.compressed_size = compressedSize;
        containerData.compression_ratio = originalJsonSize > 0 ? originalJsonSize / compressedSize : 0;

        this.onDataProcessed(reconstructedData, containerData);
    }

    async onDataProcessed(data, containerDataWithCompression) {
        try {
            if (!database?.db) {
                console.error('Database not available, skipping storage');
                outboundQueue.add(data, null);
                return;
            }
            const dbId = await database.insertContainerData(containerDataWithCompression);
            outboundQueue.add(data, dbId);
        } catch (err) {
            console.error('Error in onDataProcessed:', err.message);
            outboundQueue.add(data, null);
        }
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

// ================= OUTBOUND QUEUE =================
class OutboundQueue {
    constructor() {
        this.queue = [];
        this.processing = false;
        this.totalSent = 0;
        this.totalErrors = 0;
        this.startTime = Date.now();

        if (CONFIG.OUTBOUND_URL) {
            this.startProcessor();
            console.log(`Outbound queue initialized – Target: ${CONFIG.OUTBOUND_URL}`);
        } else {
            console.log('OUTBOUND_URL not configured – outbound queue disabled');
        }
    }

    add(data, dbId = null) {
        if (!CONFIG.OUTBOUND_URL) return;
        this.queue.push({
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            data, dbId, attempts: 0,
            createdAt: Date.now(),
            nextRetryAt: Date.now()
        });
    }

    startProcessor() {
        setInterval(() => this.processQueue(), CONFIG.OUTBOUND_RETRY_INTERVAL);
    }

    async processQueue() {
        if (this.processing || this.queue.length === 0) return;
        this.processing = true;
        const now = Date.now();
        const readyItems = this.queue.filter(i => i.nextRetryAt <= now);
        if (readyItems.length === 0) { this.processing = false; return; }

        for (const item of readyItems) { await this.sendItem(item); }
        this.queue = this.queue.filter(i => i.attempts > 0 && i.attempts <= CONFIG.MAX_RETRY_ATTEMPTS);
        this.processing = false;
    }

    async sendItem(item) {
        try {
            item.attempts++;
            const payload = { "m2m:cin": { "con": item.data["m2m:cin"]["con"] } };

            const response = await axios.post(CONFIG.OUTBOUND_URL, payload, {
                headers: {
                    'Content-Type': 'application/json;ty=4',
                    'Accept': 'application/json',
                    'X-M2M-RI': `${Date.now()}`,
                    'X-M2M-ORIGIN': 'Natesh'
                },
                timeout: 10000
            });

            if (response.status === 201) {
                item.attempts = 0; this.totalSent++;
                if (item.dbId) await database.updateMobiusStatus(item.dbId, true, 'Success');
            } else {
                throw new Error(`Unexpected status: ${response.status}`);
            }
        } catch (err) {
            if (item.dbId) await database.incrementErrorCount(item.dbId);
            if (item.attempts >= CONFIG.MAX_RETRY_ATTEMPTS) {
                this.totalErrors++;
                if (item.dbId) await database.updateMobiusStatus(item.dbId, false, `Failed after max attempts`);
                item.attempts = 0;
            } else {
                const delay = Math.min(CONFIG.OUTBOUND_RETRY_INTERVAL * Math.pow(2, item.attempts - 1), 60000);
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
            enabled: !!CONFIG.OUTBOUND_URL,
            targetUrl: CONFIG.OUTBOUND_URL
        };
    }
}

// ================= DATABASE INIT =================
function initializeDatabase() {
    try {
        database = new ContainerDatabase();
        console.log('Database initialized successfully');
        return true;
    } catch (err) {
        dbRetryCount++;
        if (dbRetryCount < CONFIG.MAX_DB_RETRIES) {
            setTimeout(initializeDatabase, 5000);
        } else {
            console.error('DB init failed after max retries');
        }
        return false;
    }
}
initializeDatabase();
const messageQueue = new MessageQueue();
const outboundQueue = new OutboundQueue();

// ================= MIDDLEWARE =================
app.use(express.raw({ type: 'application/octet-stream', limit: '1mb' }));
app.use(express.json());

// CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

// ================= DASHBOARD =================
app.use('/dashboard', express.static(path.join(__dirname, 'public')));
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

// ================= HEALTH =================
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        inbound: messageQueue.getStats(),
        outbound: outboundQueue.getStats()
    });
});

// ================= API ROUTES =================
app.get('/api/containers', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100;
        const containers = await database.getRecentContainers(limit);
        res.json({ containers, count: containers.length });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch containers' });
    }
});

app.get('/api/containers/:id', async (req, res) => {
    try {
        const container = await database.getContainerById(req.params.id);
        if (!container) return res.status(404).json({ error: 'Container not found' });
        res.json({ container });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch container' });
    }
});

app.get('/api/containers/:id/history', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const history = await database.getContainerHistory(req.params.id, limit);
        res.json({ history });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch container history' });
    }
});

app.get('/api/stats', async (req, res) => {
    try {
        const dbStats = await database.getStats();
        res.json({
            timestamp: new Date().toISOString(),
            database: dbStats,
            inbound: messageQueue.getStats(),
            outbound: outboundQueue.getStats()
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

app.get('/api/activity', async (req, res) => {
    try {
        let minutes = parseInt(req.query.minutes);
        if (!minutes && req.query.hours) minutes = parseInt(req.query.hours) * 60;
        minutes = minutes || 120;
        const [activity, total] = await Promise.all([
            database.getActivityData(minutes),
            database.getTotalContainersInPeriod(minutes)
        ]);
        res.json({ activity, totalContainersInPeriod: total, timeRange: `${minutes} minutes` });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch activity data' });
    }
});

app.get('/api/search', async (req, res) => {
    try {
        const q = req.query.q || '';
        if (!q) return res.json({ containers: [] });
        const containers = await database.searchContainers(q);
        res.json({ containers });
    } catch (err) {
        res.status(500).json({ error: 'Failed to search containers' });
    }
});

// ================= INGESTION ENDPOINTS =================
// Astrocast JSON callback
app.post('/astrocast-callback', (req, res) => {
    try {
        const { data, guid } = req.body;
        if (!data) return res.status(400).json({ error: 'Missing data field' });

        const compressedData = Buffer.from(data, 'base64');
        if (compressedData.length === 0) return res.status(400).json({ error: 'Empty payload' });

        messageQueue.add({ compressedData, receivedAt: Date.now(), size: compressedData.length });
        console.log(`Astrocast msg received (${compressedData.length} bytes) guid=${guid || 'n/a'}`);
        res.json({ status: 'astrocast-received', size: compressedData.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Raw binary container-data
app.post('/container-data', (req, res) => {
    try {
        const compressedData = req.body;
        if (!Buffer.isBuffer(compressedData)) return res.status(400).json({ error: 'Invalid data format' });
        if (compressedData.length === 0) return res.status(400).json({ error: 'Empty payload' });

        messageQueue.add({ compressedData, receivedAt: Date.now(), size: compressedData.length });
        res.json({ status: 'received', size: compressedData.length, queueSize: messageQueue.queue.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ================= ERROR HANDLING =================
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: err.message });
});
app.use((req, res) => {
    res.status(404).json({ error: `Endpoint ${req.method} ${req.path} not found` });
});

// ================= SHUTDOWN =================
process.on('SIGINT', () => {
    console.log('Shutting down gracefully...');
    if (database) database.close();
    process.exit(0);
});

// ================= START SERVER =================
async function startServer() {
    await initializeProtobuf();
    app.listen(CONFIG.PORT, () => {
        console.log('='.repeat(60));
        console.log(`Server running on port ${CONFIG.PORT}`);
        console.log(`Dashboard: http://localhost:${CONFIG.PORT}/dashboard`);
        console.log(`Binary endpoint: POST /container-data`);
        console.log(`Astrocast callback: POST /astrocast-callback`);
        console.log(`Health: GET /health`);
        console.log('='.repeat(60));
    });
}
startServer().catch(console.error);

module.exports = app;
