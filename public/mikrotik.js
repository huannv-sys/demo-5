// MikroTik Controller - Main JavaScript
document.addEventListener('DOMContentLoaded', function() {
    // Global variables
    let isConnected = false;
    let isConnecting = false;
    let autoRefreshInterval = null;
    const autoRefreshTime = 30; // in seconds
    
    // DOM Elements
    const connectBtn = document.getElementById('connectBtn');
    const refreshBtn = document.getElementById('refreshBtn');
    const statusIndicator = document.getElementById('statusIndicator');
    const statusText = document.getElementById('statusText');
    const routerConnectForm = document.getElementById('routerConnectForm');
    const dashboardPanels = document.getElementById('dashboardPanels');
    const connectFormBtn = document.getElementById('connectFormBtn');
    const navItems = document.querySelectorAll('.nav-item');
    const tabContents = document.querySelectorAll('.tab-content');
    const actionStatus = document.getElementById('actionStatus');
    const toastContainer = document.getElementById('toastContainer');
    
    // Connect form inputs
    const routerAddress = document.getElementById('routerAddress');
    const routerPort = document.getElementById('routerPort');
    const routerUsername = document.getElementById('routerUsername');
    const routerPassword = document.getElementById('routerPassword');
    
    // Initialize app
    initApp();
    
    // Event Listeners
    connectBtn.addEventListener('click', toggleConnect);
    refreshBtn.addEventListener('click', refreshData);
    connectFormBtn.addEventListener('click', connectToRouter);
    
    // Navigation
    navItems.forEach(item => {
        item.addEventListener('click', function() {
            // Update active tab
            navItems.forEach(navItem => navItem.classList.remove('active'));
            this.classList.add('active');
            
            // Show corresponding content
            const tabName = this.getAttribute('data-tab');
            tabContents.forEach(content => content.classList.remove('active'));
            document.getElementById(tabName).classList.add('active');
            
            // Load data for the tab if connected
            if (isConnected) {
                loadTabData(tabName);
            }
        });
    });
    
    // Wireless tab navigation
    document.querySelectorAll('[data-wireless-tab]').forEach(tab => {
        tab.addEventListener('click', function() {
            // Update active tab
            document.querySelectorAll('[data-wireless-tab]').forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            
            // Show corresponding content
            const tabName = this.getAttribute('data-wireless-tab');
            document.querySelectorAll('.wireless-tab-content').forEach(c => c.classList.remove('active'));
            document.getElementById('wireless' + tabName.charAt(0).toUpperCase() + tabName.slice(1)).classList.add('active');
        });
    });
    
    // Firewall tab navigation
    document.querySelectorAll('[data-firewall-tab]').forEach(tab => {
        tab.addEventListener('click', function() {
            // Update active tab
            document.querySelectorAll('[data-firewall-tab]').forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            
            // Show corresponding content
            const tabName = this.getAttribute('data-firewall-tab');
            document.querySelectorAll('.firewall-tab-content').forEach(c => c.classList.remove('active'));
            document.getElementById('firewall' + tabName.charAt(0).toUpperCase() + tabName.slice(1)).classList.add('active');
        });
    });
    
    // DHCP tab navigation
    document.querySelectorAll('[data-dhcp-tab]').forEach(tab => {
        tab.addEventListener('click', function() {
            // Update active tab
            document.querySelectorAll('[data-dhcp-tab]').forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            
            // Show corresponding content
            const tabName = this.getAttribute('data-dhcp-tab');
            document.querySelectorAll('.dhcp-tab-content').forEach(c => c.classList.remove('active'));
            document.getElementById('dhcp' + tabName.charAt(0).toUpperCase() + tabName.slice(1)).classList.add('active');
        });
    });
    
    // VPN tab navigation
    document.querySelectorAll('[data-vpn-tab]').forEach(tab => {
        tab.addEventListener('click', function() {
            // Update active tab
            document.querySelectorAll('[data-vpn-tab]').forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            
            // Show corresponding content
            const tabName = this.getAttribute('data-vpn-tab');
            document.querySelectorAll('.vpn-tab-content').forEach(c => c.classList.remove('active'));
            document.getElementById('vpn' + tabName.charAt(0).toUpperCase() + tabName.slice(1)).classList.add('active');
        });
    });
    
    // Refresh logs button
    document.getElementById('refreshLogsBtn')?.addEventListener('click', () => {
        if (isConnected) {
            loadLogs();
        }
    });
    
    // Save settings button
    document.getElementById('saveSettingsBtn')?.addEventListener('click', saveSettings);
    
    // Save notification settings button
    document.getElementById('saveNotificationSettingsBtn')?.addEventListener('click', saveNotificationSettings);
    
    // Save alert settings button
    document.getElementById('saveAlertSettingsBtn')?.addEventListener('click', saveAlertSettings);
    
    // Start scan button
    document.getElementById('startScanBtn')?.addEventListener('click', startWirelessScan);
    
    // Search filter for interfaces
    document.getElementById('interfaceSearch')?.addEventListener('input', function() {
        filterTable('interfacesTableBody', this.value);
    });
    
    // Filter interfaces by type
    document.getElementById('interfaceTypeFilter')?.addEventListener('change', function() {
        filterInterfacesByType(this.value);
    });
    
    // Functions
    function initApp() {
        // Check if there's a saved connection
        checkRouterConnection();
        
        // Initialize settings if available
        loadSettings();
        
        // Set up auto-refresh if enabled
        setupAutoRefresh();
    }
    
    function toggleConnect() {
        if (isConnected) {
            disconnectFromRouter();
        } else {
            // Show connect form
            showConnectForm();
        }
    }
    
    function showConnectForm() {
        routerConnectForm.style.display = 'block';
        dashboardPanels.style.display = 'none';
    }
    
    async function connectToRouter() {
        // Validate form
        if (!routerAddress.value || !routerPort.value || !routerUsername.value) {
            showToast('error', 'Lỗi', 'Vui lòng điền đầy đủ thông tin kết nối.');
            return;
        }
        
        // Update UI
        setConnectingState(true);
        showToast('info', 'Đang kết nối', 'Đang thử kết nối đến router...');
        
        // Prepare connection data
        const connectionData = {
            address: routerAddress.value,
            port: parseInt(routerPort.value),
            username: routerUsername.value,
            password: routerPassword.value
        };
        
        try {
            // Send connection request to API
            const response = await fetch('/api/router/connect', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(connectionData)
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                // Connection successful
                setConnectedState(true);
                showToast('success', 'Kết nối thành công', `Đã kết nối đến ${routerAddress.value}:${routerPort.value}`);
                
                // Hide form, show dashboard
                routerConnectForm.style.display = 'none';
                dashboardPanels.style.display = 'grid';
                
                // Load initial data
                await loadRouterInfo();
                
                // Set up auto-refresh
                setupAutoRefresh();
            } else {
                // Connection failed
                setConnectedState(false);
                showToast('error', 'Kết nối thất bại', data.message || 'Không thể kết nối đến router. Vui lòng kiểm tra thông tin đăng nhập.');
            }
        } catch (error) {
            console.error('Connection error:', error);
            setConnectedState(false);
            showToast('error', 'Lỗi kết nối', 'Không thể kết nối đến router. Vui lòng thử lại sau.');
        }
    }
    
    async function disconnectFromRouter() {
        try {
            const response = await fetch('/api/router/disconnect', {
                method: 'POST'
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                setConnectedState(false);
                showToast('info', 'Đã ngắt kết nối', 'Bạn đã ngắt kết nối khỏi router.');
                
                // Show connect form
                showConnectForm();
                
                // Clear auto-refresh
                clearAutoRefresh();
            } else {
                showToast('error', 'Lỗi', data.message || 'Không thể ngắt kết nối. Vui lòng thử lại.');
            }
        } catch (error) {
            console.error('Disconnect error:', error);
            showToast('error', 'Lỗi', 'Không thể ngắt kết nối. Vui lòng thử lại.');
        }
    }
    
    async function checkRouterConnection() {
        try {
            const response = await fetch('/api/router/status');
            const data = await response.json();
            
            if (response.ok && data.connected) {
                // Already connected
                setConnectedState(true);
                
                // Hide form, show dashboard
                routerConnectForm.style.display = 'none';
                dashboardPanels.style.display = 'grid';
                
                // Load initial data
                await loadRouterInfo();
                
                // Update form with current connection details
                if (data.connection) {
                    routerAddress.value = data.connection.address || '';
                    routerPort.value = data.connection.port || 8728;
                    routerUsername.value = data.connection.username || 'admin';
                    // Password is not returned for security
                }
            }
        } catch (error) {
            console.error('Status check error:', error);
            setConnectedState(false);
        }
    }
    
    async function loadRouterInfo() {
        try {
            // Show loading indicators
            updateActionStatus('Đang tải thông tin router...');
            
            // Load resource information
            await getRouterResources();
            
            // Load interfaces count for dashboard
            await loadNetworkSummary();
            
            // Update active tab content
            const activeTab = document.querySelector('.nav-item.active');
            if (activeTab) {
                loadTabData(activeTab.getAttribute('data-tab'));
            }
            
            updateActionStatus('');
        } catch (error) {
            console.error('Error loading router info:', error);
            updateActionStatus('Lỗi khi tải thông tin router.');
        }
    }
    
    async function getRouterResources() {
        try {
            const response = await fetch('/api/router/resources');
            const data = await response.json();
            
            if (response.ok && data.success) {
                updateUIWithRouterInfo(data.data);
            } else {
                showToast('error', 'Lỗi', 'Không thể tải thông tin tài nguyên router.');
            }
        } catch (error) {
            console.error('Error getting resources:', error);
            showToast('error', 'Lỗi', 'Không thể tải thông tin tài nguyên router.');
        }
    }
    
    function updateUIWithRouterInfo(resourceInfo) {
        // Update system info panel
        document.getElementById('deviceName').textContent = resourceInfo.identity || 'Unknown';
        document.getElementById('deviceModel').textContent = resourceInfo.board || 'Unknown';
        document.getElementById('deviceOsVersion').textContent = resourceInfo.version || 'Unknown';
        document.getElementById('deviceFirmware').textContent = resourceInfo.factory_firmware || 'N/A';
        document.getElementById('deviceUptime').textContent = formatUptime(resourceInfo.uptime) || 'N/A';
        document.getElementById('cpuLoad').textContent = `${resourceInfo.cpu_load || 0}%`;
        document.getElementById('memoryUsage').textContent = `${formatMemory(resourceInfo.free_memory, resourceInfo.total_memory)}`;
        document.getElementById('cpuCount').textContent = resourceInfo.cpu_count || '1';
        
        // Update performance meters
        const cpuPercent = resourceInfo.cpu_load || 0;
        const memoryPercent = calculateMemoryPercent(resourceInfo.free_memory, resourceInfo.total_memory);
        const diskPercent = calculateDiskPercent(resourceInfo.free_hdd_space, resourceInfo.total_hdd_space);
        
        document.getElementById('cpuBar').style.width = `${cpuPercent}%`;
        document.getElementById('cpuBar').textContent = `${cpuPercent}%`;
        document.getElementById('cpuBar').style.backgroundColor = getColorForPercentage(cpuPercent);
        
        document.getElementById('memoryBar').style.width = `${memoryPercent}%`;
        document.getElementById('memoryBar').textContent = `${memoryPercent}%`;
        document.getElementById('memoryBar').style.backgroundColor = getColorForPercentage(memoryPercent);
        
        document.getElementById('hddBar').style.width = `${diskPercent}%`;
        document.getElementById('hddBar').textContent = `${diskPercent}%`;
        document.getElementById('hddBar').style.backgroundColor = getColorForPercentage(diskPercent);
    }
    
    async function loadNetworkSummary() {
        try {
            // Load interfaces count
            const interfacesResponse = await fetch('/api/router/interfaces');
            const interfacesData = await interfacesResponse.json();
            
            if (interfacesResponse.ok && interfacesData.success) {
                document.getElementById('totalInterfaces').textContent = interfacesData.data.length || 0;
            }
            
            // Load wireless clients count
            const wirelessResponse = await fetch('/api/router/wireless/registration-table');
            const wirelessData = await wirelessResponse.json();
            
            if (wirelessResponse.ok && wirelessData.success) {
                document.getElementById('wirelessClients').textContent = wirelessData.data.length || 0;
            }
            
            // Load firewall rules count
            const firewallResponse = await fetch('/api/router/firewall/filter');
            const firewallData = await firewallResponse.json();
            
            if (firewallResponse.ok && firewallData.success) {
                document.getElementById('firewallRules').textContent = firewallData.data.length || 0;
            }
            
            // Load DHCP leases count
            const dhcpResponse = await fetch('/api/router/dhcp/leases');
            const dhcpData = await dhcpResponse.json();
            
            if (dhcpResponse.ok && dhcpData.success) {
                document.getElementById('dhcpLeases').textContent = dhcpData.data.length || 0;
            }
        } catch (error) {
            console.error('Error loading network summary:', error);
        }
    }
    
    function loadTabData(tabName) {
        switch (tabName) {
            case 'interfaces':
                loadInterfaces();
                break;
            case 'wireless':
                loadWirelessInterfaces();
                loadWirelessClients();
                break;
            case 'firewall':
                loadFirewallRules();
                break;
            case 'dhcp':
                loadDhcpServers();
                loadDhcpLeases();
                loadDhcpNetworks();
                break;
            case 'vpn':
                loadVpnInterfaces();
                loadVpnSecrets();
                loadVpnActive();
                break;
            case 'logs':
                loadLogs();
                break;
            case 'settings':
                // Load notification settings
                loadNotificationSettings();
                break;
        }
    }
    
    async function loadInterfaces() {
        // Show loader
        document.getElementById('interfacesLoader').style.display = 'flex';
        document.getElementById('interfacesTableContainer').style.display = 'none';
        document.getElementById('interfacesError').style.display = 'none';
        
        try {
            const response = await fetch('/api/router/interfaces');
            const data = await response.json();
            
            if (response.ok && data.success) {
                // Populate table
                const tableBody = document.getElementById('interfacesTableBody');
                tableBody.innerHTML = '';
                
                data.data.forEach(iface => {
                    const row = document.createElement('tr');
                    
                    // Determine status class
                    const statusClass = iface.running ? 'active' : 'inactive';
                    
                    // Format tx/rx data
                    const txRate = formatBytes(iface.tx_byte_rate || 0) + '/s';
                    const rxRate = formatBytes(iface.rx_byte_rate || 0) + '/s';
                    
                    row.innerHTML = `
                        <td>${iface.name}</td>
                        <td>${iface.type || '-'}</td>
                        <td>${iface.mac_address || '-'}</td>
                        <td><span class="status-badge ${statusClass}">${iface.running ? 'Hoạt động' : 'Không hoạt động'}</span></td>
                        <td>${iface.link_up_down ? iface.link_up_down : '-'}</td>
                        <td>${txRate} / ${rxRate}</td>
                        <td class="action-buttons">
                            <button class="btn btn-primary btn-sm" onclick="viewInterfaceDetails('${iface.name}')">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="btn btn-secondary btn-sm" onclick="toggleInterface('${iface.name}', ${!iface.running})">
                                <i class="fas fa-${iface.running ? 'stop' : 'play'}"></i>
                            </button>
                        </td>
                    `;
                    
                    tableBody.appendChild(row);
                });
                
                // Show table
                document.getElementById('interfacesLoader').style.display = 'none';
                document.getElementById('interfacesTableContainer').style.display = 'block';
            } else {
                throw new Error(data.message || 'Failed to load interfaces');
            }
        } catch (error) {
            console.error('Error loading interfaces:', error);
            document.getElementById('interfacesLoader').style.display = 'none';
            document.getElementById('interfacesError').style.display = 'flex';
        }
    }
    
    async function loadWirelessInterfaces() {
        document.getElementById('wirelessLoader').style.display = 'flex';
        document.getElementById('wirelessContent').style.display = 'none';
        document.getElementById('wirelessError').style.display = 'none';
        
        try {
            const response = await fetch('/api/router/wireless/interfaces');
            const data = await response.json();
            
            if (response.ok && data.success) {
                // Populate table
                const tableBody = document.getElementById('wirelessInterfacesTableBody');
                tableBody.innerHTML = '';
                
                data.data.forEach(iface => {
                    const row = document.createElement('tr');
                    
                    // Determine status
                    const statusClass = iface.running ? 'active' : 'inactive';
                    
                    row.innerHTML = `
                        <td>${iface.name}</td>
                        <td>${iface.ssid || '-'}</td>
                        <td>${iface.channel || '-'}</td>
                        <td>${iface.wireless_standard || '-'}</td>
                        <td>${iface.frequency || '-'}</td>
                        <td>${iface.band || '-'}</td>
                        <td>${iface.security_profile || '-'}</td>
                        <td><span class="status-badge ${statusClass}">${iface.running ? 'Hoạt động' : 'Không hoạt động'}</span></td>
                    `;
                    
                    tableBody.appendChild(row);
                });
                
                // Show content
                document.getElementById('wirelessLoader').style.display = 'none';
                document.getElementById('wirelessContent').style.display = 'block';
            } else {
                throw new Error(data.message || 'Failed to load wireless interfaces');
            }
        } catch (error) {
            console.error('Error loading wireless interfaces:', error);
            document.getElementById('wirelessLoader').style.display = 'none';
            document.getElementById('wirelessError').style.display = 'flex';
        }
    }
    
    async function loadWirelessClients() {
        try {
            const response = await fetch('/api/router/wireless/registration-table');
            const data = await response.json();
            
            if (response.ok && data.success) {
                // Populate table
                const tableBody = document.getElementById('wirelessClientsTableBody');
                tableBody.innerHTML = '';
                
                data.data.forEach(client => {
                    const row = document.createElement('tr');
                    
                    row.innerHTML = `
                        <td>${client.mac_address || '-'}</td>
                        <td>${client.interface || '-'}</td>
                        <td>${client.ssid || '-'}</td>
                        <td>${client.signal_strength || '-'} dBm</td>
                        <td>${client.tx_rate || '0'} / ${client.rx_rate || '0'} Mbps</td>
                        <td>${formatUptime(client.uptime) || '-'}</td>
                        <td>${client.ip || '-'}</td>
                    `;
                    
                    tableBody.appendChild(row);
                });
            } else {
                console.error('Failed to load wireless clients:', data.message);
            }
        } catch (error) {
            console.error('Error loading wireless clients:', error);
        }
    }
    
    async function startWirelessScan() {
        try {
            // Update scan status
            document.getElementById('scanStatusText').textContent = 'Đang quét...';
            
            // Clear previous results
            document.getElementById('wirelessScanTableBody').innerHTML = '';
            
            // Start scan
            const startResponse = await fetch('/api/router/wireless/scan', { method: 'POST' });
            const startData = await startResponse.json();
            
            if (!startResponse.ok || !startData.success) {
                throw new Error(startData.message || 'Failed to start scan');
            }
            
            // Wait for scan to complete (poll every 2 seconds)
            let scanComplete = false;
            let retries = 0;
            const maxRetries = 15; // 30 seconds max
            
            while (!scanComplete && retries < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                const scanResponse = await fetch('/api/router/wireless/scan-results');
                const scanData = await scanResponse.json();
                
                if (scanResponse.ok && scanData.success) {
                    // Check if scan is complete
                    if (scanData.data && scanData.data.length > 0) {
                        scanComplete = true;
                        
                        // Populate table
                        const tableBody = document.getElementById('wirelessScanTableBody');
                        tableBody.innerHTML = '';
                        
                        scanData.data.forEach(network => {
                            const row = document.createElement('tr');
                            
                            // Format signal strength as percentage
                            const signalStrength = network.signal_strength || '-120';
                            const signalPercent = Math.max(0, Math.min(100, Math.round((parseInt(signalStrength) + 100) * 1.25)));
                            
                            row.innerHTML = `
                                <td>${network.ssid || '<hidden>'}</td>
                                <td>${network.bssid || '-'}</td>
                                <td>${network.channel || '-'}</td>
                                <td>${network.frequency || '-'}</td>
                                <td>${signalStrength} dBm (${signalPercent}%)</td>
                                <td>${network.security || '-'}</td>
                            `;
                            
                            tableBody.appendChild(row);
                        });
                        
                        // Update scan status
                        document.getElementById('scanStatusText').textContent = 'Quét hoàn tất';
                    }
                }
                
                retries++;
            }
            
            if (!scanComplete) {
                document.getElementById('scanStatusText').textContent = 'Quét không thành công hoặc hết thời gian';
            }
        } catch (error) {
            console.error('Error during wireless scan:', error);
            document.getElementById('scanStatusText').textContent = 'Lỗi khi quét';
        }
    }
    
    async function loadFirewallRules() {
        document.getElementById('firewallLoader').style.display = 'flex';
        document.getElementById('firewallContent').style.display = 'none';
        document.getElementById('firewallError').style.display = 'none';
        
        try {
            // Load filter rules
            const filterResponse = await fetch('/api/router/firewall/filter');
            const filterData = await filterResponse.json();
            
            if (filterResponse.ok && filterData.success) {
                // Populate filter table
                const tableBody = document.getElementById('firewallFilterTableBody');
                tableBody.innerHTML = '';
                
                filterData.data.forEach(rule => {
                    const row = document.createElement('tr');
                    
                    // Determine action class
                    const actionClass = rule.action === 'drop' || rule.action === 'reject' ? 'danger' : 
                                      rule.action === 'accept' ? 'success' : 'warning';
                    
                    row.innerHTML = `
                        <td>${rule.chain || '-'}</td>
                        <td><span class="status-badge ${actionClass}">${rule.action || '-'}</span></td>
                        <td>${rule.src_address || '-'}</td>
                        <td>${rule.dst_address || '-'}</td>
                        <td>${rule.protocol || '-'}</td>
                        <td>${rule.dst_port || '-'}</td>
                        <td>${rule.comment || '-'}</td>
                    `;
                    
                    tableBody.appendChild(row);
                });
            }
            
            // Load NAT rules
            const natResponse = await fetch('/api/router/firewall/nat');
            const natData = await natResponse.json();
            
            if (natResponse.ok && natData.success) {
                // Populate NAT table
                const tableBody = document.getElementById('firewallNatTableBody');
                tableBody.innerHTML = '';
                
                natData.data.forEach(rule => {
                    const row = document.createElement('tr');
                    
                    row.innerHTML = `
                        <td>${rule.chain || '-'}</td>
                        <td>${rule.action || '-'}</td>
                        <td>${rule.src_address || '-'}</td>
                        <td>${rule.dst_address || '-'}</td>
                        <td>${rule.protocol || '-'}</td>
                        <td>${rule.dst_port || '-'}</td>
                        <td>${rule.to_addresses || '-'}</td>
                        <td>${rule.to_ports || '-'}</td>
                    `;
                    
                    tableBody.appendChild(row);
                });
            }
            
            // Load mangle rules
            const mangleResponse = await fetch('/api/router/firewall/mangle');
            const mangleData = await mangleResponse.json();
            
            if (mangleResponse.ok && mangleData.success) {
                // Populate mangle table
                const tableBody = document.getElementById('firewallMangleTableBody');
                tableBody.innerHTML = '';
                
                mangleData.data.forEach(rule => {
                    const row = document.createElement('tr');
                    
                    row.innerHTML = `
                        <td>${rule.chain || '-'}</td>
                        <td>${rule.action || '-'}</td>
                        <td>${rule.src_address || '-'}</td>
                        <td>${rule.dst_address || '-'}</td>
                        <td>${rule.protocol || '-'}</td>
                        <td>${rule.new_packet_mark || rule.packet_mark || '-'}</td>
                        <td>${rule.comment || '-'}</td>
                    `;
                    
                    tableBody.appendChild(row);
                });
            }
            
            // Show content
            document.getElementById('firewallLoader').style.display = 'none';
            document.getElementById('firewallContent').style.display = 'block';
        } catch (error) {
            console.error('Error loading firewall rules:', error);
            document.getElementById('firewallLoader').style.display = 'none';
            document.getElementById('firewallError').style.display = 'flex';
        }
    }
    
    async function loadDhcpServers() {
        document.getElementById('dhcpLoader').style.display = 'flex';
        document.getElementById('dhcpContent').style.display = 'none';
        document.getElementById('dhcpError').style.display = 'none';
        
        try {
            const response = await fetch('/api/router/dhcp/servers');
            const data = await response.json();
            
            if (response.ok && data.success) {
                // Populate table
                const tableBody = document.getElementById('dhcpServersTableBody');
                tableBody.innerHTML = '';
                
                data.data.forEach(server => {
                    const row = document.createElement('tr');
                    
                    // Determine status
                    const statusClass = server.disabled === 'false' ? 'active' : 'inactive';
                    
                    row.innerHTML = `
                        <td>${server.name || '-'}</td>
                        <td>${server.interface || '-'}</td>
                        <td>${server.address_pool || '-'}</td>
                        <td>${server.gateway || '-'}</td>
                        <td>${server.address_pool || '-'}</td>
                        <td>${server.lease_time || '-'}</td>
                        <td><span class="status-badge ${statusClass}">${server.disabled === 'false' ? 'Hoạt động' : 'Không hoạt động'}</span></td>
                    `;
                    
                    tableBody.appendChild(row);
                });
                
                // Show content
                document.getElementById('dhcpLoader').style.display = 'none';
                document.getElementById('dhcpContent').style.display = 'block';
            } else {
                throw new Error(data.message || 'Failed to load DHCP servers');
            }
        } catch (error) {
            console.error('Error loading DHCP servers:', error);
            document.getElementById('dhcpLoader').style.display = 'none';
            document.getElementById('dhcpError').style.display = 'flex';
        }
    }
    
    async function loadDhcpLeases() {
        try {
            const response = await fetch('/api/router/dhcp/leases');
            const data = await response.json();
            
            if (response.ok && data.success) {
                // Populate table
                const tableBody = document.getElementById('dhcpLeasesTableBody');
                tableBody.innerHTML = '';
                
                data.data.forEach(lease => {
                    const row = document.createElement('tr');
                    
                    // Determine status
                    const statusClass = lease.status === 'bound' ? 'active' : 
                                       lease.status === 'waiting' ? 'warning' : 'inactive';
                    
                    row.innerHTML = `
                        <td>${lease.mac_address || '-'}</td>
                        <td>${lease.address || '-'}</td>
                        <td>${lease.host_name || '-'}</td>
                        <td>${lease.server || '-'}</td>
                        <td>${formatUptime(lease.uptime) || '-'}</td>
                        <td><span class="status-badge ${statusClass}">${lease.status || '-'}</span></td>
                    `;
                    
                    tableBody.appendChild(row);
                });
            } else {
                console.error('Failed to load DHCP leases:', data.message);
            }
        } catch (error) {
            console.error('Error loading DHCP leases:', error);
        }
    }
    
    async function loadDhcpNetworks() {
        try {
            const response = await fetch('/api/router/dhcp/networks');
            const data = await response.json();
            
            if (response.ok && data.success) {
                // Populate table
                const tableBody = document.getElementById('dhcpNetworksTableBody');
                tableBody.innerHTML = '';
                
                data.data.forEach(network => {
                    const row = document.createElement('tr');
                    
                    row.innerHTML = `
                        <td>${network.address || '-'}</td>
                        <td>${network.gateway || '-'}</td>
                        <td>${network.dns_server || '-'}</td>
                        <td>${network.ntp_server || '-'}</td>
                        <td>${network.domain || '-'}</td>
                    `;
                    
                    tableBody.appendChild(row);
                });
            } else {
                console.error('Failed to load DHCP networks:', data.message);
            }
        } catch (error) {
            console.error('Error loading DHCP networks:', error);
        }
    }
    
    async function loadVpnInterfaces() {
        document.getElementById('vpnLoader').style.display = 'flex';
        document.getElementById('vpnContent').style.display = 'none';
        document.getElementById('vpnError').style.display = 'none';
        
        try {
            const pppoeFetch = fetch('/api/router/vpn/pppoe');
            const l2tpFetch = fetch('/api/router/vpn/l2tp');
            const ppptFetch = fetch('/api/router/vpn/pptp');
            const ovenFetch = fetch('/api/router/vpn/ovpn');
            
            const [pppoeRes, l2tpRes, pptpRes, ovpnRes] = await Promise.all([
                pppoeFetch, l2tpFetch, ppptFetch, ovenFetch
            ]);
            
            const pppoeData = await pppoeRes.json();
            const l2tpData = await l2tpRes.json();
            const pptpData = await pptpRes.json();
            const ovpnData = await ovpnRes.json();
            
            // Populate table
            const tableBody = document.getElementById('vpnInterfacesTableBody');
            tableBody.innerHTML = '';
            
            // Combine all interfaces
            let allInterfaces = [];
            
            if (pppoeRes.ok && pppoeData.success) {
                pppoeData.data.forEach(iface => {
                    allInterfaces.push({
                        ...iface,
                        type: 'PPPoE'
                    });
                });
            }
            
            if (l2tpRes.ok && l2tpData.success) {
                l2tpData.data.forEach(iface => {
                    allInterfaces.push({
                        ...iface,
                        type: 'L2TP'
                    });
                });
            }
            
            if (pptpRes.ok && pptpData.success) {
                pptpData.data.forEach(iface => {
                    allInterfaces.push({
                        ...iface,
                        type: 'PPTP'
                    });
                });
            }
            
            if (ovpnRes.ok && ovpnData.success) {
                ovpnData.data.forEach(iface => {
                    allInterfaces.push({
                        ...iface,
                        type: 'OpenVPN'
                    });
                });
            }
            
            // Render all interfaces
            allInterfaces.forEach(iface => {
                const row = document.createElement('tr');
                
                // Determine status
                const statusClass = iface.running ? 'active' : 'inactive';
                
                row.innerHTML = `
                    <td>${iface.name || '-'}</td>
                    <td>${iface.type || '-'}</td>
                    <td>${iface.disabled === 'false' ? 'Có' : 'Không'}</td>
                    <td>${iface.client_server || 'Máy chủ'}</td>
                    <td>${iface.remote_address || iface.connect_to || '-'}</td>
                    <td>${iface.user || '-'}</td>
                    <td><span class="status-badge ${statusClass}">${iface.running ? 'Hoạt động' : 'Không hoạt động'}</span></td>
                `;
                
                tableBody.appendChild(row);
            });
            
            // Show content
            document.getElementById('vpnLoader').style.display = 'none';
            document.getElementById('vpnContent').style.display = 'block';
        } catch (error) {
            console.error('Error loading VPN interfaces:', error);
            document.getElementById('vpnLoader').style.display = 'none';
            document.getElementById('vpnError').style.display = 'flex';
        }
    }
    
    async function loadVpnSecrets() {
        try {
            const secretsResponse = await fetch('/api/router/vpn/secrets');
            const secretsData = await secretsResponse.json();
            
            if (secretsResponse.ok && secretsData.success) {
                // Populate table
                const tableBody = document.getElementById('vpnSecretsTableBody');
                tableBody.innerHTML = '';
                
                secretsData.data.forEach(secret => {
                    const row = document.createElement('tr');
                    
                    row.innerHTML = `
                        <td>${secret.name || '-'}</td>
                        <td>${secret.service || '-'}</td>
                        <td>${secret.service || '-'}</td>
                        <td>${secret.profile || '-'}</td>
                        <td>${secret.local_address || '-'}</td>
                        <td>${secret.remote_address || '-'}</td>
                    `;
                    
                    tableBody.appendChild(row);
                });
            } else {
                console.error('Failed to load VPN secrets:', secretsData.message);
            }
        } catch (error) {
            console.error('Error loading VPN secrets:', error);
        }
    }
    
    async function loadVpnActive() {
        try {
            const activeResponse = await fetch('/api/router/vpn/active');
            const activeData = await activeResponse.json();
            
            if (activeResponse.ok && activeData.success) {
                // Populate table
                const tableBody = document.getElementById('vpnActiveTableBody');
                tableBody.innerHTML = '';
                
                activeData.data.forEach(connection => {
                    const row = document.createElement('tr');
                    
                    // Format uptime
                    const uptime = formatUptime(connection.uptime);
                    
                    // Format traffic
                    const uploaded = formatBytes(connection.upload || 0);
                    const downloaded = formatBytes(connection.download || 0);
                    
                    row.innerHTML = `
                        <td>${connection.name || '-'}</td>
                        <td>${connection.service || '-'}</td>
                        <td>${connection.interface || '-'}</td>
                        <td>${connection.caller_id || '-'}</td>
                        <td>${connection.address || '-'}</td>
                        <td>${uptime || '-'}</td>
                        <td>${uploaded} / ${downloaded}</td>
                    `;
                    
                    tableBody.appendChild(row);
                });
            } else {
                console.error('Failed to load VPN active connections:', activeData.message);
            }
        } catch (error) {
            console.error('Error loading VPN active connections:', error);
        }
    }
    
    async function loadLogs(limit = 50) {
        document.getElementById('logsLoader').style.display = 'flex';
        document.getElementById('logsContainer').style.display = 'none';
        document.getElementById('logsError').style.display = 'none';
        
        // Get limit from input
        const limitInput = document.getElementById('logLimit');
        if (limitInput) {
            limit = parseInt(limitInput.value) || 50;
        }
        
        // Get topic filter
        const topicFilter = document.getElementById('logTopicFilter').value;
        
        try {
            // Construct query parameters
            const params = new URLSearchParams();
            params.append('limit', limit);
            if (topicFilter !== 'all') {
                params.append('topics', topicFilter);
            }
            
            const response = await fetch(`/api/router/logs?${params.toString()}`);
            const data = await response.json();
            
            if (response.ok && data.success) {
                // Populate table
                const tableBody = document.getElementById('logsTableBody');
                tableBody.innerHTML = '';
                
                data.data.forEach(log => {
                    const row = document.createElement('tr');
                    
                    // Determine log class based on topics
                    let logClass = 'info';
                    if (log.topics.includes('critical')) {
                        logClass = 'critical';
                    } else if (log.topics.includes('error')) {
                        logClass = 'error';
                    } else if (log.topics.includes('warning')) {
                        logClass = 'warning';
                    }
                    
                    row.innerHTML = `
                        <td>${log.time || '-'}</td>
                        <td>${log.topics || '-'}</td>
                        <td class="log-entry ${logClass}">${log.message || '-'}</td>
                    `;
                    
                    tableBody.appendChild(row);
                });
                
                // Show content
                document.getElementById('logsLoader').style.display = 'none';
                document.getElementById('logsContainer').style.display = 'block';
            } else {
                throw new Error(data.message || 'Failed to load logs');
            }
        } catch (error) {
            console.error('Error loading logs:', error);
            document.getElementById('logsLoader').style.display = 'none';
            document.getElementById('logsError').style.display = 'flex';
        }
    }
    
    async function loadNotificationSettings() {
        try {
            const response = await fetch('/api/notifications/config');
            const data = await response.json();
            
            if (response.ok && data.success) {
                // Update email settings
                document.getElementById('emailNotificationsToggle').checked = data.data.email.enabled;
                document.getElementById('emailRecipients').value = data.data.email.recipients.join(', ');
                
                // Update SMS settings
                document.getElementById('smsNotificationsToggle').checked = data.data.sms.enabled;
                document.getElementById('phoneNumbers').value = data.data.sms.recipients.join(', ');
                
                // Update alert thresholds
                document.getElementById('cpuThreshold').value = data.data.thresholds.cpu || 80;
                document.getElementById('memoryThreshold').value = data.data.thresholds.memory || 80;
                document.getElementById('diskThreshold').value = data.data.thresholds.disk || 85;
                document.getElementById('bandwidthThreshold').value = data.data.thresholds.bandwidth || 75;
            } else {
                console.error('Failed to load notification settings:', data.message);
            }
        } catch (error) {
            console.error('Error loading notification settings:', error);
        }
    }
    
    async function saveNotificationSettings() {
        try {
            // Gather email settings
            const emailEnabled = document.getElementById('emailNotificationsToggle').checked;
            const emailRecipients = document.getElementById('emailRecipients').value
                .split(',')
                .map(email => email.trim())
                .filter(email => email);
            
            // Gather SMS settings
            const smsEnabled = document.getElementById('smsNotificationsToggle').checked;
            const phoneNumbers = document.getElementById('phoneNumbers').value
                .split(',')
                .map(phone => phone.trim())
                .filter(phone => phone);
            
            // Prepare data
            const notificationConfig = {
                email: {
                    enabled: emailEnabled,
                    recipients: emailRecipients
                },
                sms: {
                    enabled: smsEnabled,
                    recipients: phoneNumbers
                }
            };
            
            // Send to API
            const response = await fetch('/api/notifications/config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(notificationConfig)
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                showToast('success', 'Đã lưu', 'Cài đặt thông báo đã được lưu thành công.');
            } else {
                throw new Error(data.message || 'Failed to save notification settings');
            }
        } catch (error) {
            console.error('Error saving notification settings:', error);
            showToast('error', 'Lỗi', 'Không thể lưu cài đặt thông báo.');
        }
    }
    
    async function saveAlertSettings() {
        try {
            // Gather threshold settings
            const cpuThreshold = parseInt(document.getElementById('cpuThreshold').value) || 80;
            const memoryThreshold = parseInt(document.getElementById('memoryThreshold').value) || 80;
            const diskThreshold = parseInt(document.getElementById('diskThreshold').value) || 85;
            const bandwidthThreshold = parseInt(document.getElementById('bandwidthThreshold').value) || 75;
            
            // Prepare data
            const alertConfig = {
                thresholds: {
                    cpu: cpuThreshold,
                    memory: memoryThreshold,
                    disk: diskThreshold,
                    bandwidth: bandwidthThreshold
                }
            };
            
            // Send to API
            const response = await fetch('/api/notifications/alert-config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(alertConfig)
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                showToast('success', 'Đã lưu', 'Cài đặt cảnh báo đã được lưu thành công.');
            } else {
                throw new Error(data.message || 'Failed to save alert settings');
            }
        } catch (error) {
            console.error('Error saving alert settings:', error);
            showToast('error', 'Lỗi', 'Không thể lưu cài đặt cảnh báo.');
        }
    }
    
    function loadSettings() {
        // Load from localStorage if available
        const storedSettings = localStorage.getItem('mikrotikSettings');
        
        if (storedSettings) {
            const settings = JSON.parse(storedSettings);
            
            // Update refresh interval
            const refreshInterval = document.getElementById('autoRefreshInterval');
            if (refreshInterval && settings.autoRefreshInterval) {
                refreshInterval.value = settings.autoRefreshInterval;
            }
            
            // Update dark mode
            const darkModeToggle = document.getElementById('darkModeToggle');
            if (darkModeToggle && settings.darkMode !== undefined) {
                darkModeToggle.checked = settings.darkMode;
            }
            
            // Update log retention
            const logRetention = document.getElementById('logRetention');
            if (logRetention && settings.logRetention) {
                logRetention.value = settings.logRetention;
            }
        }
    }
    
    function saveSettings() {
        try {
            // Gather settings
            const autoRefreshInterval = parseInt(document.getElementById('autoRefreshInterval').value) || 30;
            const darkMode = document.getElementById('darkModeToggle').checked;
            const logRetention = parseInt(document.getElementById('logRetention').value) || 7;
            
            // Save to localStorage
            const settings = {
                autoRefreshInterval,
                darkMode,
                logRetention
            };
            
            localStorage.setItem('mikrotikSettings', JSON.stringify(settings));
            
            // Apply settings
            setupAutoRefresh(autoRefreshInterval);
            
            showToast('success', 'Đã lưu', 'Cài đặt đã được lưu thành công.');
        } catch (error) {
            console.error('Error saving settings:', error);
            showToast('error', 'Lỗi', 'Không thể lưu cài đặt.');
        }
    }
    
    // Helper Functions
    function setConnectingState(connecting) {
        isConnecting = connecting;
        
        if (connecting) {
            statusIndicator.classList.remove('connected', 'disconnected');
            statusIndicator.classList.add('connecting');
            statusText.textContent = 'Đang kết nối...';
            connectBtn.disabled = true;
            connectFormBtn.disabled = true;
        } else {
            statusIndicator.classList.remove('connecting');
            connectBtn.disabled = false;
            connectFormBtn.disabled = false;
        }
    }
    
    function setConnectedState(connected) {
        isConnected = connected;
        isConnecting = false;
        
        if (connected) {
            statusIndicator.classList.remove('disconnected', 'connecting');
            statusIndicator.classList.add('connected');
            statusText.textContent = 'Đã kết nối';
            connectBtn.innerHTML = '<i class="fas fa-plug-circle-xmark"></i> Ngắt kết nối';
            connectFormBtn.disabled = false;
        } else {
            statusIndicator.classList.remove('connected', 'connecting');
            statusIndicator.classList.add('disconnected');
            statusText.textContent = 'Chưa kết nối';
            connectBtn.innerHTML = '<i class="fas fa-plug"></i> Kết nối';
            connectFormBtn.disabled = false;
            
            // Clear auto-refresh
            clearAutoRefresh();
        }
    }
    
    function refreshData() {
        if (isConnected) {
            loadRouterInfo();
        }
    }
    
    function setupAutoRefresh(interval) {
        // Clear existing interval
        clearAutoRefresh();
        
        // Get interval from settings or parameter
        const refreshTime = interval || parseInt(document.getElementById('autoRefreshInterval')?.value) || 30;
        
        // Only set up if interval is > 0
        if (refreshTime > 0) {
            autoRefreshInterval = setInterval(() => {
                if (isConnected) {
                    refreshData();
                }
            }, refreshTime * 1000);
        }
    }
    
    function clearAutoRefresh() {
        if (autoRefreshInterval) {
            clearInterval(autoRefreshInterval);
            autoRefreshInterval = null;
        }
    }
    
    function showToast(type, title, message) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        // Icon based on type
        let icon = 'info-circle';
        if (type === 'success') icon = 'check-circle';
        if (type === 'error') icon = 'exclamation-circle';
        if (type === 'warning') icon = 'exclamation-triangle';
        
        toast.innerHTML = `
            <div class="toast-icon">
                <i class="fas fa-${icon}"></i>
            </div>
            <div class="toast-content">
                <div class="toast-title">${title}</div>
                <div class="toast-message">${message}</div>
            </div>
            <div class="toast-close">
                <i class="fas fa-times"></i>
            </div>
        `;
        
        // Add to container
        toastContainer.appendChild(toast);
        
        // Set up close event
        toast.querySelector('.toast-close').addEventListener('click', () => {
            toast.remove();
        });
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (toast.parentNode) {
                toast.remove();
            }
        }, 5000);
    }
    
    function updateActionStatus(message) {
        if (actionStatus) {
            actionStatus.textContent = message;
        }
    }
    
    function filterTable(tableBodyId, searchTerm) {
        const tableBody = document.getElementById(tableBodyId);
        const rows = tableBody.querySelectorAll('tr');
        
        searchTerm = searchTerm.toLowerCase();
        
        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            if (text.includes(searchTerm)) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    }
    
    function filterInterfacesByType(type) {
        const tableBody = document.getElementById('interfacesTableBody');
        const rows = tableBody.querySelectorAll('tr');
        
        rows.forEach(row => {
            const interfaceType = row.querySelector('td:nth-child(2)').textContent.toLowerCase();
            
            if (type === 'all' || interfaceType.includes(type.toLowerCase())) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    }
    
    // Utility functions
    function formatUptime(uptimeStr) {
        if (!uptimeStr) return '-';
        
        // Check if already formatted as 1w2d3h4m5s
        if (uptimeStr.includes('w') || uptimeStr.includes('d') || uptimeStr.includes('h')) {
            return uptimeStr;
        }
        
        // Otherwise, assume it's in seconds
        const uptime = parseInt(uptimeStr);
        if (isNaN(uptime)) return uptimeStr;
        
        const seconds = uptime % 60;
        const minutes = Math.floor(uptime / 60) % 60;
        const hours = Math.floor(uptime / 3600) % 24;
        const days = Math.floor(uptime / 86400) % 7;
        const weeks = Math.floor(uptime / 604800);
        
        let result = '';
        if (weeks > 0) result += weeks + 'w';
        if (days > 0) result += days + 'd';
        if (hours > 0) result += hours + 'h';
        if (minutes > 0) result += minutes + 'm';
        if (seconds > 0 || result === '') result += seconds + 's';
        
        return result;
    }
    
    function formatBytes(bytes, decimals = 2) {
        if (bytes === 0 || bytes === undefined || bytes === null) return '0 B';
        
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
        
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }
    
    function formatMemory(freeMemory, totalMemory) {
        if (!freeMemory || !totalMemory) return '-';
        
        const usedMemory = totalMemory - freeMemory;
        const usedPercent = Math.round((usedMemory / totalMemory) * 100);
        
        return `${formatBytes(usedMemory)} / ${formatBytes(totalMemory)} (${usedPercent}%)`;
    }
    
    function calculateMemoryPercent(freeMemory, totalMemory) {
        if (!freeMemory || !totalMemory) return 0;
        
        const usedMemory = totalMemory - freeMemory;
        return Math.round((usedMemory / totalMemory) * 100);
    }
    
    function calculateDiskPercent(freeSpace, totalSpace) {
        if (!freeSpace || !totalSpace) return 0;
        
        const usedSpace = totalSpace - freeSpace;
        return Math.round((usedSpace / totalSpace) * 100);
    }
    
    function getColorForPercentage(percent) {
        if (percent < 60) return 'var(--success-color)';
        if (percent < 80) return 'var(--warning-color)';
        return 'var(--danger-color)';
    }
    
    // Global functions needed for inline event handlers
    window.viewInterfaceDetails = function(name) {
        // Implement interface details view
        console.log('View details for interface:', name);
    };
    
    window.toggleInterface = function(name, enable) {
        // Implement interface enable/disable
        console.log('Toggle interface:', name, enable ? 'enable' : 'disable');
    };
});