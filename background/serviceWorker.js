/**
 * Service Worker (Background Script)
 * Handles cross-component communication and context registry
 */

// Initialize IndexedDB when service worker starts
const DB_NAME = 'AIContextLinker';
const DB_VERSION = 1;
const STORE_NAME = 'contexts';

let db = null;

/**
 * Initialize the database
 */
async function initDB() {
    if (db) return db;

    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);

        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const database = event.target.result;
            if (!database.objectStoreNames.contains(STORE_NAME)) {
                const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
                store.createIndex('platform', 'platform', { unique: false });
                store.createIndex('createdAt', 'createdAt', { unique: false });
            }
        };
    });
}

/**
 * Get all contexts from storage
 */
async function getAllContexts() {
    await initDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => {
            const results = request.result || [];
            results.sort((a, b) => b.createdAt - a.createdAt);
            resolve(results);
        };
        request.onerror = () => reject(request.error);
    });
}

/**
 * Get a specific context
 */
async function getContext(id) {
    await initDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(id);

        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
    });
}

/**
 * Delete a context
 */
async function deleteContext(id) {
    await initDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);

        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
    });
}

/**
 * Update a context
 */
async function updateContext(id, updates) {
    await initDB();

    const context = await getContext(id);
    if (!context) return false;

    const updatedContext = { ...context, ...updates, id: context.id };

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(updatedContext);

        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
    });
}

/**
 * Save a new context
 */
async function saveContext(context) {
    await initDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(context);

        request.onsuccess = () => resolve(context.id);
        request.onerror = () => reject(request.error);
    });
}

/**
 * Handle messages from popup and content scripts
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const handleAsync = async () => {
        try {
            switch (message.action) {
                case 'getAllContexts':
                    return await getAllContexts();

                case 'getContext':
                    return await getContext(message.id);

                case 'deleteContext':
                    return await deleteContext(message.id);

                case 'updateContext':
                    return await updateContext(message.id, message.updates);

                case 'saveContext':
                    return await saveContext(message.context);

                case 'saveCurrentChat':
                    // Send message to content script to extract and save
                    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                    if (tab) {
                        chrome.tabs.sendMessage(tab.id, { action: 'extractAndSave' });
                    }
                    return { success: true };

                default:
                    return { error: 'Unknown action' };
            }
        } catch (error) {
            console.error('[AI Context Linker] Service worker error:', error);
            return { error: error.message };
        }
    };

    handleAsync().then(sendResponse);
    return true; // Keep channel open for async response
});

// Initialize DB on startup
initDB().then(() => {
    console.log('[AI Context Linker] Service worker initialized');
}).catch(err => {
    console.error('[AI Context Linker] Failed to initialize DB:', err);
});
