/**
 * Context Database
 * IndexedDB operations for storing and retrieving contexts
 */

const ContextDB = {
    db: null,

    /**
     * Initialize the database
     * @returns {Promise<IDBDatabase>}
     */
    async init() {
        if (this.db) return this.db;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(ContextSchema.DB_NAME, ContextSchema.DB_VERSION);

            request.onerror = () => reject(request.error);

            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                if (!db.objectStoreNames.contains(ContextSchema.STORE_NAME)) {
                    const store = db.createObjectStore(ContextSchema.STORE_NAME, { keyPath: 'id' });
                    store.createIndex('platform', 'platform', { unique: false });
                    store.createIndex('createdAt', 'createdAt', { unique: false });
                }
            };
        });
    },

    /**
     * Save a context
     * @param {Object} context - Context object to save
     * @returns {Promise<string>} Context ID
     */
    async save(context) {
        await this.init();

        if (!ContextSchema.validate(context)) {
            throw new Error('Invalid context object');
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([ContextSchema.STORE_NAME], 'readwrite');
            const store = transaction.objectStore(ContextSchema.STORE_NAME);
            const request = store.put(context);

            request.onsuccess = () => resolve(context.id);
            request.onerror = () => reject(request.error);
        });
    },

    /**
     * Get a context by ID
     * @param {string} id - Context ID
     * @returns {Promise<Object|null>}
     */
    async get(id) {
        await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([ContextSchema.STORE_NAME], 'readonly');
            const store = transaction.objectStore(ContextSchema.STORE_NAME);
            const request = store.get(id);

            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    },

    /**
     * Get all contexts
     * @returns {Promise<Array>}
     */
    async getAll() {
        await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([ContextSchema.STORE_NAME], 'readonly');
            const store = transaction.objectStore(ContextSchema.STORE_NAME);
            const request = store.getAll();

            request.onsuccess = () => {
                // Sort by createdAt descending (newest first)
                const results = request.result || [];
                results.sort((a, b) => b.createdAt - a.createdAt);
                resolve(results);
            };
            request.onerror = () => reject(request.error);
        });
    },

    /**
     * Update a context
     * @param {string} id - Context ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<boolean>}
     */
    async update(id, updates) {
        const context = await this.get(id);
        if (!context) return false;

        const updatedContext = { ...context, ...updates, id: context.id };
        await this.save(updatedContext);
        return true;
    },

    /**
     * Delete a context
     * @param {string} id - Context ID
     * @returns {Promise<boolean>}
     */
    async delete(id) {
        await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([ContextSchema.STORE_NAME], 'readwrite');
            const store = transaction.objectStore(ContextSchema.STORE_NAME);
            const request = store.delete(id);

            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    },

    /**
     * Get contexts by platform
     * @param {string} platform - Platform identifier
     * @returns {Promise<Array>}
     */
    async getByPlatform(platform) {
        await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([ContextSchema.STORE_NAME], 'readonly');
            const store = transaction.objectStore(ContextSchema.STORE_NAME);
            const index = store.index('platform');
            const request = index.getAll(platform);

            request.onsuccess = () => {
                const results = request.result || [];
                results.sort((a, b) => b.createdAt - a.createdAt);
                resolve(results);
            };
            request.onerror = () => reject(request.error);
        });
    }
};

// Make available globally
window.ContextDB = ContextDB;
