/**
 * IndexedDB Schema Definition
 * Defines the database structure for context storage
 */

const ContextSchema = {
    DB_NAME: 'AIContextLinker',
    DB_VERSION: 1,
    STORE_NAME: 'contexts',

    /**
     * Context object structure
     * {
     *   id: "context://uuid",
     *   platform: "chatgpt" | "gemini",
     *   createdAt: timestamp,
     *   title: "Optional user label",
     *   messages: [
     *     { role: "user" | "assistant", content: "Full raw text" }
     *   ]
     * }
     */

    /**
     * Generate a new context ID
     * @returns {string} Context ID in format context://uuid
     */
    generateId() {
        const uuid = crypto.randomUUID();
        return `context://${uuid}`;
    },

    /**
     * Validate a context object
     * @param {Object} context - Context to validate
     * @returns {boolean}
     */
    validate(context) {
        if (!context) return false;
        if (!context.id || !context.id.startsWith('context://')) return false;
        if (!context.platform) return false;
        if (!Array.isArray(context.messages)) return false;

        return context.messages.every(msg =>
            msg.role &&
            (msg.role === 'user' || msg.role === 'assistant') &&
            typeof msg.content === 'string'
        );
    },

    /**
     * Create a new context object
     * @param {string} platform - Platform identifier
     * @param {Array} messages - Array of message objects
     * @param {string} title - Optional title
     * @returns {Object} Context object
     */
    create(platform, messages, title = '') {
        return {
            id: this.generateId(),
            platform: platform,
            createdAt: Date.now(),
            title: title || `Context ${new Date().toLocaleString()}`,
            messages: messages
        };
    }
};

// Make available globally
window.ContextSchema = ContextSchema;
