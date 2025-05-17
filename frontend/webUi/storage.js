class TransactionStore {
  constructor() {
    this.dbName = 'bankfinDB';
    this.storeName = 'pendingTransactions';
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'id', autoIncrement: true });
        }
      };
    });
  }

  async addPendingTransaction(transaction) {
    const store = this.db
      .transaction(this.storeName, 'readwrite')
      .objectStore(this.storeName);
    
    return new Promise((resolve, reject) => {
      const request = store.add({
        ...transaction,
        timestamp: new Date().toISOString(),
        status: 'pending'
      });
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getPendingTransactions() {
    const store = this.db
      .transaction(this.storeName, 'readonly')
      .objectStore(this.storeName);
    
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async removePendingTransaction(id) {
    const store = this.db
      .transaction(this.storeName, 'readwrite')
      .objectStore(this.storeName);
    
    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}
