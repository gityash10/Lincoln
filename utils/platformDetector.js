/**
 * Platform Detector
 * Detects which AI platform the user is currently on
 */

const PlatformDetector = {
  PLATFORMS: {
    CHATGPT: 'chatgpt',
    GEMINI: 'gemini',
    UNKNOWN: 'unknown'
  },

  /**
   * Detect the current platform based on URL
   * @returns {string} Platform identifier
   */
  detect() {
    const hostname = window.location.hostname;
    
    if (hostname.includes('chat.openai.com') || hostname.includes('chatgpt.com')) {
      return this.PLATFORMS.CHATGPT;
    }
    
    if (hostname.includes('gemini.google.com')) {
      return this.PLATFORMS.GEMINI;
    }
    
    return this.PLATFORMS.UNKNOWN;
  },

  /**
   * Check if current platform is supported
   * @returns {boolean}
   */
  isSupported() {
    return this.detect() !== this.PLATFORMS.UNKNOWN;
  },

  /**
   * Get platform display name
   * @returns {string}
   */
  getDisplayName() {
    const platform = this.detect();
    switch (platform) {
      case this.PLATFORMS.CHATGPT:
        return 'ChatGPT';
      case this.PLATFORMS.GEMINI:
        return 'Gemini';
      default:
        return 'Unknown';
    }
  }
};

// Make available globally
window.PlatformDetector = PlatformDetector;
