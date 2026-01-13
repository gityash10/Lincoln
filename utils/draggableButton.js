/**
 * Draggable Save Button with Hide/Show Feature
 * Creates a movable "Save Context" button with position persistence
 * Lincoln - AI Context Linker
 */

const DraggableSaveButton = {
    button: null,
    isDragging: false,
    dragOffset: { x: 0, y: 0 },
    STORAGE_KEY: 'lincolnButtonPosition',
    VISIBILITY_KEY: 'lincolnButtonVisible',

    /**
     * Default button position
     */
    defaultPosition: {
        top: 16,
        right: 80
    },

    /**
     * Check if button should be visible
     */
    async isVisible() {
        try {
            const result = await chrome.storage.local.get(this.VISIBILITY_KEY);
            return result[this.VISIBILITY_KEY] !== false; // Default to visible
        } catch (e) {
            return true;
        }
    },

    /**
     * Set button visibility
     */
    async setVisibility(visible) {
        try {
            await chrome.storage.local.set({ [this.VISIBILITY_KEY]: visible });

            if (visible) {
                this.show();
            } else {
                this.hide();
            }
        } catch (e) {
            console.error('[Lincoln] Failed to save visibility:', e);
        }
    },

    /**
     * Show the button
     */
    show() {
        if (this.button) {
            this.button.style.display = 'flex';
        }
    },

    /**
     * Hide the button
     */
    hide() {
        if (this.button) {
            this.button.style.display = 'none';
        }
    },

    /**
     * Create and inject the draggable save button
     * @param {Function} onSave - Callback when save is clicked
     * @param {Function} onSelect - Callback when select mode is clicked
     */
    async create(onSave, onSelect) {
        if (document.getElementById('lincoln-save-btn')) return;

        // Check visibility preference
        const shouldShow = await this.isVisible();

        // Load saved position
        const position = await this.loadPosition();

        const button = document.createElement('button');
        button.id = 'lincoln-save-btn';
        button.innerHTML = `
      <div class="lincoln-drag-handle" title="Drag to move">⋮⋮</div>
      <div class="lincoln-save-action" title="Save entire chat">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
            <polyline points="17,21 17,13 7,13 7,21"/>
            <polyline points="7,3 7,8 15,8"/>
        </svg>
        <span>Save</span>
      </div>
      <div class="lincoln-separator"></div>
      <div class="lincoln-select-action" title="Select messages">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
        </svg>
      </div>
      <div class="lincoln-close-btn" title="Hide button">×</div>
    `;

        // Base styles - Lincoln brand colors
        button.style.cssText = `
      position: fixed;
      display: ${shouldShow ? 'flex' : 'none'};
      align-items: center;
      gap: 0;
      padding: 0;
      background: linear-gradient(135deg, #22d3ee, #a855f7);
      color: white;
      border: none;
      border-radius: 20px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 13px;
      font-weight: 600;
      cursor: default;
      z-index: 9999;
      box-shadow: 0 4px 16px rgba(168, 85, 247, 0.4);
      transition: box-shadow 0.2s ease, transform 0.1s ease;
      user-select: none;
      overflow: hidden;
    `;

        // Apply position
        this.applyPosition(button, position);

        // Add styles for components
        const style = document.createElement('style');
        style.id = 'lincoln-button-styles';
        style.textContent = `
      #lincoln-save-btn .lincoln-drag-handle {
        cursor: grab;
        padding: 8px 4px 8px 10px;
        color: rgba(255,255,255,0.6);
        font-size: 12px;
        letter-spacing: -2px;
        transition: color 0.2s;
      }
      #lincoln-save-btn .lincoln-drag-handle:hover {
        color: rgba(255,255,255,1);
      }
      #lincoln-save-btn .lincoln-drag-handle:active {
        cursor: grabbing;
      }
      
      #lincoln-save-btn .lincoln-save-action {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px 10px 8px 6px;
        cursor: pointer;
        transition: background 0.2s;
      }
      #lincoln-save-btn .lincoln-save-action:hover {
        background: rgba(255,255,255,0.1);
      }
      
      #lincoln-save-btn .lincoln-separator {
        width: 1px;
        height: 16px;
        background: rgba(255,255,255,0.2);
      }
      
      #lincoln-save-btn .lincoln-select-action {
        display: flex;
        align-items: center;
        padding: 8px 10px;
        cursor: pointer;
        transition: background 0.2s;
        opacity: 0.8;
      }
      #lincoln-save-btn .lincoln-select-action:hover {
        background: rgba(255,255,255,0.1);
        opacity: 1;
      }
      
      #lincoln-save-btn .lincoln-close-btn {
        margin-right: 8px;
        margin-left: 2px;
        padding: 2px 5px;
        cursor: pointer;
        font-size: 16px;
        opacity: 0.6;
        border-radius: 4px;
        font-weight: 300;
        color: rgba(255, 255, 255, 0.5);
        transition: color 0.2s;
        line-height: 1;
      }
      #lincoln-save-btn .lincoln-close-btn:hover {
          background: rgba(255,255,255,0.2);
          opacity: 1;
          color: rgba(255, 255, 255, 1);
      }
      
      #lincoln-save-btn:hover {
        box-shadow: 0 6px 20px rgba(168, 85, 247, 0.5);
      }
      #lincoln-save-btn.dragging {
        opacity: 0.9;
        cursor: grabbing !important;
        transform: scale(1.02);
      }
    `;

        if (!document.getElementById('lincoln-button-styles')) {
            document.head.appendChild(style);
        }

        // Drag handle events
        const dragHandle = button.querySelector('.lincoln-drag-handle');
        dragHandle.addEventListener('mousedown', (e) => this.startDrag(e, button));

        // Close button events
        const closeBtn = button.querySelector('.lincoln-close-btn');
        closeBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await this.setVisibility(false);
            this.showHideToast();
        });

        // Save Action
        const saveAction = button.querySelector('.lincoln-save-action');
        saveAction.addEventListener('click', (e) => {
            if (!this.isDragging) onSave();
        });

        // Select Action
        const selectAction = button.querySelector('.lincoln-select-action');
        if (onSelect) {
            selectAction.addEventListener('click', (e) => {
                if (!this.isDragging) onSelect();
            });
        }

        // Global mouse events for dragging
        document.addEventListener('mousemove', (e) => this.onDrag(e, button));
        document.addEventListener('mouseup', (e) => this.endDrag(e, button));

        document.body.appendChild(button);
        this.button = button;
    },

    /**
     * Show toast when button is hidden
     */
    showHideToast() {
        const existing = document.getElementById('lincoln-hide-toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.id = 'lincoln-hide-toast';
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            padding: 12px 20px;
            background: linear-gradient(135deg, #1a1a2e, #2d2d44);
            border: 1px solid #a855f7;
            border-radius: 10px;
            color: white;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            font-size: 13px;
            z-index: 10000;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
            animation: slideIn 0.3s ease;
        `;
        toast.innerHTML = `
            <div style="font-weight: 600; margin-bottom: 4px;">Button Hidden</div>
            <div style="color: #a0a0a0; font-size: 12px;">Click Lincoln popup → "Show Button" to restore</div>
        `;

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
     * Apply position to button
     */
    applyPosition(button, position) {
        button.style.top = 'auto';
        button.style.right = 'auto';
        button.style.bottom = 'auto';
        button.style.left = 'auto';

        if (position.left !== undefined) {
            button.style.left = `${position.left}px`;
        } else if (position.right !== undefined) {
            button.style.right = `${position.right}px`;
        }

        if (position.top !== undefined) {
            button.style.top = `${position.top}px`;
        } else if (position.bottom !== undefined) {
            button.style.bottom = `${position.bottom}px`;
        }
    },

    /**
     * Start dragging
     */
    startDrag(e, button) {
        e.preventDefault();
        e.stopPropagation();

        this.isDragging = true;
        button.classList.add('dragging');

        const rect = button.getBoundingClientRect();
        this.dragOffset = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    },

    /**
     * Handle drag movement
     */
    onDrag(e, button) {
        if (!this.isDragging) return;

        e.preventDefault();

        const newLeft = e.clientX - this.dragOffset.x;
        const newTop = e.clientY - this.dragOffset.y;

        const maxLeft = window.innerWidth - button.offsetWidth - 10;
        const maxTop = window.innerHeight - button.offsetHeight - 10;

        const boundedLeft = Math.max(10, Math.min(newLeft, maxLeft));
        const boundedTop = Math.max(10, Math.min(newTop, maxTop));

        button.style.left = `${boundedLeft}px`;
        button.style.top = `${boundedTop}px`;
        button.style.right = 'auto';
        button.style.bottom = 'auto';
    },

    /**
     * End dragging and save position
     */
    async endDrag(e, button) {
        if (!this.isDragging) return;

        this.isDragging = false;
        button.classList.remove('dragging');

        const rect = button.getBoundingClientRect();
        const position = {
            left: rect.left,
            top: rect.top
        };

        await this.savePosition(position);
    },

    /**
     * Save position to chrome.storage
     */
    async savePosition(position) {
        try {
            await chrome.storage.local.set({ [this.STORAGE_KEY]: position });
        } catch (error) {
            console.error('[Lincoln] Failed to save position:', error);
        }
    },

    /**
     * Load position from chrome.storage
     */
    async loadPosition() {
        try {
            const result = await chrome.storage.local.get(this.STORAGE_KEY);
            return result[this.STORAGE_KEY] || this.defaultPosition;
        } catch (error) {
            return this.defaultPosition;
        }
    },

    /**
     * Reset position to default
     */
    async resetPosition() {
        if (this.button) {
            this.applyPosition(this.button, this.defaultPosition);
            await this.savePosition(this.defaultPosition);
        }
    }
};

// Make available globally
window.DraggableSaveButton = DraggableSaveButton;
