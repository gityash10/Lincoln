/**
 * Gemini Extractor
 * Extracts conversation messages from Gemini UI
 * Lincoln - AI Context Linker
 */

const GeminiExtractor = {
    buttonCreated: false,
    DEBUG: false,

    BLACKLIST: [
        'This response was generated',
        'Safety',
        'Feedback',
        'Regenerate',
        'Show drafts',
        'Try again',
        'Thinking',
        'Loading',
        'Error generating',
        'Something went wrong',
        'I cannot',
        'I\'m sorry, but I cannot',
        'I\'m not able to',
        'Report legal issue',
        'Share & export',
        'Copy',
        'Good response',
        'Bad response',
        'Modify response',
        'Google it',
        'Unable to'
    ],

    isValidMessage(text) {
        if (!text || text.length < 10) return false;
        const lowerText = text.toLowerCase();
        for (const blocked of this.BLACKLIST) {
            if (lowerText.includes(blocked.toLowerCase())) return false;
        }
        const wordCount = text.split(/\s+/).length;
        if (wordCount < 3) return false;
        return true;
    },

    /**
     * Extract messages
     * @param {boolean} includeElements - Whether to include DOM elements in output
     */
    extractMessages(includeElements = false) {
        const messages = [];
        const seen = new Set();

        console.log('[Lincoln] Gemini: Extracting messages');

        const addMessage = (role, text, element, index) => {
            if (!this.isValidMessage(text)) return false;

            const textKey = text.length > 300
                ? text.slice(0, 150) + '|' + text.slice(-150)
                : text;
            if (seen.has(textKey)) return false;
            seen.add(textKey);

            let timestamp = null;
            if (element) {
                timestamp = element.getAttribute('data-timestamp') ||
                    element.getAttribute('data-time') ||
                    element.closest('[data-timestamp]')?.getAttribute('data-timestamp');
            }

            const msg = {
                role,
                content: text,
                _ts: timestamp ? parseInt(timestamp) : (index || 0),
                _index: index || 0
            };

            if (includeElements) {
                msg.element = element;
            }

            messages.push(msg);
            return true;
        };

        // Strategy 1: Article/Listitem
        let candidates = document.querySelectorAll('div[role="article"], div[role="listitem"]');
        if (candidates.length > 0) {
            candidates.forEach((el, index) => {
                const text = this.extractTextContent(el).trim();
                const role = this.detectRole(el, text);
                addMessage(role, text, el, index);
            });
        }

        // Strategy 2: Fallback classes
        if (messages.length === 0) {
            const allContainers = document.querySelectorAll(
                '[class*="response-container"], [class*="message-container"], [class*="turn-container"]'
            );
            allContainers.forEach((el, index) => {
                const text = this.extractTextContent(el).trim();
                const role = this.detectRole(el, text);
                addMessage(role, text, el, index);
            });
        }

        // Strategy 3: Structural fallback
        if (messages.length === 0) {
            const mainArea = document.querySelector('main, [role="main"]');
            if (mainArea) {
                const textBlocks = mainArea.querySelectorAll('div[class], p');
                textBlocks.forEach((el, index) => {
                    const text = this.extractTextContent(el).trim();
                    if (text && text.length > 100) {
                        const role = this.detectRole(el, text);
                        addMessage(role, text, el, index);
                    }
                });
            }
        }

        messages.sort((a, b) => {
            if (a._ts && b._ts && a._ts !== b._ts) return a._ts - b._ts;
            return a._index - b._index;
        });

        // Clean internal props if returning final result (unless elements requested, we handle that later)
        // Actually, we return whatever internal props we have, caller handles usage
        return messages;
    },

    /**
     * Start selection mode
     */
    startSelection() {
        console.log('[Lincoln] Gemini: Starting selection mode...');

        const allMessages = this.extractMessages(true);
        const elements = allMessages.map(m => m.element).filter(el => el); // Ensure valid elements

        if (elements.length === 0) {
            this.showToast('No messages found to select', 'error');
            return;
        }

        if (typeof SelectionManager !== 'undefined') {
            SelectionManager.start(elements, (indices) => {
                // Map indices back to messages
                // Note: indices correspond to the 'elements' array
                // We need to map back carefully if filter removed some items (it shouldn't if extractMessages is consistent)

                const selectedMessages = [];
                indices.forEach(idx => {
                    if (allMessages[idx]) {
                        const m = allMessages[idx];
                        selectedMessages.push({ role: m.role, content: m.content });
                    }
                });

                if (selectedMessages.length > 0) {
                    this.saveCurrentContext(selectedMessages);
                } else {
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

    detectRole(element, text) {
        if (element.querySelector('img[alt*="You"]')) return 'user';
        if (element.closest('[class*="user-message"]') ||
            element.closest('[class*="user-turn"]') ||
            element.closest('[data-role="user"]')) return 'user';

        const firstChild = element.firstElementChild;
        if (firstChild) {
            const firstText = firstChild.textContent.trim();
            if (firstText === 'You' || firstText.startsWith('You:')) return 'user';
        }

        const dataRole = element.getAttribute('data-role') ||
            element.getAttribute('data-message-author') ||
            element.closest('[data-role]')?.getAttribute('data-role') ||
            element.closest('[data-message-author]')?.getAttribute('data-message-author');

        if (dataRole) {
            const roleLower = dataRole.toLowerCase();
            if (roleLower === 'user' || roleLower === 'human') return 'user';
            if (roleLower === 'model' || roleLower === 'assistant' || roleLower === 'ai') return 'assistant';
        }

        if (element.querySelector('img[alt*="Gemini"]') ||
            element.closest('[class*="model-response"]') ||
            element.closest('[class*="assistant"]')) return 'assistant';

        return 'assistant';
    },

    extractTextContent(element) {
        if (!element) return '';
        try {
            const clone = element.cloneNode(true);
            clone.querySelectorAll(
                'button, svg, [role="button"], style, script, nav, ' +
                '[class*="action"], [class*="toolbar"], [class*="menu"]'
            ).forEach(el => el.remove());

            clone.querySelectorAll('code-block, pre code, pre').forEach(code => {
                const codeText = code.textContent;
                code.textContent = `\n\`\`\`\n${codeText}\n\`\`\`\n`;
            });

            clone.querySelectorAll('code:not(pre code)').forEach(code => {
                code.textContent = `\`${code.textContent}\``;
            });

            return clone.textContent || '';
        } catch (e) {
            return element.textContent || '';
        }
    },

    getTitle() {
        const pageTitle = document.title;
        if (pageTitle && !pageTitle.toLowerCase().includes('gemini')) {
            return pageTitle;
        }
        return `Gemini Chat - ${new Date().toLocaleString()}`;
    },

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

    async saveCurrentContext(explicitMessages = null) {
        try {
            console.log('[Lincoln] Gemini: Starting save...');

            let messages = [];
            if (explicitMessages) {
                messages = explicitMessages;
            } else {
                const rawMessages = this.extractMessages();
                messages = rawMessages.map(({ role, content }) => ({ role, content }));
            }

            if (messages.length === 0) {
                this.showToast('No messages found. Make sure you have a conversation open.', 'error');
                return;
            }

            const title = this.getTitle();
            const context = ContextSchema.create('gemini', messages, title);

            const response = await chrome.runtime.sendMessage({
                action: 'saveContext',
                context: context
            });

            if (response && response.error) {
                throw new Error(response.error);
            }

            console.log('[Lincoln] Gemini: Context saved to service worker DB');

            let clipboardSuccess = false;
            try {
                await navigator.clipboard.writeText(context.id);
                clipboardSuccess = true;
            } catch (e) {
                console.log('[Lincoln] Gemini: Clipboard access restricted');
            }

            if (clipboardSuccess) {
                this.showToast(`✓ Saved! ${messages.length} messages. ID copied.`, 'success');
            } else {
                this.showToast(`✓ Saved! ${messages.length} messages. Use popup to copy ID.`, 'success');
            }

        } catch (error) {
            console.error('[Lincoln] Gemini: Save error:', error);
            this.showToast('Failed to save: ' + (error.message || 'Unknown error'), 'error');
        }
    },

    createButton() {
        if (document.getElementById('lincoln-save-btn')) return;

        if (typeof DraggableSaveButton !== 'undefined') {
            DraggableSaveButton.create(
                () => this.saveCurrentContext(),
                () => this.startSelection()
            );
            this.buttonCreated = true;
            console.log('[Lincoln] Gemini: Save button created');
        }
    },

    init() {
        console.log('[Lincoln] Gemini extractor initializing...');
        setTimeout(() => this.createButton(), 2500);

        if (typeof InvisibleContextInjector !== 'undefined') {
            InvisibleContextInjector.init();
        }

        const mainContainer = document.querySelector('main') || document.body;

        const observer = new MutationObserver(() => {
            if (!document.getElementById('lincoln-save-btn')) {
                if (!this._buttonTimeout) {
                    this._buttonTimeout = setTimeout(() => {
                        this.createButton();
                        this._buttonTimeout = null;
                    }, 1000);
                }
            }
        });

        observer.observe(mainContainer, {
            childList: true, subtree: false
        });

        console.log('[Lincoln] Gemini extractor ready');
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => GeminiExtractor.init());
} else {
    GeminiExtractor.init();
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'extractAndSave') {
        GeminiExtractor.saveCurrentContext().then(() => {
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
