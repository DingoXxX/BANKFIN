export class BankfinAdmin {
    constructor() {
        this.currentView = 'dashboard';
        this.setupEventListeners();
        this.loadDashboard();
    }

    setupEventListeners() {
        document.querySelectorAll('.admin-nav button').forEach(button => {
            button.addEventListener('click', () => {
                this.switchView(button.dataset.view);
                document.querySelector('.admin-nav button.active').classList.remove('active');
                button.classList.add('active');
            });
        });
    }

    async switchView(view) {
        this.currentView = view;
        const contentDiv = document.getElementById('adminContent');
        contentDiv.innerHTML = ''; // Clear current content

        switch (view) {
            case 'dashboard':
                await this.loadDashboard();
                break;
            case 'users':
                await this.loadUsers();
                break;
            case 'transactions':
                await this.loadTransactions();
                break;
            case 'kyc':
                await this.loadKYCRequests();
                break;
            case 'logs':
                await this.loadSystemLogs();
                break;
            case 'settings':
                await this.loadSettings();
                break;
        }
    }

    async loadDashboard() {
        const contentDiv = document.getElementById('adminContent');
        
        // Create stats grid
        const statsHtml = `
            <div class="dashboard-grid">
                <div class="stat-card">
                    <h3>Total Users</h3>
                    <div class="stat-value" id="totalUsers">Loading...</div>
                </div>
                <div class="stat-card">
                    <h3>Total Transactions (24h)</h3>
                    <div class="stat-value" id="totalTransactions">Loading...</div>
                </div>
                <div class="stat-card">
                    <h3>Pending KYC</h3>
                    <div class="stat-value" id="pendingKYC">Loading...</div>
                </div>
                <div class="stat-card">
                    <h3>System Health</h3>
                    <div class="stat-value" id="systemHealth">Loading...</div>
                </div>
            </div>
            <div class="chart-container">
                <canvas id="transactionChart"></canvas>
            </div>
            <div class="chart-container">
                <canvas id="userActivityChart"></canvas>
            </div>
        `;
        
        contentDiv.innerHTML = statsHtml;
        
        // Load actual data
        await this.updateDashboardStats();
        await this.createTransactionChart();
        await this.createUserActivityChart();
    }

    async updateDashboardStats() {
        try {
            const response = await fetch('/api/admin/stats');
            const stats = await response.json();
            
            document.getElementById('totalUsers').textContent = stats.totalUsers;
            document.getElementById('totalTransactions').textContent = stats.transactionsLast24h;
            document.getElementById('pendingKYC').textContent = stats.pendingKYC;
            document.getElementById('systemHealth').textContent = stats.systemHealth;
        } catch (error) {
            console.error('Failed to load dashboard stats:', error);
        }
    }

    async createTransactionChart() {
        try {
            const response = await fetch('/api/admin/transactions/chart');
            const data = await response.json();
            
            new Chart(document.getElementById('transactionChart'), {
                type: 'line',
                data: {
                    labels: data.labels,
                    datasets: [{
                        label: 'Transaction Volume',
                        data: data.values,
                        borderColor: '#3b82f6',
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        title: {
                            display: true,
                            text: 'Transaction Volume (Last 7 Days)'
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Failed to create transaction chart:', error);
        }
    }

    async createUserActivityChart() {
        try {
            const response = await fetch('/api/admin/users/activity');
            const data = await response.json();
            
            new Chart(document.getElementById('userActivityChart'), {
                type: 'bar',
                data: {
                    labels: data.labels,
                    datasets: [{
                        label: 'Active Users',
                        data: data.values,
                        backgroundColor: '#3b82f6'
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        title: {
                            display: true,
                            text: 'Daily Active Users'
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Failed to create user activity chart:', error);
        }
    }

    async loadUsers() {
        const contentDiv = document.getElementById('adminContent');
        
        const usersHtml = `
            <div class="search-bar">
                <input type="text" class="search-input" placeholder="Search users..." id="userSearch">
                <button class="btn btn-primary" id="exportUsers">Export Users</button>
            </div>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Name</th>
                        <th>Email</th>
                        <th>KYC Status</th>
                        <th>Join Date</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody id="userTableBody">
                    <tr><td colspan="6">Loading...</td></tr>
                </tbody>
            </table>
        `;
        
        contentDiv.innerHTML = usersHtml;
        await this.loadUserData();
        
        // Setup search functionality
        document.getElementById('userSearch').addEventListener('input', (e) => {
            this.debounce(() => this.searchUsers(e.target.value), 300);
        });
        
        // Setup export functionality
        document.getElementById('exportUsers').addEventListener('click', () => {
            this.exportUsers();
        });
    }

    async loadUserData() {
        try {
            const response = await fetch('/api/admin/users');
            const users = await response.json();
            
            const tbody = document.getElementById('userTableBody');
            tbody.innerHTML = users.map(user => `
                <tr>
                    <td>${user.id}</td>
                    <td>${user.name}</td>
                    <td>${user.email}</td>
                    <td>
                        <span class="status-badge status-${user.kycStatus.toLowerCase()}">
                            ${user.kycStatus}
                        </span>
                    </td>
                    <td>${new Date(user.joinDate).toLocaleDateString()}</td>
                    <td>
                        <button class="btn btn-secondary" onclick="viewUser('${user.id}')">View</button>
                    </td>
                </tr>
            `).join('');
        } catch (error) {
            console.error('Failed to load users:', error);
        }
    }

    async searchUsers(query) {
        try {
            const response = await fetch(`/api/admin/users/search?q=${encodeURIComponent(query)}`);
            const users = await response.json();
            // Update table with filtered results
            this.updateUserTable(users);
        } catch (error) {
            console.error('Failed to search users:', error);
        }
    }

    async loadTransactions() {
        const contentDiv = document.getElementById('adminContent');
        
        const transactionsHtml = `
            <div class="search-bar">
                <input type="text" class="search-input" placeholder="Search transactions..." id="transactionSearch">
                <button class="btn btn-primary" id="exportTransactions">Export Transactions</button>
            </div>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>User</th>
                        <th>Type</th>
                        <th>Amount</th>
                        <th>Date</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody id="transactionTableBody">
                    <tr><td colspan="7">Loading...</td></tr>
                </tbody>
            </table>
        `;
        
        contentDiv.innerHTML = transactionsHtml;
        await this.loadTransactionData();
    }

    async loadKYCRequests() {
        const contentDiv = document.getElementById('adminContent');
        
        const kycHtml = `
            <div class="search-bar">
                <input type="text" class="search-input" placeholder="Search KYC requests..." id="kycSearch">
            </div>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>User</th>
                        <th>Submission Date</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody id="kycTableBody">
                    <tr><td colspan="5">Loading...</td></tr>
                </tbody>
            </table>
        `;
        
        contentDiv.innerHTML = kycHtml;
        await this.loadKYCData();
    }

    async loadSystemLogs() {
        const contentDiv = document.getElementById('adminContent');
        
        const logsHtml = `
            <div class="search-bar">
                <input type="text" class="search-input" placeholder="Search logs..." id="logSearch">
                <select class="search-input" id="logLevel">
                    <option value="all">All Levels</option>
                    <option value="error">Error</option>
                    <option value="warn">Warning</option>
                    <option value="info">Info</option>
                    <option value="debug">Debug</option>
                </select>
                <button class="btn btn-primary" id="exportLogs">Export Logs</button>
            </div>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Timestamp</th>
                        <th>Level</th>
                        <th>Service</th>
                        <th>Message</th>
                    </tr>
                </thead>
                <tbody id="logTableBody">
                    <tr><td colspan="4">Loading...</td></tr>
                </tbody>
            </table>
        `;
        
        contentDiv.innerHTML = logsHtml;
        await this.loadLogData();
    }

    async loadSettings() {
        const contentDiv = document.getElementById('adminContent');
        
        const settingsHtml = `
            <div class="chart-container">
                <h2>System Settings</h2>
                <form id="settingsForm">
                    <div class="form-group">
                        <label>Transaction Rate Limit (per minute)</label>
                        <input type="number" id="rateLimit" class="search-input" />
                    </div>
                    <div class="form-group">
                        <label>KYC Auto-Approval Threshold</label>
                        <input type="number" id="kycThreshold" class="search-input" />
                    </div>
                    <div class="form-group">
                        <label>System Maintenance Mode</label>
                        <input type="checkbox" id="maintenanceMode" />
                    </div>
                    <button type="submit" class="btn btn-primary">Save Settings</button>
                </form>
            </div>
        `;
        
        contentDiv.innerHTML = settingsHtml;
        await this.loadSettingsData();
        
        document.getElementById('settingsForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveSettings();
        });
    }

    debounce(func, wait) {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    // Helper method to show notifications
    showNotification(message, type = 'info') {
        // Implementation will depend on your notification system
        console.log(`${type}: ${message}`);
    }
}
