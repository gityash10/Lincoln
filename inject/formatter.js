/**
 * Context Formatter
 * Formats stored context for injection into AI chats
 */

const ContextFormatter = {
    /**
     * System prefix for context injection
     */
    SYSTEM_PREFIX: `=== PREVIOUS CONVERSATION CONTEXT ===
The following is a previous conversation that has already occurred.
Treat this entire conversation as completed context and continue from where it left off.
Do not repeat or summarize this context - simply use it as reference for continuity.
===================================

`,

    /**
     * Format a single message
     * @param {Object} message - Message object with role and content
     * @returns {string} Formatted message
     */
    formatMessage(message) {
        const roleLabel = message.role === 'user' ? 'USER' : 'ASSISTANT';
        return `[${roleLabel}]: ${message.content}`;
    },

    /**
     * Format all messages from a context
     * @param {Array} messages - Array of message objects
     * @returns {string} Formatted conversation
     */
    formatMessages(messages) {
        return messages.map(msg => this.formatMessage(msg)).join('\n\n');
    },

    /**
     * Format full context for injection
     * @param {Object} context - Context object
     * @param {string} currentMessage - Current user message (optional)
     * @returns {string} Fully formatted context ready for injection
     */
    format(context, currentMessage = '') {
        let formatted = this.SYSTEM_PREFIX;
        formatted += this.formatMessages(context.messages);
        formatted += '\n\n=== END OF PREVIOUS CONTEXT ===\n\n';

        if (currentMessage) {
            formatted += `[CURRENT REQUEST]: ${currentMessage}`;
        }

        return formatted;
    },

    /**
     * Format context with partial messages (for overflow handling)
     * @param {Object} context - Context object
     * @param {number} messageCount - Number of recent messages to include
     * @returns {string} Formatted partial context
     */
    formatPartial(context, messageCount) {
        const recentMessages = context.messages.slice(-messageCount);

        let formatted = this.SYSTEM_PREFIX;
        formatted += `[Note: Showing last ${messageCount} of ${context.messages.length} messages due to length limits]\n\n`;
        formatted += this.formatMessages(recentMessages);
        formatted += '\n\n=== END OF PREVIOUS CONTEXT ===\n\n';

        return formatted;
    },

    /**
     * Get a preview of the context
     * @param {Object} context - Context object
     * @param {number} maxLength - Maximum preview length
     * @returns {string} Preview text
     */
    getPreview(context, maxLength = 100) {
        if (!context.messages || context.messages.length === 0) {
            return 'Empty context';
        }

        const firstMessage = context.messages[0].content;
        if (firstMessage.length <= maxLength) {
            return firstMessage;
        }

        return firstMessage.substring(0, maxLength) + '...';
    }
};

// Make available globally
window.ContextFormatter = ContextFormatter;
