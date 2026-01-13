/**
 * Input Watcher
 * Watches for context:// links in user input and triggers injection
 */

const InputWatcher = {
    observer: null,
    debounceTimer: null,

    /**
     * Context link pattern
     */
    CONTEXT_PATTERN: /context:\/\/([a-f0-9-]+)/i,

    /**
     * Initialize the input watcher
     */
    init() {
        const platform = PlatformDetector.detect();
        if (!PlatformDetector.isSupported()) {
            console.log('[AI Context Linker] Unsupported platform');
            return;
        }

        console.log(`[AI Context Linker] Input watcher initialized for ${platform}`);
        this.startObserving(platform);
    },

    /**
     * Start observing input changes
     * @param {string} platform - Platform identifier
     */
    startObserving(platform) {
        // Use MutationObserver to detect when input appears
        this.observer = new MutationObserver(() => {
            this.attachInputListeners(platform);
        });

        this.observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        // Also try to attach immediately
        setTimeout(() => this.attachInputListeners(platform), 1000);
    },

    /**
     * Attach listeners to input element
     * @param {string} platform - Platform identifier
     */
    attachInputListeners(platform) {
        const inputElement = ContextInjector.getInputElement(platform);
        if (!inputElement || inputElement.dataset.contextWatching) return;

        inputElement.dataset.contextWatching = 'true';

        inputElement.addEventListener('input', (e) => {
            this.handleInputChange(e.target, platform);
        });

        inputElement.addEventListener('keydown', (e) => {
            // Check on Enter key (but not when Shift is held for multiline)
            if (e.key === 'Enter' && !e.shiftKey) {
                this.handleSubmitAttempt(e.target, platform, e);
            }
        });

        console.log('[AI Context Linker] Attached input listeners');
    },

    /**
     * Handle input changes with debounce
     * @param {Element} element - Input element
     * @param {string} platform - Platform identifier
     */
    handleInputChange(element, platform) {
        clearTimeout(this.debounceTimer);

        this.debounceTimer = setTimeout(() => {
            const text = this.getInputText(element);
            const match = text.match(this.CONTEXT_PATTERN);

            if (match) {
                this.showContextPreview(match[0], element);
            } else {
                this.hideContextPreview();
            }
        }, 300);
    },

    /**
     * Handle submit attempt - inject context if link is detected
     * @param {Element} element - Input element
     * @param {string} platform - Platform identifier
     * @param {Event} event - Keyboard event
     */
    async handleSubmitAttempt(element, platform, event) {
        const text = this.getInputText(element);
        const match = text.match(this.CONTEXT_PATTERN);

        if (match) {
            event.preventDefault();
            event.stopPropagation();

            const contextId = match[0];
            const userMessage = text.replace(this.CONTEXT_PATTERN, '').trim();

            await this.injectContext(contextId, platform, userMessage);
        }
    },

    /**
     * Get text from input element
     * @param {Element} element - Input element
     * @returns {string}
     */
    getInputText(element) {
        if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
            return element.value || '';
        }
        return element.textContent || '';
    },

    /**
     * Inject context into chat
     * @param {string} contextId - Context ID
     * @param {string} platform - Platform identifier
     * @param {string} userMessage - User's additional message
     */
    async injectContext(contextId, platform, userMessage) {
        try {
            // Load context from storage
            const context = await ContextDB.get(contextId);

            if (!context) {
                ContextInjector.showToast(`Context not found: ${contextId}`, 'error');
                return;
            }

            // Inject context
            const result = await ContextInjector.inject(context, platform, userMessage);

            if (result.success) {
                let message = `Context loaded (${result.includedMessages} messages`;
                if (result.isPartial) {
                    message += `, ${result.totalMessages - result.includedMessages} truncated`;
                }
                message += ')';
                ContextInjector.showToast(message, 'success');
            } else {
                ContextInjector.showToast(`Failed: ${result.error}`, 'error');
            }
        } catch (error) {
            console.error('[AI Context Linker] Injection error:', error);
            ContextInjector.showToast('Failed to load context', 'error');
        }
    },

    /**
     * Show context preview tooltip
     * @param {string} contextId - Context ID
     * @param {Element} inputElement - Input element for positioning
     */
    async showContextPreview(contextId, inputElement) {
        // Remove existing preview
        this.hideContextPreview();

        try {
            const context = await ContextDB.get(contextId);

            const preview = document.createElement('div');
            preview.id = 'context-linker-preview';
            preview.style.cssText = `
        position: fixed;
        bottom: 100px;
        left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(135deg, #1e1e2e, #2d2d3d);
        border: 1px solid #6366f1;
        border-radius: 12px;
        padding: 12px 16px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 13px;
        color: #e0e0e0;
        z-index: 10000;
        max-width: 400px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.4);
      `;

            if (context) {
                preview.innerHTML = `
          <div style="color: #10b981; font-weight: 600; margin-bottom: 4px;">
            📎 Context Found
          </div>
          <div style="color: #a0a0a0;">
            ${context.title || 'Untitled'} • ${context.messages.length} messages
          </div>
          <div style="color: #6b7280; font-size: 11px; margin-top: 4px;">
            Press Enter to inject context
          </div>
        `;
            } else {
                preview.innerHTML = `
          <div style="color: #ef4444; font-weight: 600;">
            ⚠️ Context Not Found
          </div>
          <div style="color: #a0a0a0; font-size: 12px;">
            ${contextId}
          </div>
        `;
            }

            document.body.appendChild(preview);
        } catch (error) {
            console.error('[AI Context Linker] Preview error:', error);
        }
    },

    /**
     * Hide context preview
     */
    hideContextPreview() {
        const existing = document.getElementById('context-linker-preview');
        if (existing) existing.remove();
    }
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => InputWatcher.init());
} else {
    InputWatcher.init();
}
