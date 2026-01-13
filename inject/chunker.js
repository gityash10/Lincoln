/**
 * Context Chunker
 * Token-aware chunking for context injection
 */

const ContextChunker = {
    /**
     * Calculate token-safe message subset
     * Prioritizes most recent messages when over limit
     * 
     * @param {Object} context - Context object
     * @param {string} platform - Platform identifier
     * @returns {Object} Result with messages and metadata
     */
    chunk(context, platform) {
        const safeLimit = TokenEstimator.getSafeLimit(platform);
        const messages = context.messages;

        // Calculate overhead for formatting
        const overheadTokens = TokenEstimator.estimate(ContextFormatter.SYSTEM_PREFIX) + 100;
        const availableTokens = safeLimit - overheadTokens;

        // Try to fit all messages
        let totalTokens = 0;
        let includedMessages = [];

        // Start from the end (most recent) and work backwards
        for (let i = messages.length - 1; i >= 0; i--) {
            const msg = messages[i];
            const formattedMsg = ContextFormatter.formatMessage(msg);
            const msgTokens = TokenEstimator.estimate(formattedMsg);

            if (totalTokens + msgTokens <= availableTokens) {
                includedMessages.unshift(msg);
                totalTokens += msgTokens;
            } else {
                break;
            }
        }

        return {
            messages: includedMessages,
            totalMessages: messages.length,
            includedCount: includedMessages.length,
            estimatedTokens: totalTokens + overheadTokens,
            isPartial: includedMessages.length < messages.length,
            truncatedCount: messages.length - includedMessages.length
        };
    },

    /**
     * Get chunked and formatted context ready for injection
     * 
     * @param {Object} context - Context object
     * @param {string} platform - Platform identifier
     * @param {string} currentMessage - Current user message (optional)
     * @returns {Object} Result with formatted text and metadata
     */
    getInjectionPayload(context, platform, currentMessage = '') {
        const chunkResult = this.chunk(context, platform);

        let formattedContext;
        if (chunkResult.isPartial) {
            formattedContext = ContextFormatter.formatPartial(
                { messages: chunkResult.messages },
                chunkResult.includedCount
            );
            formattedContext = formattedContext.replace(
                `last ${chunkResult.includedCount} of ${chunkResult.includedCount}`,
                `last ${chunkResult.includedCount} of ${chunkResult.totalMessages}`
            );
        } else {
            formattedContext = ContextFormatter.format(
                { messages: chunkResult.messages }
            );
        }

        if (currentMessage) {
            formattedContext += `[CURRENT REQUEST]: ${currentMessage}`;
        }

        return {
            text: formattedContext,
            ...chunkResult,
            estimatedTokens: TokenEstimator.estimate(formattedContext)
        };
    },

    /**
     * Check if context will fit within limits
     * 
     * @param {Object} context - Context object
     * @param {string} platform - Platform identifier
     * @returns {boolean}
     */
    willFit(context, platform) {
        const result = this.chunk(context, platform);
        return !result.isPartial;
    }
};

// Make available globally
window.ContextChunker = ContextChunker;
