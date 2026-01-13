/**
 * Context Injector
 * Handles DOM injection of context into AI chat inputs
 */

const ContextInjector = {
    /**
     * Platform-specific input selectors
     */
    SELECTORS: {
        chatgpt: {
            // ChatGPT input selectors (multiple fallbacks)
            input: [
                '#prompt-textarea',
                'textarea[data-id="root"]',
                'div[contenteditable="true"]',
                'textarea[placeholder*="Message"]'
            ],
            sendButton: [
                'button[data-testid="send-button"]',
                'button[aria-label="Send message"]',
                'form button[type="submit"]'
            ]
        },
        gemini: {
            // Gemini input selectors
            input: [
                '.ql-editor',
                'div[contenteditable="true"]',
                'rich-textarea div[contenteditable]',
                'textarea'
            ],
            sendButton: [
                'button[aria-label="Send message"]',
                'button.send-button',
                'button[mattooltip="Send message"]'
            ]
        }
    },

    /**
     * Find element using multiple selectors (fallback pattern)
     * @param {Array} selectors - Array of CSS selectors
     * @returns {Element|null}
     */
    findElement(selectors) {
        for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element) return element;
        }
        return null;
    },

    /**
     * Get input element for current platform
     * @param {string} platform - Platform identifier
     * @returns {Element|null}
     */
    getInputElement(platform) {
        const selectors = this.SELECTORS[platform]?.input || [];
        return this.findElement(selectors);
    },

    /**
     * Set value in input element (handles both textarea and contenteditable)
     * @param {Element} element - Input element
     * @param {string} value - Text to inject
     */
    setValue(element, value) {
        if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
            // Standard input/textarea
            element.value = value;
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
        } else if (element.contentEditable === 'true') {
            // Contenteditable div
            element.textContent = value;
            element.dispatchEvent(new InputEvent('input', {
                bubbles: true,
                cancelable: true,
                inputType: 'insertText',
                data: value
            }));
        }

        // Focus the element
        element.focus();
    },

    /**
     * Inject context into the chat input
     * @param {Object} context - Context object
     * @param {string} platform - Platform identifier
     * @param {string} userMessage - Optional user message to append
     * @returns {Object} Result with success status and details
     */
    async inject(context, platform, userMessage = '') {
        try {
            // Get injection payload
            const payload = ContextChunker.getInjectionPayload(context, platform, userMessage);

            // Find input element
            const inputElement = this.getInputElement(platform);
            if (!inputElement) {
                return {
                    success: false,
                    error: 'Could not find input element',
                    platform: platform
                };
            }

            // Inject the text
            this.setValue(inputElement, payload.text);

            return {
                success: true,
                platform: platform,
                estimatedTokens: payload.estimatedTokens,
                isPartial: payload.isPartial,
                includedMessages: payload.includedCount,
                totalMessages: payload.totalMessages
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                platform: platform
            };
        }
    },

    /**
     * Show a toast notification
     * @param {string} message - Message to display
     * @param {string} type - 'success' | 'error' | 'info'
     */
    showToast(message, type = 'info') {
        // Remove existing toast
        const existing = document.getElementById('context-linker-toast');
        if (existing) existing.remove();

        // Create toast element
        const toast = document.createElement('div');
        toast.id = 'context-linker-toast';
        toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      padding: 12px 24px;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 14px;
      color: white;
      z-index: 10000;
      animation: slideIn 0.3s ease;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      ${type === 'success' ? 'background: linear-gradient(135deg, #10b981, #059669);' : ''}
      ${type === 'error' ? 'background: linear-gradient(135deg, #ef4444, #dc2626);' : ''}
      ${type === 'info' ? 'background: linear-gradient(135deg, #6366f1, #4f46e5);' : ''}
    `;
        toast.textContent = message;

        // Add animation styles
        const style = document.createElement('style');
        style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    `;
        document.head.appendChild(style);

        document.body.appendChild(toast);

        // Auto-remove after 3 seconds
        setTimeout(() => toast.remove(), 3000);
    }
};

// Make available globally
window.ContextInjector = ContextInjector;
