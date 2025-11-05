class MaritimeDashboard {
    constructor() {
        this.autoRefresh = false;
        this.refreshInterval = null;
        this.chart = null;
        this.containers = [];
        this.filteredContainers = [];
        
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.loadInitialData();
        this.setupChart();
        
        // Hide loading overlay
        document.getElementById('loadingOverlay').style.display = 'none';
    }

    setupEventListeners() {
        // Refresh button
        document.getElementById('refreshBtn').addEventListener('click', () => {
            this.loadData();
        });

        // Auto refresh toggle
        document.getElementById('autoRefreshBtn').addEventListener('click', () => {
            this.toggleAutoRefresh();
        });

        // Search functionality
        document.getElementById('searchContainer').addEventListener('input', (e) => {
            this.filterContainers(e.target.value);
        });

        // Modal close
        document.getElementById('closeModal').addEventListener('click', () => {
            this.closeModal();
        });

        // Close modal on background click
        document.getElementById('containerModal').addEventListener('click', (e) => {
            if (e.target.id === 'containerModal') {
                this.closeModal();
            }
        });

        // Event delegation for view details buttons
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('view-details-btn')) {
                const containerId = e.target.getAttribute('data-container-id');
                this.showContainerDetails(containerId);
            }
        });
    }

    async loadInitialData() {
        await this.loadData();
        await this.loadStats();
    }

    async loadData() {
        try {
            this.showLoading();
            
            const response = await fetch('/api/containers?limit=100');
            const data = await response.json();
            
            this.containers = data.containers || [];
            this.filteredContainers = [...this.containers];
            
            this.updateContainerTable();
            this.updateChart();
            
        } catch (error) {
            console.error('Error loading container data:', error);
            this.showError('Failed to load container data');
        } finally {
            this.hideLoading();
        }
    }

    async loadStats() {
        try {
            const response = await fetch('/api/stats');
            const stats = await response.json();
            
            this.updateSystemStats(stats);
            this.updateHeaderStats(stats);
            
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    }

    updateSystemStats(stats) {
        document.getElementById('totalRecords').textContent = stats.database?.total_records || 0;
        document.getElementById('uniqueContainers').textContent = stats.database?.unique_containers || 0;
        
        const successRate = stats.database?.total_records > 0 
            ? Math.round((stats.database.sent_to_mobius / stats.database.total_records) * 100)
            : 0;
        document.getElementById('successRate').textContent = `${successRate}%`;
        
        // Calculate average compression from database stats
        const avgCompression = stats.database?.avg_compression || 0;
        const compressionText = avgCompression > 0 ? `${avgCompression.toFixed(2)}x` : 'N/A';
        document.getElementById('avgCompression').textContent = compressionText;
    }

    updateHeaderStats(stats) {
        document.getElementById('totalContainers').textContent = stats.database?.unique_containers || 0;
        document.getElementById('queueLength').textContent = stats.inbound?.queueSize || 0;
        
        const uptime = stats.inbound?.uptimeMs || 0;
        const hours = Math.floor(uptime / (1000 * 60 * 60));
        const minutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60));
        document.getElementById('uptime').textContent = `${hours}h ${minutes}m`;
    }

    updateContainerTable() {
        const tbody = document.getElementById('containerTableBody');
        tbody.innerHTML = '';

        this.filteredContainers.forEach(container => {
            const row = document.createElement('tr');
            
            // Format location
            const location = container.latitude && container.longitude 
                ? `${parseFloat(container.latitude).toFixed(4)}, ${parseFloat(container.longitude).toFixed(4)}`
                : 'N/A';
            
            // Format temperature
            const temperature = container.temperature 
                ? `${parseFloat(container.temperature).toFixed(1)}°C`
                : 'N/A';
            
            // Format battery
            const battery = container.bat_soc 
                ? `${container.bat_soc}%`
                : 'N/A';
            
            // Format status
            const status = container.sent_to_mobius 
                ? '<span class="status-success">✓ Sent</span>'
                : '<span class="status-pending">⏳ Pending</span>';
            
            // Format last update in Rome timezone with 24-hour format
            const lastUpdate = new Date(container.created_at).toLocaleString('en-GB', {
                timeZone: 'Europe/Rome',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
            });
            

            
            row.innerHTML = `
                <td><strong>${container.iso6346 || 'N/A'}</strong></td>
                <td>${location}</td>
                <td>${temperature}</td>
                <td>${battery}</td>
                <td>${status}</td>
                <td>${lastUpdate}</td>
                <td>
                    <button class="btn btn-small view-details-btn" data-container-id="${container.iso6346}">
                        View Details
                    </button>
                </td>
            `;
            
            tbody.appendChild(row);
        });
    }

    async showContainerDetails(containerId) {
        try {
            const response = await fetch(`/api/containers/${containerId}`);
            const data = await response.json();
            
            if (!data.container) {
                this.showError('Container not found');
                return;
            }
            
            const container = data.container;
            const modal = document.getElementById('containerModal');
            const modalTitle = document.getElementById('modalTitle');
            const containerDetails = document.getElementById('containerDetails');
            
            modalTitle.textContent = `Container ${container.iso6346}`;
            
            containerDetails.innerHTML = `
                <div class="details-grid">
                    <div class="detail-section">
                        <h4>Container Information</h4>
                        <div class="detail-item">
                            <span class="detail-label">Container ID:</span>
                            <span class="detail-value">${container.iso6346 || 'N/A'}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">SIM ID:</span>
                            <span class="detail-value">${container.msisdn || 'N/A'}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Time:</span>
                            <span class="detail-value">${container.time || 'N/A'}</span>
                        </div>
                    </div>
                    
                    <div class="detail-section">
                        <h4>Location & Navigation</h4>
                        <div class="detail-item">
                            <span class="detail-label">Latitude:</span>
                            <span class="detail-value">${container.latitude || 'N/A'}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Longitude:</span>
                            <span class="detail-value">${container.longitude || 'N/A'}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Altitude:</span>
                            <span class="detail-value">${container.altitude || 'N/A'} m</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Speed:</span>
                            <span class="detail-value">${container.speed || 'N/A'} m/s</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Heading:</span>
                            <span class="detail-value">${container.heading || 'N/A'}°</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">GPS Status:</span>
                            <span class="detail-value">${container.gnss || 'N/A'}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Satellites:</span>
                            <span class="detail-value">${container.nsat || 'N/A'}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">HDOP:</span>
                            <span class="detail-value">${container.hdop || 'N/A'}</span>
                        </div>
                    </div>
                    
                    <div class="detail-section">
                        <h4>Environmental Sensors</h4>
                        <div class="detail-item">
                            <span class="detail-label">Temperature:</span>
                            <span class="detail-value">${container.temperature || 'N/A'}°C</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Humidity:</span>
                            <span class="detail-value">${container.humidity || 'N/A'}%</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Pressure:</span>
                            <span class="detail-value">${container.pressure || 'N/A'} hPa</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Accelerometer:</span>
                            <span class="detail-value">${container.acc || 'N/A'}</span>
                        </div>
                    </div>
                    
                    <div class="detail-section">
                        <h4>System Status</h4>
                        <div class="detail-item">
                            <span class="detail-label">Battery:</span>
                            <span class="detail-value">${container.bat_soc || 'N/A'}%</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Door Status:</span>
                            <span class="detail-value">${container.door || 'N/A'}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">RSSI:</span>
                            <span class="detail-value">${container.rssi || 'N/A'}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Cell ID:</span>
                            <span class="detail-value">${container.cgi || 'N/A'}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">BLE Node:</span>
                            <span class="detail-value">${container.ble_m || 'N/A'}</span>
                        </div>
                    </div>
                    
                    <div class="detail-section">
                        <h4>Processing Status</h4>
                        <div class="detail-item">
                            <span class="detail-label">Created:</span>
                            <span class="detail-value">${new Date(container.created_at).toLocaleString('en-GB', {
                                timeZone: 'Europe/Rome',
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                                hour12: false
                            })}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Processed:</span>
                            <span class="detail-value">${new Date(container.processed_at).toLocaleString('en-GB', {
                                timeZone: 'Europe/Rome',
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                                hour12: false
                            })}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Mobius Status:</span>
                            <span class="detail-value">${container.sent_to_mobius ? '✓ Sent' : '⏳ Pending'}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Error Count:</span>
                            <span class="detail-value">${container.error_count || 0}</span>
                        </div>
                    </div>
                </div>
            `;
            
            modal.style.display = 'block';
            
        } catch (error) {
            console.error('Error loading container details:', error);
            this.showError('Failed to load container details');
        }
    }

    setupChart() {
        const ctx = document.getElementById('activityChart').getContext('2d');
        
        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Container Count',
                    data: [],
                    borderColor: 'rgb(59, 130, 246)',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 3,
                    tension: 0.4, // Increased tension for smoother wave-like curves
                    fill: true,
                    pointBackgroundColor: 'rgb(59, 130, 246)',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                scales: {
                    x: {
                        display: true,
                        title: {
                            display: true,
                            text: 'Time',
                            color: '#666',
                            font: {
                                size: 12,
                                weight: 'bold'
                            }
                        },
                        ticks: {
                            maxTicksLimit: 48, // Show more ticks for 5-minute intervals
                            color: '#666',
                            font: {
                                size: 10 // Smaller font to fit more labels
                            },
                            callback: function(value, index, values) {
                                // Show every 4th label to avoid overcrowding but maintain 5-minute intervals
                                return index % 4 === 0 ? this.getLabelForValue(value) : '';
                            }
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)',
                            drawBorder: false
                        }
                    },
                    y: {
                        display: true,
                        title: {
                            display: true,
                            text: 'Number of Containers',
                            color: '#666',
                            font: {
                                size: 12,
                                weight: 'bold'
                            }
                        },
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1,
                            color: '#666',
                            callback: function(value) {
                                return Math.round(value);
                            }
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)',
                            drawBorder: false
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            padding: 20,
                            color: '#666',
                            font: {
                                size: 12,
                                weight: 'bold'
                            }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        borderColor: 'rgba(59, 130, 246, 0.5)',
                        borderWidth: 1,
                        cornerRadius: 8,
                        displayColors: false,
                        callbacks: {
                            title: function(context) {
                                return `Time: ${context[0].label}`;
                            },
                            label: function(context) {
                                return `Containers: ${context.parsed.y}`;
                            }
                        }
                    }
                },
                animation: {
                    duration: 1000,
                    easing: 'easeInOutQuart'
                }
            }
        });
        
        this.updateChart();
    }

    async updateChart() {
        try {
            const response = await fetch('/api/activity?minutes=120'); // Get 2 hours of data for better wave visualization
            const data = await response.json();
            
            const labels = data.activity.map(item => {
                const date = new Date(item.hour);
                const timeStr = date.toLocaleTimeString('en-GB', { 
                    hour: '2-digit', 
                    minute: '2-digit',
                    hour12: false, // Use 24-hour format for better readability
                    timeZone: 'Europe/Rome' // Use Rome timezone
                });
                return timeStr;
            });
            
            const values = data.activity.map(item => item.count);
            
            this.chart.data.labels = labels;
            this.chart.data.datasets[0].data = values;
            this.chart.update();
            
            // Update chart title with container count information
            const totalInPeriod = data.totalContainersInPeriod || 0;
            const chartTitle = document.querySelector('.chart-container h3');
            if (chartTitle) {
                chartTitle.textContent = `Container Activity (${totalInPeriod} containers in last 2 hours)`;
            }
            
        } catch (error) {
            console.error('Error updating chart:', error);
        }
    }

    filterContainers(searchTerm) {
        if (!searchTerm.trim()) {
            this.filteredContainers = [...this.containers];
        } else {
            this.filteredContainers = this.containers.filter(container => 
                container.iso6346?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                container.msisdn?.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }
        
        this.updateContainerTable();
    }

    toggleAutoRefresh() {
        this.autoRefresh = !this.autoRefresh;
        const btn = document.getElementById('autoRefreshBtn');
        
        if (this.autoRefresh) {
            btn.textContent = 'Auto Refresh: ON';
            btn.classList.add('btn-active');
            this.refreshInterval = setInterval(() => {
                this.loadData();
                this.loadStats();
                this.updateChart(); // Update chart more frequently for real-time data
            }, 5000); // Refresh every 5 seconds for more real-time updates
        } else {
            btn.textContent = 'Auto Refresh: OFF';
            btn.classList.remove('btn-active');
            if (this.refreshInterval) {
                clearInterval(this.refreshInterval);
                this.refreshInterval = null;
            }
        }
    }

    showLoading() {
        document.getElementById('loadingOverlay').style.display = 'flex';
    }

    hideLoading() {
        document.getElementById('loadingOverlay').style.display = 'none';
    }

    showError(message) {
        // Create a simple error notification
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-notification';
        errorDiv.textContent = message;
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #ff4444;
            color: white;
            padding: 15px 20px;
            border-radius: 5px;
            z-index: 1000;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        `;
        
        document.body.appendChild(errorDiv);
        
        setTimeout(() => {
            errorDiv.remove();
        }, 5000);
    }

    closeModal() {
        document.getElementById('containerModal').style.display = 'none';
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new MaritimeDashboard();
}); 