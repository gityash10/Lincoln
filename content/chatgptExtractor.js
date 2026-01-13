/**
 * ChatGPT Extractor
 * Extracts conversation messages from ChatGPT UI
 * Updated for latest ChatGPT DOM structure (2024/2025)
 */

const ChatGPTExtractor = {
    /**
     * Extract messages from the DOM
     * @param {boolean} includeElements - Whether to include DOM elements in output
     */
    extractMessages(includeElements = false) {
        const messages = [];

        // Strategy 1: Look for article elements with data-testid
        let turns = document.querySelectorAll('article[data-testid^="conversation-turn"]');

        // Strategy 2: Look for div elements with conversation-turn
        if (turns.length === 0) {
            turns = document.querySelectorAll('[data-testid^="conversation-turn"]');
        }

        // Strategy 3: Look for data-message-author-role attributes (fallback)
        if (turns.length === 0) {
            turns = document.querySelectorAll('[data-message-author-role]');
        }

        console.log('[Lincoln] Found', turns.length, 'conversation turns');

        if (turns.length > 0) {
            turns.forEach((turn, index) => {
                try {
                    // Get role - try multiple approaches
                    let role = turn.getAttribute('data-message-author-role');

                    if (!role) {
                        const roleElem = turn.querySelector('[data-message-author-role]');
                        if (roleElem) {
                            role = roleElem.getAttribute('data-message-author-role');
                        }
                    }

                    // Skip if not user or assistant
                    if (role !== 'user' && role !== 'assistant') return;

                    // Get content - try multiple selectors
                    let content = '';
                    const contentSelectors = [
                        '.whitespace-pre-wrap',
                        '[class*="markdown"]',
                        '[class*="prose"]',
                        '.text-base',
                        '.min-h-\\[20px\\]',
                        'div[data-message-id]',
                        '.break-words'
                    ];

                    for (const selector of contentSelectors) {
                        try {
                            const contentDiv = turn.querySelector(selector);
                            if (contentDiv && contentDiv.textContent.trim()) {
                                content = this.extractTextContent(contentDiv);
                                break;
                            }
                        } catch (e) {
                            // Selector might be invalid, continue
                        }
                    }

                    // If still no content, try getting all text from the turn
                    if (!content.trim()) {
                        content = this.extractTextContent(turn);
                    }

                    if (content.trim()) {
                        const msg = {
                            role: role,
                            content: content.trim()
                        };

                        if (includeElements) {
                            msg.element = turn;
                        }

                        messages.push(msg);
                    }
                } catch (e) {
                    console.error('[Lincoln] Error parsing turn:', e);
                }
            });
        }

        return messages;
    },

    /**
     * Start selection mode
     */
    startSelection() {
        console.log('[Lincoln] Starting selection mode...');

        // Extract all messages with their elements
        const allMessages = this.extractMessages(true);
        const elements = allMessages.map(m => m.element);

        if (elements.length === 0) {
            this.showToast('No messages found to select', 'error');
            return;
        }

        if (typeof SelectionManager !== 'undefined') {
            SelectionManager.start(elements, (indices) => {
                // Filter messages based on selected indices
                const selectedMessages = indices.map(i => {
                    const m = allMessages[i];
                    return { role: m.role, content: m.content };
                });

                if (selectedMessages.length > 0) {
                    this.saveCurrentContext(selectedMessages);
                } else {
                    // Restore button if cancelled/empty
                    if (typeof DraggableSaveButton !== 'undefined') {
                        DraggableSaveButton.show();
                    }
                }
            });
        } else {
            console.error('SelectionManager not loaded');
            this.showToast('Selection feature not ready. Reload page.', 'error');
        }
    },

    /**
     * Save current conversation as context
     */
    async saveCurrentContext(explicitMessages = null) {
        try {
            console.log('[Lincoln] Starting to save context...');

            const messages = explicitMessages || this.extractMessages();

            if (messages.length === 0) {
                console.log('[Lincoln] No messages found');
                this.showToast('No messages found to save. Make sure you have a conversation open.', 'error');
                return;
            }

            const title = this.getTitle();
            console.log('[Lincoln] Creating context with title:', title);

            const context = ContextSchema.create('chatgpt', messages, title);
            console.log('[Lincoln] Context created:', context.id);

            // Save via service worker (so popup can read it)
            const response = await chrome.runtime.sendMessage({
                action: 'saveContext',
                context: context
            });

            if (response && response.error) {
                throw new Error(response.error);
            }

            console.log('[Lincoln] Context saved to service worker DB');

            // Copy context ID to clipboard
            try {
                await navigator.clipboard.writeText(context.id);
                console.log('[Lincoln] Context ID copied to clipboard');
                this.showToast(`✓ Saved! ${messages.length} messages. ID copied.`, 'success');
            } catch (clipErr) {
                console.warn('[Lincoln] Could not copy to clipboard:', clipErr);
                this.showToast(`✓ Saved! ${messages.length} messages. Use popup to copy ID.`, 'success');
            }

        } catch (error) {
            console.error('[Lincoln] Save error:', error);
            this.showToast('Failed to save: ' + (error.message || 'Unknown error'), 'error');
        }
    },

    /**
     * Format text content
     */
    extractTextContent(element) {
        if (!element) return '';
        try {
            const clone = element.cloneNode(true);
            clone.querySelectorAll('button, svg, [role="button"]').forEach(el => el.remove());
            return clone.textContent || '';
        } catch (e) {
            return element.textContent || '';
        }
    },

    /**
     * Get chat title
     */
    getTitle() {
        return document.title || 'ChatGPT Conversation';
    },

    /**
     * Show toast notification
     */
    showToast(message, type = 'info') {
        if (typeof InvisibleContextInjector !== 'undefined' && InvisibleContextInjector.showToast) {
            InvisibleContextInjector.showToast(message, type);
            return;
        }

        const existing = document.getElementById('lincoln-toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.id = 'lincoln-toast';
        toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      padding: 14px 24px;
      border-radius: 10px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 14px;
      font-weight: 500;
      color: white;
      z-index: 10001;
      box-shadow: 0 6px 20px rgba(0,0,0,0.35);
      animation: slideIn 0.3s ease;
      ${type === 'success' ? 'background: linear-gradient(135deg, #10b981, #059669);' : ''}
      ${type === 'error' ? 'background: linear-gradient(135deg, #ef4444, #dc2626);' : ''}
      ${type === 'info' ? 'background: linear-gradient(135deg, #22d3ee, #a855f7);' : ''}
    `;
        toast.textContent = message;

        if (!document.getElementById('lincoln-toast-styles')) {
            const style = document.createElement('style');
            style.id = 'lincoln-toast-styles';
            style.textContent = `
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `;
            document.head.appendChild(style);
        }

        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 4000);
    },

    /**
     * Initialize the extractor
     */
    init() {
        console.log('[Lincoln] ChatGPT extractor initializing...');

        // Create draggable save button after delay
        setTimeout(() => {
            if (typeof DraggableSaveButton !== 'undefined') {
                DraggableSaveButton.create(
                    () => this.saveCurrentContext(),
                    () => this.startSelection()
                );
                console.log('[Lincoln] Save button created');
            } else {
                console.error('[Lincoln] DraggableSaveButton not found');
            }
        }, 2000);

        // Initialize invisible context injector
        if (typeof InvisibleContextInjector !== 'undefined') {
            InvisibleContextInjector.init();
            console.log('[Lincoln] Invisible injector initialized');
        }

        // Re-inject button if it disappears (SPA navigation)
        const observer = new MutationObserver(() => {
            if (!document.getElementById('lincoln-save-btn')) {
                setTimeout(() => {
                    if (typeof DraggableSaveButton !== 'undefined') {
                        DraggableSaveButton.create(
                            () => this.saveCurrentContext(),
                            () => this.startSelection()
                        );
                    }
                }, 500);
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });

        console.log('[Lincoln] ChatGPT extractor ready');
    }
};

// Initialize when ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ChatGPTExtractor.init());
} else {
    ChatGPTExtractor.init();
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'extractAndSave') {
        ChatGPTExtractor.saveCurrentContext().then(() => {
            sendResponse({ success: true });
        }).catch(error => {
            sendResponse({ success: false, error: error.message });
        });
        return true;
    }

    if (message.action === 'setButtonVisibility') {
        if (typeof DraggableSaveButton !== 'undefined') {
            DraggableSaveButton.setVisibility(message.visible);
        }
        sendResponse({ success: true });
        return true;
    }
});
