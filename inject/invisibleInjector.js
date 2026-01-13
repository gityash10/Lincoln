/**
 * Invisible Context Injector
 * Injects context at send-time WITHOUT showing in user's textbox
 * 
 * Strategy: Intercept the send action, compose full payload internally,
 * and replace the message content just before it's sent
 */

const InvisibleContextInjector = {
    pendingContext: null,
    originalMessage: null,
    isInjecting: false,
    lastInjectionTime: 0,

    /**
     * Platform-specific selectors (updated for latest ChatGPT UI)
     */
    SELECTORS: {
        chatgpt: {
            input: [
                '#prompt-textarea',
                'div[id="prompt-textarea"]',
                'textarea[data-id]',
                'div[contenteditable="true"][class*="ProseMirror"]',
                'div[contenteditable="true"]'
            ],
            sendButton: [
                'button[data-testid="send-button"]',
                'button[aria-label*="Send"]',
                'button[class*="send"]',
                'form button[type="submit"]'
            ],
            form: ['form']
        },
        gemini: {
            input: [
                '.ql-editor',
                'div[contenteditable="true"]',
                'rich-textarea div[contenteditable]',
                'textarea'
            ],
            sendButton: [
                'button[aria-label*="Send"]',
                'button.send-button',
                'button[data-test-id="send-button"]'
            ],
            form: ['form']
        }
    },

    /**
     * Context link pattern
     */
    CONTEXT_PATTERN: /context:\/\/([a-f0-9-]+)/i,

    /**
     * Initialize the invisible injector
     */
    init() {
        const platform = PlatformDetector.detect();
        if (!PlatformDetector.isSupported()) return;

        console.log('[AI Context Linker] Invisible injector initialized for', platform);
        this.setupInputWatcher(platform);
        this.setupInterceptors(platform);
    },

    /**
     * Find element from selector list
     */
    findElement(selectors) {
        for (const selector of selectors) {
            try {
                const el = document.querySelector(selector);
                if (el) return el;
            } catch (e) {
                // Invalid selector, skip
            }
        }
        return null;
    },

    /**
     * Setup input watcher to detect context links
     */
    setupInputWatcher(platform) {
        const observer = new MutationObserver(() => {
            this.attachInputListener(platform);
        });

        observer.observe(document.body, { childList: true, subtree: true });

        // Initial attachment with retries
        setTimeout(() => this.attachInputListener(platform), 1000);
        setTimeout(() => this.attachInputListener(platform), 3000);
    },

    /**
     * Attach input listener
     */
    attachInputListener(platform) {
        const input = this.findElement(this.SELECTORS[platform]?.input || []);
        if (!input || input.dataset.invisibleContextWatcher) return;

        input.dataset.invisibleContextWatcher = 'true';
        input.addEventListener('input', () => this.checkForContextLink(input, platform));

        console.log('[AI Context Linker] Attached invisible context watcher to:', input.tagName);
    },

    /**
     * Check if input contains context link
     */
    async checkForContextLink(input, platform) {
        const text = this.getInputText(input);
        const match = text.match(this.CONTEXT_PATTERN);

        if (match) {
            const contextId = match[0];
            try {
                // Load context from service worker (shared database)
                const context = await chrome.runtime.sendMessage({
                    action: 'getContext',
                    id: contextId
                });

                if (context && context.messages) {
                    this.pendingContext = context;
                    this.showContextIndicator(context, contextId);
                } else {
                    this.pendingContext = null;
                    this.showContextIndicator(null, contextId);
                }
            } catch (e) {
                console.error('[Lincoln] Error loading context:', e);
                this.pendingContext = null;
                this.showContextIndicator(null, contextId);
            }
        } else {
            this.pendingContext = null;
            this.hideContextIndicator();
        }
    },

    /**
     * Get text from input element
     */
    getInputText(input) {
        if (input.tagName === 'TEXTAREA' || input.tagName === 'INPUT') {
            return input.value || '';
        }
        // For contenteditable / ProseMirror
        return input.innerText || input.textContent || '';
    },

    /**
     * Set text in input element with proper event dispatching
     */
    setInputText(input, text) {
        if (input.tagName === 'TEXTAREA' || input.tagName === 'INPUT') {
            // Standard textarea
            input.value = text;
            input.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
            // Contenteditable / ProseMirror
            input.focus();

            // Clear and set content
            input.innerHTML = '';

            // Create paragraph element for ProseMirror compatibility
            const p = document.createElement('p');
            p.textContent = text;
            input.appendChild(p);

            // Dispatch events
            input.dispatchEvent(new InputEvent('input', {
                bubbles: true,
                cancelable: true,
                inputType: 'insertText',
                data: text
            }));
        }
    },

    /**
     * Setup interceptors for send action
     */
    setupInterceptors(platform) {
        // Intercept Enter key (capture phase)
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
                this.handlePotentialSend(e, platform);
            }
        }, true);

        // Intercept send button clicks (capture phase)
        document.addEventListener('click', (e) => {
            const selectors = this.SELECTORS[platform]?.sendButton || [];
            for (const selector of selectors) {
                try {
                    if (e.target.closest(selector)) {
                        this.handlePotentialSend(e, platform);
                        break;
                    }
                } catch (err) {
                    // Invalid selector
                }
            }
        }, true);
    },

    /**
     * Handle potential send action
     */
    async handlePotentialSend(e, platform) {
        // Debounce to prevent double-injection
        const now = Date.now();
        if (now - this.lastInjectionTime < 2000) return;

        // Validate pendingContext exists and has messages
        if (!this.pendingContext || !this.pendingContext.messages || this.isInjecting) return;

        const input = this.findElement(this.SELECTORS[platform]?.input || []);
        if (!input) return;

        const currentText = this.getInputText(input);
        const match = currentText.match(this.CONTEXT_PATTERN);

        if (!match) return;

        // Prevent the original send
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        this.isInjecting = true;
        this.lastInjectionTime = now;

        try {
            // Store context reference locally to prevent race conditions
            const context = this.pendingContext;

            // Double-check context is valid
            if (!context || !context.messages || !Array.isArray(context.messages)) {
                throw new Error('Context is invalid or has no messages');
            }

            // Extract user's actual message (remove context link)
            const userMessage = currentText.replace(this.CONTEXT_PATTERN, '').trim();

            // Format the full payload (context + user message)
            const fullPayload = this.formatInvisiblePayload(context, userMessage);

            console.log('[Lincoln] Injecting context with', context.messages.length, 'messages');

            // Set the full payload in the input
            this.setInputText(input, fullPayload);

            // Wait for UI to update
            await this.delay(100);

            // Find and click send button
            const sendBtn = this.findElement(this.SELECTORS[platform]?.sendButton || []);

            if (sendBtn && !sendBtn.disabled) {
                // Remove our event listeners temporarily to prevent infinite loop
                this.isInjecting = true;
                sendBtn.click();
            } else {
                // Fallback: try to submit form
                const form = input.closest('form');
                if (form) {
                    form.requestSubmit();
                } else {
                    // Last resort: simulate Enter key
                    input.dispatchEvent(new KeyboardEvent('keydown', {
                        key: 'Enter',
                        code: 'Enter',
                        bubbles: true,
                        cancelable: true
                    }));
                }
            }

            // Show success message (use local context variable)
            this.showToast(`✓ Context linked (${context.messages.length} messages)`, 'success');

            // Clear pending context
            this.pendingContext = null;
            this.hideContextIndicator();

        } catch (error) {
            console.error('[Lincoln] Injection error:', error);
            this.showToast('Failed to inject context: ' + error.message, 'error');
        } finally {
            // Reset after a delay
            setTimeout(() => {
                this.isInjecting = false;
            }, 1000);
        }
    },

    /**
     * Format the invisible payload
     */
    formatInvisiblePayload(context, userMessage) {
        const contextMessages = context.messages.map(msg => {
            const role = msg.role === 'user' ? 'USER' : 'ASSISTANT';
            return `[${role}]: ${msg.content}`;
        }).join('\n\n');

        return `[PREVIOUS CONVERSATION CONTEXT - Treat this as already completed:]

${contextMessages}

[END OF PREVIOUS CONTEXT]

[CURRENT REQUEST]: ${userMessage || 'Please continue from our previous conversation.'}`;
    },

    /**
     * Show context indicator
     */
    showContextIndicator(context, contextId) {
        this.hideContextIndicator();

        const indicator = document.createElement('div');
        indicator.id = 'context-linker-indicator';
        indicator.style.cssText = `
      position: fixed;
      bottom: 100px;
      left: 50%;
      transform: translateX(-50%);
      background: linear-gradient(135deg, #1a1a2e, #16213e);
      border: 1px solid ${context ? '#10b981' : '#ef4444'};
      border-radius: 12px;
      padding: 12px 18px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 13px;
      color: #e0e0e0;
      z-index: 10000;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      gap: 12px;
    `;

        if (context) {
            indicator.innerHTML = `
        <div style="width: 10px; height: 10px; background: #10b981; border-radius: 50%; animation: pulse 1.5s infinite;"></div>
        <div>
          <div style="font-weight: 600; color: #10b981;">📎 Context Ready to Link</div>
          <div style="color: #a0a0a0; font-size: 12px;">${context.title || 'Untitled'} • ${context.messages.length} messages</div>
          <div style="color: #8b8b9b; font-size: 11px; margin-top: 3px;">Press Enter or click Send to link context</div>
        </div>
      `;
        } else {
            indicator.innerHTML = `
        <div style="width: 10px; height: 10px; background: #ef4444; border-radius: 50%;"></div>
        <div>
          <div style="font-weight: 600; color: #ef4444;">⚠️ Context Not Found</div>
          <div style="color: #a0a0a0; font-size: 12px;">${contextId}</div>
        </div>
      `;
        }

        // Add pulse animation
        if (!document.getElementById('context-indicator-styles')) {
            const style = document.createElement('style');
            style.id = 'context-indicator-styles';
            style.textContent = `
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(0.95); }
        }
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `;
            document.head.appendChild(style);
        }

        document.body.appendChild(indicator);
    },

    /**
     * Hide context indicator
     */
    hideContextIndicator() {
        const existing = document.getElementById('context-linker-indicator');
        if (existing) existing.remove();
    },

    /**
     * Show toast notification
     */
    showToast(message, type = 'info') {
        const existing = document.getElementById('context-linker-toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.id = 'context-linker-toast';
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
      animation: slideIn 0.3s ease;
      box-shadow: 0 6px 20px rgba(0,0,0,0.35);
      ${type === 'success' ? 'background: linear-gradient(135deg, #10b981, #059669);' : ''}
      ${type === 'error' ? 'background: linear-gradient(135deg, #ef4444, #dc2626);' : ''}
      ${type === 'info' ? 'background: linear-gradient(135deg, #6366f1, #4f46e5);' : ''}
    `;
        toast.textContent = message;

        document.body.appendChild(toast);
        setTimeout(() => {
            if (toast.parentNode) {
                toast.style.opacity = '0';
                toast.style.transform = 'translateX(100%)';
                setTimeout(() => toast.remove(), 300);
            }
        }, 3500);
    },

    /**
     * Delay helper
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
};

// Make available globally
window.InvisibleContextInjector = InvisibleContextInjector;
