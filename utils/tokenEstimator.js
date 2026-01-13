/**
 * Token Estimator
 * Estimates token count for context management
 * Lincoln - AI Context Linker
 */

const TokenEstimator = {
    // Default limit (can be overridden by user settings)
    DEFAULT_LIMIT: 8000,

    // Use 60% of max to be safe
    SAFE_RATIO: 0.6,

    // Average characters per token (conservative estimate)
    CHARS_PER_TOKEN: 4,

    // Cached limit from storage
    _cachedLimit: null,

    /**
     * Get the user-configured token limit
     */
    async getLimit() {
        if (this._cachedLimit !== null) {
            return this._cachedLimit;
        }

        try {
            const result = await chrome.storage.local.get('lincolnTokenLimit');
            this._cachedLimit = result.lincolnTokenLimit || this.DEFAULT_LIMIT;
            return this._cachedLimit;
        } catch (e) {
            return this.DEFAULT_LIMIT;
        }
    },

    /**
     * Estimate token count for a string
     * @param {string} text - Text to estimate
     * @returns {number} Estimated token count
     */
    estimate(text) {
        if (!text) return 0;
        return Math.ceil(text.length / this.CHARS_PER_TOKEN);
    },

    /**
     * Get safe token limit for a platform
     * @param {string} platform - Platform identifier
     * @returns {Promise<number>} Safe token limit
     */
    async getSafeLimit(platform) {
        const limit = await this.getLimit();
        return Math.floor(limit * this.SAFE_RATIO);
    },

    /**
     * Get safe token limit synchronously (uses cached value)
     * @param {string} platform - Platform identifier
     * @returns {number} Safe token limit
     */
    getSafeLimitSync(platform) {
        const limit = this._cachedLimit || this.DEFAULT_LIMIT;
        return Math.floor(limit * this.SAFE_RATIO);
    },

    /**
     * Check if text exceeds safe limit
     * @param {string} text - Text to check
     * @param {string} platform - Platform identifier
     * @returns {boolean}
     */
    exceedsLimit(text, platform) {
        return this.estimate(text) > this.getSafeLimitSync(platform);
    },

    /**
     * Get remaining tokens available
     * @param {string} currentText - Current text content
     * @param {string} platform - Platform identifier
     * @returns {number} Remaining tokens
     */
    getRemainingTokens(currentText, platform) {
        const used = this.estimate(currentText);
        const limit = this.getSafeLimitSync(platform);
        return Math.max(0, limit - used);
    },

    /**
     * Format token count for display
     * @param {number} tokens - Token count
     * @returns {string} Formatted string
     */
    formatCount(tokens) {
        if (tokens >= 1000) {
            return `${(tokens / 1000).toFixed(1)}k`;
        }
        return tokens.toString();
    },

    /**
     * Initialize - load cached limit
     */
    async init() {
        await this.getLimit();
    }
};

// Initialize on load
TokenEstimator.init();

// Make available globally
window.TokenEstimator = TokenEstimator;
