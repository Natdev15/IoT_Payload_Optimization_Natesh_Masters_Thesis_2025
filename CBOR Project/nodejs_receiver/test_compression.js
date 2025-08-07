const cbor = require('cbor');
const axios = require('axios');

// Configuration
const SERVER_URL = 'http://localhost:3000';
const TEST_ENDPOINT = '/container-data';

// Pure CBOR compression: direct JSON to CBOR encoding
function cborCompress(data) {
    return cbor.encode(data);
}

// Pure CBOR decompression: direct CBOR decode to JSON
function cborDecompress(compressedData) {
    try {
        // Direct CBOR decompression to JSON object
        const containerData = cbor.decode(compressedData);
        return containerData;
        
    } catch (error) {
        throw new Error(`CBOR decompression failed: ${error.message}`);
    }
}

// Generate test container data (same format as Python)
function generateTestData() {
    const containerId = Math.floor(Math.random() * 999999) + 1;
    const now = new Date();
    const timeStr = now.toLocaleDateString('en-GB', { 
        day: '2-digit', 
        month: '2-digit', 
        year: '2-digit' 
    }).replace(/\//g, '') + ' ' + 
    now.toLocaleTimeString('en-GB', { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit',
        fractionalSecondDigits: 1
    }).replace(/:/g, '');

    return {
        "msisdn": `39360050${Math.floor(Math.random() * 200) + 4800}`,
        "iso6346": `LMCU${containerId.toString().padStart(7, '0')}`,
        "time": timeStr,
        "rssi": (Math.floor(Math.random() * 20) + 15).toString(),
        "cgi": "999-01-1-31D41",
        "ble-m": Math.floor(Math.random() * 2).toString(),
        "bat-soc": (Math.floor(Math.random() * 20) + 80).toString(),
        "acc": `${(-993.9 + Math.random() * 20).toFixed(4)} ${(-27.1 + Math.random() * 10).toFixed(4)} ${(-52.0 + Math.random() * 10).toFixed(4)}`,
        "temperature": (17.0 + Math.random() * 10).toFixed(2),
        "humidity": (71.0 + Math.random() * 20 - 10).toFixed(2),
        "pressure": (1012.4 + Math.random() * 20 - 10).toFixed(4),
        "door": ["D", "O", "C", "T"][Math.floor(Math.random() * 4)],
        "gnss": Math.floor(Math.random() * 2).toString(),
        "latitude": (31.86 + (Math.random() - 0.5) * 0.5).toFixed(4),
        "longitude": (28.74 + (Math.random() - 0.5) * 0.5).toFixed(4),
        "altitude": (49.5 + Math.random() * 20 - 10).toFixed(2),
        "speed": (Math.random() * 40).toFixed(1),
        "heading": (Math.random() * 360).toFixed(2),
        "nsat": (Math.floor(Math.random() * 9) + 4).toString().padStart(2, '0'),
        "hdop": (0.5 + Math.random() * 5).toFixed(1)
    };
}

// Test Pure CBOR compression and decompression
function testCompression() {
    console.log('Testing Pure CBOR Compression...');
    console.log('='.repeat(50));
    
    // Generate test data
    const originalData = generateTestData();
    console.log('Original container data:');
    console.log(JSON.stringify(originalData, null, 2));
    console.log();
    
    // Test Pure CBOR compression
    console.log('Testing Pure CBOR compression...');
    const compressedData = cborCompress(originalData);
    console.log(`Compressed data size: ${compressedData.length} bytes`);
    console.log(`Compressed data (hex): ${compressedData.toString('hex')}`);
    console.log();
    
    // Test Pure CBOR decompression
    console.log('Testing Pure CBOR decompression...');
    try {
        const decompressedData = cborDecompress(compressedData);
        console.log('Decompressed data:');
        console.log(JSON.stringify(decompressedData, null, 2));
        console.log();
        
        // Verify data integrity
        const isEqual = JSON.stringify(originalData) === JSON.stringify(decompressedData);
        console.log(`Data integrity check: ${isEqual ? 'PASS' : 'FAIL'}`);
        
        if (!isEqual) {
            console.log('Original and decompressed data do not match!');
            console.log('Original:', JSON.stringify(originalData));
            console.log('Decompressed:', JSON.stringify(decompressedData));
        }
        
    } catch (error) {
        console.error('Decompression failed:', error.message);
    }
    
    // Compare with JSON
    const jsonString = JSON.stringify(originalData);
    const jsonBytes = Buffer.from(jsonString, 'utf8');
    
    console.log();
    console.log('Size Comparison:');
    console.log(`Original JSON: ${jsonBytes.length} bytes`);
    console.log(`Pure CBOR: ${compressedData.length} bytes`);
    console.log(`Compression ratio: ${(jsonBytes.length / compressedData.length).toFixed(2)}x`);
    console.log(`Size reduction: ${jsonBytes.length - compressedData.length} bytes (${((jsonBytes.length - compressedData.length) / jsonBytes.length * 100).toFixed(1)}%)`);
    
    return {
        originalData,
        compressedData,
        jsonBytes,
        compressionRatio: jsonBytes.length / compressedData.length
    };
}

// Test server endpoint
async function testServerEndpoint(compressedData) {
    console.log();
    console.log('Testing server endpoint...');
    console.log('='.repeat(30));
    
    try {
        const response = await axios.post(`${SERVER_URL}${TEST_ENDPOINT}`, compressedData, {
            headers: {
                'Content-Type': 'application/octet-stream'
            },
            timeout: 10000
        });
        
        console.log('Server response:');
        console.log(`Status: ${response.status}`);
        console.log('Response data:', response.data);
        
        return response.data;
        
    } catch (error) {
        console.error('Server test failed:');
        if (error.response) {
            console.error(`Status: ${error.response.status}`);
            console.error('Response:', error.response.data);
        } else {
            console.error('Error:', error.message);
        }
        return null;
    }
}

// Run all tests
async function runAllTests() {
    console.log('Pure CBOR Compression Test Suite');
    console.log('='.repeat(50));
    console.log(`Server URL: ${SERVER_URL}`);
    console.log(`Test endpoint: ${TEST_ENDPOINT}`);
    console.log(`Date: ${new Date().toISOString()}`);
    console.log();
    
    // Test compression
    const testResults = testCompression();
    
    // Test server endpoint
    const serverResponse = await testServerEndpoint(testResults.compressedData);
    
    // Generate test report
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `pure_cbor_compression_test_nodejs_${timestamp}.txt`;
    
    let output = '';
    output += 'PURE CBOR COMPRESSION TEST RESULTS (Node.js)\n';
    output += '='.repeat(50) + '\n';
    output += `Test Date: ${new Date().toISOString()}\n`;
    output += `Compression Method: Pure CBOR\n`;
    output += `Server URL: ${SERVER_URL}\n`;
    output += `Test Endpoint: ${TEST_ENDPOINT}\n\n`;
    
    output += 'SIZE COMPARISON:\n';
    output += '-'.repeat(30) + '\n';
    output += `Original JSON: ${testResults.jsonBytes.length} bytes\n`;
    output += `Pure CBOR: ${testResults.compressedData.length} bytes\n`;
    output += `Compression ratio: ${testResults.compressionRatio.toFixed(2)}x\n`;
    output += `Size reduction: ${testResults.jsonBytes.length - testResults.compressedData.length} bytes (${((testResults.jsonBytes.length - testResults.compressedData.length) / testResults.jsonBytes.length * 100).toFixed(1)}%)\n\n`;
    
    output += 'ORIGINAL DATA:\n';
    output += '-'.repeat(30) + '\n';
    output += JSON.stringify(testResults.originalData, null, 2) + '\n\n';
    
    output += 'CBOR COMPRESSED DATA:\n';
    output += '-'.repeat(30) + '\n';
    output += `Size: ${testResults.compressedData.length} bytes\n`;
    output += `Hex: ${testResults.compressedData.toString('hex')}\n\n`;
    
    output += 'COMPRESSION ANALYSIS:\n';
    output += '-'.repeat(30) + '\n';
    try {
        const decompressed = cbor.decode(testResults.compressedData);
        output += `Decompressed successfully: YES\n`;
        output += `Decompressed size: ${JSON.stringify(decompressed).length} bytes\n`;
        output += `Compression efficiency: ${(JSON.stringify(decompressed).length / testResults.compressedData.length).toFixed(2)}x\n`;
        output += `Data integrity: ${JSON.stringify(testResults.originalData) === JSON.stringify(decompressed) ? 'PASS' : 'FAIL'}\n`;
    } catch (e) {
        output += `Decompression error: ${e.message}\n`;
    }
    output += '\n';
    
    output += 'SERVER TEST:\n';
    output += '-'.repeat(30) + '\n';
    if (serverResponse) {
        output += `Server response: SUCCESS\n`;
        output += `Status: ${serverResponse.status || 'OK'}\n`;
        output += `Queue size: ${serverResponse.queueSize || 'N/A'}\n`;
        output += `Overall integrity: PASS\n`;
    } else {
        output += `Server response: FAILED\n`;
        output += `Overall integrity: FAIL\n`;
    }
    output += '\n';
    
    output += 'IMPLEMENTATION NOTES:\n';
    output += '-'.repeat(30) + '\n';
    output += 'Pure CBOR approach:\n';
    output += '- Direct JSON to CBOR encoding\n';
    output += '- No delimited strings or field mapping\n';
    output += '- Simple and reliable\n';
    output += '- Standard CBOR format\n';
    output += '- No payload size limits\n';
    output += '\n';
    output += 'ESP32 Implementation:\n';
    output += '- Use tinycbor or libcbor library\n';
    output += '- Direct encoding of JSON structure\n';
    output += '- Simple IoT-friendly code\n';
    output += '\n';
    output += 'Node.js Receiver:\n';
    output += '- Use cbor module for decompression\n';
    output += '- Direct CBOR decode to JSON\n';
    output += '- No field mapping required\n';
    
    // Write to file
    const fs = require('fs');
    fs.writeFileSync(filename, output);
    
    console.log(`Test results saved to: ${filename}`);
    console.log();
    console.log('Test Summary:');
    console.log(`- Compression ratio: ${testResults.compressionRatio.toFixed(2)}x`);
    console.log(`- Size reduction: ${((testResults.jsonBytes.length - testResults.compressedData.length) / testResults.jsonBytes.length * 100).toFixed(1)}%`);
    console.log(`- Server test: ${serverResponse ? 'PASS' : 'FAIL'}`);
    console.log(`- Overall: ${serverResponse ? 'SUCCESS' : 'FAILED'}`);
    
    return {
        compressionRatio: testResults.compressionRatio,
        sizeReduction: (testResults.jsonBytes.length - testResults.compressedData.length) / testResults.jsonBytes.length * 100,
        serverTest: !!serverResponse,
        filename
    };
}

// Run tests if this file is executed directly
if (require.main === module) {
    runAllTests().catch(console.error);
}

module.exports = {
    cborCompress,
    cborDecompress,
    generateTestData,
    testCompression,
    testServerEndpoint,
    runAllTests
}; 