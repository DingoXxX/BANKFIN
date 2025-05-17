import { TransactionStore } from './storage.js';

class RequestQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.rateLimit = 1000; // 1 second between requests
    this.lastRequest = 0;
  }

  async add(request) {
    return new Promise((resolve, reject) => {
      this.queue.push({ request, resolve, reject });
      this.process();
    });
  }

  async process() {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequest;
      
      if (timeSinceLastRequest < this.rateLimit) {
        await new Promise(resolve => 
          setTimeout(resolve, this.rateLimit - timeSinceLastRequest)
        );
      }

      const { request, resolve, reject } = this.queue.shift();
      try {
        const response = await request();
        resolve(response);
      } catch (error) {
        reject(error);
      }
      
      this.lastRequest = Date.now();
    }

    this.processing = false;
  }
}

export class BankfinUI {
  constructor() {
    this.apiBaseUrl = 'http://localhost:8000';
    this.requestQueue = new RequestQueue();
    this.tokenRefreshPromise = null;
    this.transactionStore = new TransactionStore();
    this.init();
    this.checkAuth();
  }

  async init() {
    await this.transactionStore.init();
    await this.syncPendingTransactions();
    
    document.getElementById('startButton')?.addEventListener('click', () => {
      this.showLoginForm();
    });

    const container = document.querySelector('.container');
    container.innerHTML += `
      <p>New user? <a href="#" id="registerLink">Register here</a></p>
    `;

    document.getElementById('registerLink')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.showRegistrationForm();
    });

    window.addEventListener('online', this.syncPendingTransactions.bind(this));
  }

  checkAuth() {
    const token = localStorage.getItem('access_token');
    if (token) {
      this.fetchUserData().catch(() => this.showLoginForm());
    }
  }

  async refreshToken() {
    try {
      const response = await fetch(`${this.apiBaseUrl}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const data = await response.json();
      localStorage.setItem('access_token', data.access_token);
      return data.access_token;
    } catch (err) {
      localStorage.removeItem('access_token');
      this.showLoginForm();
      throw err;
    }
  }

  async fetchWithAuth(url, options = {}) {
    const request = async () => {
      try {
        const token = localStorage.getItem('access_token');
        if (!token) throw new Error('No token found');

        const response = await fetch(url, {
          ...options,
          headers: {
            ...options.headers,
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.status === 401) {
          if (!this.tokenRefreshPromise) {
            this.tokenRefreshPromise = this.refreshToken();
          }
          
          const newToken = await this.tokenRefreshPromise;
          this.tokenRefreshPromise = null;

          return fetch(url, {
            ...options,
            headers: {
              ...options.headers,
              'Authorization': `Bearer ${newToken}`
            }
          });
        }

        return response;
      } catch (error) {
        if (error.message === 'Token refresh failed') {
          this.handleLogout();
        }
        throw error;
      }
    };

    return this.requestQueue.add(request);
  }

  showLoginForm() {
    const container = document.querySelector('.container');
    container.innerHTML = `
      <h2>Login to Bankfin</h2>
      <form id="loginForm">
        <input type="email" id="email" placeholder="Email" required />
        <input type="password" id="password" placeholder="Password" required />
        <button type="submit">Login</button>
      </form>
    `;
    document.getElementById('loginForm').addEventListener('submit', this.handleLogin.bind(this));
  }

  async handleLogin(event) {
    event.preventDefault();
    const form = event.target;
    const submitButton = form.querySelector('button[type="submit"]');
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    try {
      this.setLoading(submitButton, true);
      const response = await fetch(`${this.apiBaseUrl}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Login failed');
      }

      const data = await response.json();
      if (data.access_token) {
        localStorage.setItem('access_token', data.access_token);
        await this.fetchUserData();
        this.showToast('Login successful!');
      } else {
        throw new Error('Invalid server response');
      }
    } catch (err) {
      this.showToast(err.message, 'error');
    } finally {
      this.setLoading(submitButton, false);
    }
  }

  async fetchUserData() {
    try {
      const response = await this.fetchWithAuth(`${this.apiBaseUrl}/accounts/profile`);

      if (!response.ok) {
        throw new Error('Failed to fetch user data');
      }

      const userData = await response.json();
      this.showDashboard(userData);
    } catch (err) {
      this.showError('Failed to load user data');
      localStorage.removeItem('access_token');
      this.showLoginForm();
    }
  }

  showDashboard(userData) {
    const container = document.querySelector('.container');
    container.innerHTML = `
      <nav class="dashboard-nav">
        <h2>Welcome ${userData.full_name || 'User'}</h2>
        ${this.renderKycStatus(userData.kyc_status)}
        <div class="nav-controls">
          <button id="menuToggle" class="menu-toggle">☰</button>
          <div class="nav-menu">
            <button id="accountSettingsBtn">Settings</button>
            <button id="exportBtn">Export Data</button>
            <button id="logoutBtn">Logout</button>
          </div>
        </div>
      </nav>
      <div class="dashboard-content">
        <div class="balance-card">
          <h3>Current Balance</h3>
          <div id="balance">$${userData.balance?.toFixed(2) || '0.00'}</div>
        </div>
        <div class="summary-card">
          <h3>Monthly Summary</h3>
          <div id="monthlyChart" class="chart-container">
            <canvas></canvas>
          </div>
        </div>
        <div class="actions">
          <button id="depositBtn">Make Deposit</button>
          <button id="transferBtn">Transfer Money</button>
        </div>
        <div class="transactions">
          <h3>Recent Activity</h3>
          <div id="transactionsList">Loading...</div>
        </div>
      </div>
    `;

    this.setupDashboardHandlers();
    this.setupMobileMenu();
    this.loadTransactions();
    this.loadTransactionChart();
  }

  renderKycStatus(status) {
    const statusColors = {
      pending: '#f1c40f',
      verified: '#2ecc71',
      failed: '#e74c3c'
    };
    
    return `
      <div class="kyc-status" style="color: ${statusColors[status] || '#95a5a6'}">
        <span class="status-dot" style="background-color: ${statusColors[status] || '#95a5a6'}"></span>
        KYC Status: ${status || 'unknown'}
        ${status === 'failed' ? '<button id="retryKyc">Retry Verification</button>' : ''}
      </div>
    `;
  }

  async handleKycRetry() {
    try {
      const response = await this.fetchWithAuth(`${this.apiBaseUrl}/auth/kyc-retry`, {
        method: 'POST'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'KYC retry failed');
      }

      this.showToast('KYC verification process restarted');
      await this.fetchUserData();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  async loadTransactionChart() {
    try {
      const response = await this.fetchWithAuth(`${this.apiBaseUrl}/transactions/summary`);
      if (!response.ok) throw new Error('Failed to load transaction summary');

      const data = await response.json();
      this.renderTransactionChart(data);
    } catch (err) {
      console.error('Failed to load transaction chart:', err);
    }
  }

  renderTransactionChart(data) {
    const canvas = document.querySelector('#monthlyChart canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.labels,
        datasets: [{
          label: 'Balance',
          data: data.balances,
          borderColor: '#2ecc71',
          tension: 0.4,
          fill: true,
          backgroundColor: 'rgba(46, 204, 113, 0.1)'
        }, {
          label: 'Transactions',
          data: data.transactions,
          borderColor: '#3498db',
          tension: 0.4,
          fill: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top'
          },
          tooltip: {
            mode: 'index',
            intersect: false,
            callbacks: {
              label: function(context) {
                let label = context.dataset.label || '';
                if (label) label += ': ';
                if (context.parsed.y !== null) {
                  label += new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD'
                  }).format(context.parsed.y);
                }
                return label;
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: function(value) {
                return new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: 'USD',
                  minimumFractionDigits: 0
                }).format(value);
              }
            }
          }
        }
      }
    });
  }

  setupDashboardHandlers() {
    document.getElementById('logoutBtn')?.addEventListener('click', () => this.handleLogout());
    document.getElementById('depositBtn')?.addEventListener('click', () => this.showDepositForm());
    document.getElementById('transferBtn')?.addEventListener('click', () => this.showTransferForm());
    document.getElementById('accountSettingsBtn')?.addEventListener('click', () => this.showAccountSettings());
    document.getElementById('exportBtn')?.addEventListener('click', () => this.exportTransactionData());
  }

  setupMobileMenu() {
    const menuToggle = document.getElementById('menuToggle');
    const navMenu = document.querySelector('.nav-menu');
    
    menuToggle?.addEventListener('click', () => {
      navMenu.classList.toggle('show');
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.nav-controls')) {
        navMenu.classList.remove('show');
      }
    });
  }

  async loadTransactions(page = 1, filter = '') {
    try {
      const response = await this.fetchWithAuth(
        `${this.apiBaseUrl}/transactions?page=${page}&filter=${filter}`
      );

      if (!response.ok) throw new Error('Failed to load transactions');

      const { transactions, total_pages } = await response.json();
      const transactionsList = document.getElementById('transactionsList');
      
      if (transactions.length === 0) {
        transactionsList.innerHTML = '<p>No transactions found</p>';
        return;
      }

      transactionsList.innerHTML = `
        <div class="transactions-filter">
          <select id="transFilter">
            <option value="">All Transactions</option>
            <option value="deposit">Deposits Only</option>
            <option value="transfer">Transfers Only</option>
          </select>
        </div>
        ${transactions.map(t => `
          <div class="transaction">
            <span class="date">${new Date(t.timestamp).toLocaleDateString()}</span>
            <span class="type">${t.type}</span>
            <span class="amount ${t.type === 'deposit' ? 'positive' : ''}">${
              t.type === 'deposit' ? '+' : '-'}$${t.amount.toFixed(2)}</span>
            <button class="receipt-btn" data-id="${t.id}">Receipt</button>
          </div>
        `).join('')}
        <div class="pagination">
          ${this.generatePaginationControls(page, total_pages)}
        </div>
      `;

      this.setupTransactionHandlers(page);
    } catch (err) {
      document.getElementById('transactionsList').innerHTML = 
        '<p class="error">Failed to load transactions</p>';
    }
  }

  generatePaginationControls(currentPage, totalPages) {
    if (totalPages <= 1) return '';
    
    let controls = '';
    if (currentPage > 1) {
      controls += `<button class="page-btn" data-page="${currentPage - 1}">Previous</button>`;
    }
    
    for (let i = Math.max(1, currentPage - 2); i <= Math.min(totalPages, currentPage + 2); i++) {
      controls += `
        <button class="page-btn ${i === currentPage ? 'current' : ''}" 
          data-page="${i}">${i}</button>
      `;
    }
    
    if (currentPage < totalPages) {
      controls += `<button class="page-btn" data-page="${currentPage + 1}">Next</button>`;
    }
    
    return controls;
  }

  setupTransactionHandlers(currentPage) {
    document.querySelectorAll('.page-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const filter = document.getElementById('transFilter').value;
        this.loadTransactions(parseInt(btn.dataset.page), filter);
      });
    });

    document.getElementById('transFilter').addEventListener('change', (e) => {
      this.loadTransactions(1, e.target.value);
    });

    document.querySelectorAll('.receipt-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.generateTransactionReceipt(btn.dataset.id);
      });
    });
  }

  handleLogout() {
    localStorage.removeItem('access_token');
    this.showLoginForm();
  }

  showError(msg) {
    const error = document.createElement('div');
    error.className = 'error';
    error.textContent = msg;
    document.querySelector('.container').appendChild(error);
  }

  showDepositForm() {
    const container = document.querySelector('.container');
    container.innerHTML = `
      <div class="form-container">
        <h2>Make a Deposit</h2>
        <form id="depositForm">
          <input type="number" id="amount" min="0.01" step="0.01" placeholder="Amount" required />
          <button type="submit">Deposit</button>
          <button type="button" id="cancelDeposit">Cancel</button>
        </form>
      </div>
    `;
    
    document.getElementById('depositForm').addEventListener('submit', this.handleDeposit.bind(this));
    document.getElementById('cancelDeposit').addEventListener('click', () => this.fetchUserData());
  }

  validateTransactionAmount(amount) {
    if (isNaN(amount) || amount <= 0) {
      throw new Error('Amount must be a positive number');
    }
    if (amount > 1000000) {
      throw new Error('Amount exceeds maximum transaction limit');
    }
    return parseFloat(amount.toFixed(2));
  }

  validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!re.test(email)) {
      throw new Error('Invalid email format');
    }
    return email.toLowerCase();
  }

  async handleDeposit(event) {
    event.preventDefault();
    const form = event.target;
    const submitButton = form.querySelector('button[type="submit"]');
    const amount = parseFloat(document.getElementById('amount').value);

    try {
      this.setLoading(submitButton, true);

      if (!navigator.onLine) {
        await this.transactionStore.addPendingTransaction({
          type: 'deposit',
          amount
        });
        this.showToast('Deposit will be processed when back online', 'warning');
        return;
      }

      await this.processDeposit(amount);
      this.showToast('Deposit successful!');
    } catch (err) {
      this.showToast(err.message, 'error');
    } finally {
      this.setLoading(submitButton, false);
    }
  }

  async processDeposit(amount) {
    const response = await this.fetchWithAuth(`${this.apiBaseUrl}/deposit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Deposit failed');
    }

    await this.fetchUserData();
  }

  showTransferForm() {
    const container = document.querySelector('.container');
    container.innerHTML = `
      <div class="form-container">
        <h2>Transfer Money</h2>
        <form id="transferForm">
          <input type="email" id="recipient" placeholder="Recipient Email" required />
          <input type="number" id="amount" min="0.01" step="0.01" placeholder="Amount" required />
          <button type="submit">Transfer</button>
          <button type="button" id="cancelTransfer">Cancel</button>
        </form>
      </div>
    `;
    
    document.getElementById('transferForm').addEventListener('submit', this.handleTransfer.bind(this));
    document.getElementById('cancelTransfer').addEventListener('click', () => this.fetchUserData());
  }

  async handleTransfer(event) {
    event.preventDefault();
    const form = event.target;
    const submitButton = form.querySelector('button[type="submit"]');
    
    try {
      this.setLoading(submitButton, true);
      const amount = this.validateTransactionAmount(
        parseFloat(document.getElementById('amount').value)
      );
      const recipient = this.validateEmail(
        document.getElementById('recipient').value
      );

      if (!navigator.onLine) {
        await this.transactionStore.addPendingTransaction({
          type: 'transfer',
          amount,
          recipient
        });
        this.showToast('Transfer will be processed when back online', 'warning');
        return;
      }

      await this.processTransfer(amount, recipient);
      this.showToast(`Successfully transferred $${amount} to ${recipient}`);
    } catch (err) {
      this.showToast(err.message, 'error');
    } finally {
      this.setLoading(submitButton, false);
    }
  }

  async processTransfer(amount, recipient) {
    const response = await this.fetchWithAuth(`${this.apiBaseUrl}/transactions/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipient_email: recipient, amount })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Transfer failed');
    }

    await this.fetchUserData();
  }

  async syncPendingTransactions() {
    if (!navigator.onLine) return;

    try {
      const pending = await this.transactionStore.getPendingTransactions();
      for (const transaction of pending) {
        try {
          if (transaction.type === 'deposit') {
            await this.processDeposit(transaction.amount);
          } else if (transaction.type === 'transfer') {
            await this.processTransfer(transaction.amount, transaction.recipient);
          }
          await this.transactionStore.removePendingTransaction(transaction.id);
        } catch (err) {
          console.error('Failed to sync transaction:', err);
        }
      }
    } catch (err) {
      console.error('Failed to sync pending transactions:', err);
    }
  }

  showRegistrationForm() {
    const container = document.querySelector('.container');
    container.innerHTML = `
      <h2>Register for Bankfin</h2>
      <form id="registerForm" class="register-form">
        <input type="text" id="fullName" placeholder="Full Name" required />
        <input type="email" id="email" placeholder="Email" required />
        <input type="password" id="password" placeholder="Password" required />
        <input type="password" id="confirmPassword" placeholder="Confirm Password" required />
        <div class="file-upload">
          <label for="idDocument">ID Document:</label>
          <input type="file" id="idDocument" accept=".pdf,.jpg,.jpeg,.png" required />
        </div>
        <button type="submit">Register</button>
        <button type="button" id="backToLogin">Back to Login</button>
      </form>
    `;

    document.getElementById('registerForm').addEventListener('submit', this.handleRegistration.bind(this));
    document.getElementById('backToLogin').addEventListener('click', () => this.showLoginForm());
  }

  async handleRegistration(event) {
    event.preventDefault();
    const formData = new FormData();
    formData.append('full_name', document.getElementById('fullName').value);
    formData.append('email', document.getElementById('email').value);
    formData.append('password', document.getElementById('password').value);
    formData.append('id_document', document.getElementById('idDocument').files[0]);

    try {
      const response = await fetch(`${this.apiBaseUrl}/auth/register`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Registration failed');
      }

      this.showMessage('Registration successful! Please check your email to verify your account.');
      setTimeout(() => this.showLoginForm(), 3000);
    } catch (err) {
      this.showError(err.message || 'Registration failed. Please try again.');
    }
  }

  showAccountSettings() {
    const container = document.querySelector('.container');
    container.innerHTML = `
      <div class="form-container">
        <h2>Account Settings</h2>
        <form id="settingsForm">
          <div class="form-group">
            <label>Full Name</label>
            <input type="text" id="fullName" required>
          </div>
          <div class="form-group">
            <label>Email</label>
            <input type="email" id="email" disabled>
          </div>
          <div class="form-group">
            <label>New Password</label>
            <input type="password" id="newPassword" minlength="8">
          </div>
          <div class="form-group">
            <label>Confirm New Password</label>
            <input type="password" id="confirmPassword">
          </div>
          <button type="submit">Save Changes</button>
          <button type="button" id="backToDashboard">Cancel</button>
        </form>
      </div>
    `;

    this.loadUserSettings();
    document.getElementById('settingsForm').addEventListener('submit', this.handleSettingsUpdate.bind(this));
    document.getElementById('backToDashboard').addEventListener('click', () => this.fetchUserData());
  }

  async loadUserSettings() {
    try {
      const response = await this.fetchWithAuth(`${this.apiBaseUrl}/accounts/profile`);
      if (!response.ok) throw new Error('Failed to load user settings');
      
      const userData = await response.json();
      document.getElementById('fullName').value = userData.full_name || '';
      document.getElementById('email').value = userData.email || '';
    } catch (err) {
      this.showToast('Failed to load user settings', 'error');
    }
  }

  async handleSettingsUpdate(event) {
    event.preventDefault();
    const form = event.target;
    const submitButton = form.querySelector('button[type="submit"]');
    
    try {
      this.setLoading(submitButton, true);
      const updates = {
        full_name: document.getElementById('fullName').value,
      };

      const newPassword = document.getElementById('newPassword').value;
      if (newPassword) {
        if (newPassword !== document.getElementById('confirmPassword').value) {
          throw new Error('Passwords do not match');
        }
        updates.password = newPassword;
      }

      const response = await this.fetchWithAuth(`${this.apiBaseUrl}/accounts/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to update settings');
      }

      this.showToast('Settings updated successfully');
      await this.fetchUserData();
    } catch (err) {
      this.showToast(err.message, 'error');
    } finally {
      this.setLoading(submitButton, false);
    }
  }

  showMessage(msg) {
    const message = document.createElement('div');
    message.className = 'message';
    message.textContent = msg;
    document.querySelector('.container').appendChild(message);
  }

  showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 3000);
  }

  setLoading(element, isLoading) {
    if (isLoading) {
      element.disabled = true;
      element.classList.add('disabled');
      const loader = document.createElement('div');
      loader.className = 'loading';
      element.parentNode.insertBefore(loader, element.nextSibling);
    } else {
      element.disabled = false;
      element.classList.remove('disabled');
      const loader = element.parentNode.querySelector('.loading');
      if (loader) loader.remove();
    }
  }

  async exportTransactionData() {
    try {
      const response = await this.fetchWithAuth(`${this.apiBaseUrl}/transactions/export`);
      if (!response.ok) throw new Error('Failed to export data');

      const transactions = await response.json();
      const csv = this.convertToCSV(transactions);
      this.downloadCSV(csv, 'transactions.csv');
      this.showToast('Data exported successfully');
    } catch (err) {
      this.showToast('Failed to export data', 'error');
    }
  }

  convertToCSV(transactions) {
    const headers = ['Date', 'Type', 'Amount', 'Balance After', 'Description'];
    const rows = transactions.map(t => [
      new Date(t.timestamp).toLocaleString(),
      t.type,
      t.amount.toFixed(2),
      t.balance_after.toFixed(2),
      t.description || ''
    ]);

    return [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
  }

  downloadCSV(csv, filename) {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  async generateTransactionReceipt(transactionId) {
    try {
      const response = await this.fetchWithAuth(
        `${this.apiBaseUrl}/transactions/${transactionId}/receipt`,
        { headers: { Accept: 'application/json' } }
      );

      if (!response.ok) throw new Error('Failed to generate receipt');

      const receipt = await response.json();
      this.showReceipt(receipt);
    } catch (err) {
      this.showToast('Failed to generate receipt', 'error');
    }
  }

  showReceipt(receipt) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content receipt">
        <h3>Transaction Receipt</h3>
        <div class="receipt-content">
          <p><strong>Date:</strong> ${new Date(receipt.timestamp).toLocaleString()}</p>
          <p><strong>Transaction ID:</strong> ${receipt.id}</p>
          <p><strong>Type:</strong> ${receipt.type}</p>
          <p><strong>Amount:</strong> $${receipt.amount.toFixed(2)}</p>
          <p><strong>Status:</strong> ${receipt.status}</p>
          ${receipt.recipient ? `<p><strong>Recipient:</strong> ${receipt.recipient}</p>` : ''}
          <p><strong>Balance After:</strong> $${receipt.balance_after.toFixed(2)}</p>
        </div>
        <div class="receipt-actions">
          <button id="printReceipt">Print</button>
          <button id="closeReceipt">Close</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('printReceipt').addEventListener('click', () => {
      window.print();
    });

    document.getElementById('closeReceipt').addEventListener('click', () => {
      modal.remove();
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
  }
}
