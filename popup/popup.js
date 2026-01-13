/**
 * Popup Controller
 * Handles all popup UI interactions
 */

class PopupController {
    constructor() {
        this.contexts = [];
        this.selectedContextId = null;

        this.init();
    }

    /**
     * Initialize the popup
     */
    async init() {
        this.bindElements();
        this.bindEvents();
        await this.loadContexts();
    }

    /**
     * Bind DOM elements
     */
    bindElements() {
        // Buttons
        this.saveCurrentBtn = document.getElementById('save-current');
        this.refreshBtn = document.getElementById('refresh-list');

        // Stats
        this.totalCountEl = document.getElementById('total-contexts');
        this.chatgptCountEl = document.getElementById('chatgpt-count');
        this.geminiCountEl = document.getElementById('gemini-count');

        // List
        this.contextsList = document.getElementById('contexts-list');
        this.emptyState = document.getElementById('empty-state');
        this.template = document.getElementById('context-item-template');

        // Modal
        this.renameModal = document.getElementById('rename-modal');
        this.renameInput = document.getElementById('rename-input');
        this.renameCancelBtn = document.getElementById('rename-cancel');
        this.renameSaveBtn = document.getElementById('rename-save');

        // Toast
        this.toastContainer = document.getElementById('toast-container');

        // Settings (Phase 2)
        this.toggleSettingsBtn = document.getElementById('toggle-settings');
        this.settingsPanel = document.getElementById('settings-panel');
        this.buttonVisibilityToggle = document.getElementById('button-visibility-toggle');
        this.tokenLimitSelect = document.getElementById('token-limit-select');
    }

    /**
     * Bind event listeners
     */
    bindEvents() {
        // Quick actions
        this.saveCurrentBtn.addEventListener('click', () => this.saveCurrentChat());
        this.refreshBtn.addEventListener('click', () => this.loadContexts());

        // Modal
        this.renameCancelBtn.addEventListener('click', () => this.closeRenameModal());
        this.renameSaveBtn.addEventListener('click', () => this.saveRename());
        this.renameModal.querySelector('.modal-backdrop').addEventListener('click', () => this.closeRenameModal());

        // Enter key in rename input
        this.renameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.saveRename();
        });

        // Settings events (Phase 2)
        this.toggleSettingsBtn.addEventListener('click', () => this.toggleSettings());
        this.buttonVisibilityToggle.addEventListener('change', (e) => this.setButtonVisibility(e.target.checked));
        this.tokenLimitSelect.addEventListener('change', (e) => this.setTokenLimit(e.target.value));

        // Export/Import events (Phase 3)
        this.exportBtn = document.getElementById('export-btn');
        this.importBtn = document.getElementById('import-btn');
        this.importFile = document.getElementById('import-file');

        this.exportBtn.addEventListener('click', () => this.exportContexts());
        this.importBtn.addEventListener('click', () => this.importFile.click());
        this.importFile.addEventListener('change', (e) => this.importContexts(e));

        // Load settings on init
        this.loadSettings();
    }

    /**
     * Toggle settings panel visibility
     */
    toggleSettings() {
        this.settingsPanel.classList.toggle('hidden');
    }

    /**
     * Load saved settings
     */
    async loadSettings() {
        try {
            const result = await chrome.storage.local.get(['lincolnButtonVisible', 'lincolnTokenLimit']);

            // Button visibility
            const isVisible = result.lincolnButtonVisible !== false;
            this.buttonVisibilityToggle.checked = isVisible;

            // Token limit
            const tokenLimit = result.lincolnTokenLimit || '8000';
            this.tokenLimitSelect.value = tokenLimit;
        } catch (e) {
            console.error('Failed to load settings:', e);
        }
    }

    /**
     * Set button visibility in storage
     */
    async setButtonVisibility(visible) {
        try {
            await chrome.storage.local.set({ lincolnButtonVisible: visible });

            // Notify content script to show/hide button
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab && (tab.url.includes('chatgpt') || tab.url.includes('gemini'))) {
                try {
                    await chrome.tabs.sendMessage(tab.id, {
                        action: 'setButtonVisibility',
                        visible: visible
                    });
                } catch (e) {
                    // Content script not loaded, that's ok
                }
            }

            this.showToast(visible ? 'Button shown' : 'Button hidden', 'success');
        } catch (e) {
            console.error('Failed to set visibility:', e);
        }
    }

    /**
     * Set token limit in storage
     */
    async setTokenLimit(limit) {
        try {
            await chrome.storage.local.set({ lincolnTokenLimit: parseInt(limit) });
            this.showToast(`Token limit set to ${parseInt(limit) / 1000}K`, 'success');
        } catch (e) {
            console.error('Failed to set token limit:', e);
        }
    }

    /**
     * Load all contexts from storage
     */
    async loadContexts() {
        try {
            // Show loading
            this.contextsList.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

            // Get contexts from background script
            const response = await chrome.runtime.sendMessage({ action: 'getAllContexts' });

            if (response.error) {
                throw new Error(response.error);
            }

            this.contexts = response || [];
            this.renderContexts();
            this.updateStats();
        } catch (error) {
            console.error('Failed to load contexts:', error);
            this.showToast('Failed to load contexts', 'error');
            this.contextsList.innerHTML = '';
            this.emptyState.classList.remove('hidden');
        }
    }

    /**
     * Render contexts list
     */
    renderContexts() {
        // Clear list
        this.contextsList.innerHTML = '';

        if (this.contexts.length === 0) {
            this.contextsList.appendChild(this.emptyState);
            this.emptyState.classList.remove('hidden');
            return;
        }

        this.emptyState.classList.add('hidden');

        this.contexts.forEach(context => {
            const item = this.createContextItem(context);
            this.contextsList.appendChild(item);
        });
    }

    /**
     * Create a context item element
     */
    createContextItem(context) {
        const clone = this.template.content.cloneNode(true);
        const item = clone.querySelector('.context-item');

        item.dataset.id = context.id;

        // Platform badge
        const platformEl = item.querySelector('.context-platform');
        platformEl.textContent = context.platform === 'chatgpt' ? 'ChatGPT' : 'Gemini';
        platformEl.classList.add(context.platform);

        // Title
        item.querySelector('.context-title').textContent = context.title || 'Untitled Context';

        // Meta
        const date = new Date(context.createdAt);
        item.querySelector('.context-date').textContent = this.formatDate(date);
        item.querySelector('.context-messages').textContent = `${context.messages.length} messages`;

        // Actions
        item.querySelector('.copy-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.copyContextId(context.id);
        });

        item.querySelector('.edit-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.openRenameModal(context);
        });

        item.querySelector('.delete-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.deleteContext(context.id);
        });

        return item;
    }

    /**
     * Update statistics display
     */
    updateStats() {
        const total = this.contexts.length;
        const chatgpt = this.contexts.filter(c => c.platform === 'chatgpt').length;
        const gemini = this.contexts.filter(c => c.platform === 'gemini').length;

        this.totalCountEl.textContent = total;
        this.chatgptCountEl.textContent = chatgpt;
        this.geminiCountEl.textContent = gemini;
    }

    /**
     * Save current chat (trigger content script)
     */
    async saveCurrentChat() {
        try {
            this.saveCurrentBtn.disabled = true;
            this.saveCurrentBtn.innerHTML = '<div class="spinner" style="width:14px;height:14px;border-width:2px;"></div> Saving...';

            // Get current tab
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            if (!tab) {
                throw new Error('No active tab');
            }

            // Check if on supported site
            const url = tab.url;
            if (!url.includes('chat.openai.com') && !url.includes('chatgpt.com') && !url.includes('gemini.google.com')) {
                this.showToast('Open ChatGPT or Gemini to save a chat', 'error');
                return;
            }

            // Try to send message to content script
            try {
                await chrome.tabs.sendMessage(tab.id, { action: 'extractAndSave' });
            } catch (connError) {
                // Content script not loaded - inject it programmatically
                console.log('Content script not loaded, injecting...');

                // Determine which scripts to inject based on URL
                const isGemini = url.includes('gemini.google.com');
                const scripts = [
                    'storage/schema.js',
                    'storage/contextDB.js',
                    'utils/tokenEstimator.js',
                    'utils/platformDetector.js',
                    'utils/draggableButton.js',
                    'inject/formatter.js',
                    'inject/chunker.js',
                    'inject/invisibleInjector.js',
                    isGemini ? 'content/geminiExtractor.js' : 'content/chatgptExtractor.js'
                ];

                // Inject all scripts
                for (const script of scripts) {
                    await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        files: [script]
                    });
                }

                // Wait for scripts to initialize
                await new Promise(resolve => setTimeout(resolve, 1000));

                // Try again
                await chrome.tabs.sendMessage(tab.id, { action: 'extractAndSave' });
            }

            // Wait a moment and refresh
            setTimeout(async () => {
                await this.loadContexts();
                this.showToast('Context saved!', 'success');
            }, 1500);

        } catch (error) {
            console.error('Failed to save chat:', error);

            // Provide helpful error message
            if (error.message.includes('Cannot access') || error.message.includes('chrome://')) {
                this.showToast('Cannot access this page. Try refreshing ChatGPT.', 'error');
            } else {
                this.showToast('Failed to save. Try refreshing the page.', 'error');
            }
        } finally {
            this.saveCurrentBtn.disabled = false;
            this.saveCurrentBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
          <polyline points="17,21 17,13 7,13 7,21"/>
          <polyline points="7,3 7,8 15,8"/>
        </svg>
        Save Current Chat
      `;
        }
    }

    /**
     * Copy context ID to clipboard
     */
    async copyContextId(id) {
        try {
            await navigator.clipboard.writeText(id);
            this.showToast('Context ID copied!', 'success');
        } catch (error) {
            console.error('Failed to copy:', error);
            this.showToast('Failed to copy', 'error');
        }
    }

    /**
     * Open rename modal
     */
    openRenameModal(context) {
        this.selectedContextId = context.id;
        this.renameInput.value = context.title || '';
        this.renameModal.classList.remove('hidden');
        this.renameInput.focus();
    }

    /**
     * Close rename modal
     */
    closeRenameModal() {
        this.renameModal.classList.add('hidden');
        this.selectedContextId = null;
    }

    /**
     * Save renamed context
     */
    async saveRename() {
        if (!this.selectedContextId) return;

        const newTitle = this.renameInput.value.trim();
        if (!newTitle) {
            this.showToast('Please enter a name', 'error');
            return;
        }

        try {
            await chrome.runtime.sendMessage({
                action: 'updateContext',
                id: this.selectedContextId,
                updates: { title: newTitle }
            });

            this.closeRenameModal();
            await this.loadContexts();
            this.showToast('Context renamed', 'success');
        } catch (error) {
            console.error('Failed to rename:', error);
            this.showToast('Failed to rename', 'error');
        }
    }

    /**
     * Delete a context
     */
    async deleteContext(id) {
        if (!confirm('Delete this context?')) return;

        try {
            await chrome.runtime.sendMessage({ action: 'deleteContext', id });
            await this.loadContexts();
            this.showToast('Context deleted', 'success');
        } catch (error) {
            console.error('Failed to delete:', error);
            this.showToast('Failed to delete', 'error');
        }
    }

    /**
     * Format date for display
     */
    formatDate(date) {
        const now = new Date();
        const diff = now - date;

        // Less than 1 minute
        if (diff < 60000) return 'Just now';

        // Less than 1 hour
        if (diff < 3600000) {
            const mins = Math.floor(diff / 60000);
            return `${mins}m ago`;
        }

        // Less than 24 hours
        if (diff < 86400000) {
            const hours = Math.floor(diff / 3600000);
            return `${hours}h ago`;
        }

        // Less than 7 days
        if (diff < 604800000) {
            const days = Math.floor(diff / 86400000);
            return `${days}d ago`;
        }

        // Otherwise show date
        return date.toLocaleDateString();
    }

    /**
     * Export contexts to JSON file
     */
    async exportContexts() {
        if (this.contexts.length === 0) {
            this.showToast('No contexts to export', 'error');
            return;
        }

        try {
            const data = {
                version: 1,
                exportedAt: new Date().toISOString(),
                contexts: this.contexts
            };

            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = `lincoln-contexts-${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();

            // Cleanup
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 100);

            this.showToast('Contexts exported!', 'success');
        } catch (e) {
            console.error('Export failed:', e);
            this.showToast('Export failed', 'error');
        }
    }

    /**
     * Import contexts from JSON file
     */
    async importContexts(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();

        reader.onload = async (e) => {
            try {
                const data = JSON.parse(e.target.result);

                if (!data.contexts || !Array.isArray(data.contexts)) {
                    throw new Error('Invalid file format');
                }

                let importedCount = 0;

                // Save each context via service worker
                for (const context of data.contexts) {
                    await chrome.runtime.sendMessage({
                        action: 'saveContext',
                        context: context
                    });
                    importedCount++;
                }

                await this.loadContexts();
                this.showToast(`Imported ${importedCount} contexts`, 'success');

            } catch (err) {
                console.error('Import failed:', err);
                this.showToast('Import failed: Invalid file', 'error');
            } finally {
                // Reset file input
                event.target.value = '';
            }
        };

        reader.readAsText(file);
    }

    /**
     * Show toast notification
     */
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;

        this.toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px)';
            setTimeout(() => toast.remove(), 300);
        }, 2500);
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new PopupController();
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'contextSaved') {
        // Refresh the list
        window.location.reload();
    }
});
