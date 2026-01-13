/**
 * Selection Manager
 * Handles interactive message selection for partial saving
 * Lincoln - AI Context Linker
 */

const SelectionManager = {
    isActive: false,
    elements: [],
    selectedIndices: new Set(),
    onComplete: null,
    overlay: null,

    /**
     * Start selection mode
     * @param {HTMLElement[]} elements - List of message elements to select from
     * @param {Function} onComplete - Callback(selectedIndices) when done
     */
    start(elements, onComplete) {
        if (this.isActive) return;
        this.isActive = true;
        this.elements = elements;
        this.onComplete = onComplete;
        this.selectedIndices.clear();

        this.injectStyles();

        // Temporary hide the main button
        if (typeof DraggableSaveButton !== 'undefined') {
            document.getElementById('lincoln-save-btn').style.display = 'none';
        }

        this.createSelectionUI();
        this.attachListeners();
    },

    attachListeners() {
        this.elements.forEach((el, index) => {
            el.classList.add('lincoln-selectable');
            el._lincolnClickHandler = (e) => {
                // Prevent default actions (opening images, etc)
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                this.toggleSelection(index);
            };
            // Use capture to ensuring we get the click first
            el.addEventListener('click', el._lincolnClickHandler, { capture: true });

            // Prevent text selection drag
            el.addEventListener('mousedown', (e) => e.stopPropagation(), { capture: true });
        });
    },

    detachListeners() {
        this.elements.forEach((el) => {
            el.classList.remove('lincoln-selectable');
            el.classList.remove('lincoln-selected');
            if (el._lincolnClickHandler) {
                el.removeEventListener('click', el._lincolnClickHandler, { capture: true });
                el.removeEventListener('mousedown', (e) => e.stopPropagation(), { capture: true });
                delete el._lincolnClickHandler;
            }
        });
    },

    toggleSelection(index) {
        const el = this.elements[index];
        if (this.selectedIndices.has(index)) {
            this.selectedIndices.delete(index);
            el.classList.remove('lincoln-selected');
        } else {
            this.selectedIndices.add(index);
            el.classList.add('lincoln-selected');
        }
        this.updateUI();
    },

    selectAll() {
        this.elements.forEach((el, index) => {
            this.selectedIndices.add(index);
            el.classList.add('lincoln-selected');
        });
        this.updateUI();
    },

    clearSelection() {
        this.selectedIndices.clear();
        this.elements.forEach(el => el.classList.remove('lincoln-selected'));
        this.updateUI();
    },

    confirm() {
        const indices = Array.from(this.selectedIndices).sort((a, b) => a - b);
        this.cleanup();
        if (this.onComplete) this.onComplete(indices);
    },

    cancel() {
        this.cleanup();
        if (typeof DraggableSaveButton !== 'undefined') {
            // Restore visible if preference says so
            DraggableSaveButton.isVisible().then(visible => {
                if (visible) DraggableSaveButton.show();
            });
        }
    },

    cleanup() {
        this.isActive = false;
        this.detachListeners();
        if (this.overlay) this.overlay.remove();
        this.overlay = null;
        this.elements = [];
        this.selectedIndices.clear();
    },

    injectStyles() {
        if (document.getElementById('lincoln-selection-styles')) return;
        const style = document.createElement('style');
        style.id = 'lincoln-selection-styles';
        style.textContent = `
            .lincoln-selectable {
                cursor: pointer !important;
                transition: all 0.15s ease;
                position: relative;
            }
            .lincoln-selectable::after {
                content: '';
                position: absolute;
                inset: 0;
                border: 2px dashed rgba(34, 211, 238, 0.4);
                pointer-events: none;
                z-index: 999;
                border-radius: 4px;
                opacity: 0;
                transition: opacity 0.15s;
            }
            .lincoln-selectable:hover::after {
                opacity: 1;
            }
            .lincoln-selected::after {
                border: 2px solid #a855f7;
                background: rgba(168, 85, 247, 0.05);
                opacity: 1;
            }
        `;
        document.head.appendChild(style);
    },

    createSelectionUI() {
        const bar = document.createElement('div');
        bar.style.cssText = `
            position: fixed;
            bottom: 30px;
            left: 50%;
            transform: translateX(-50%);
            background: #0f172a;
            border: 1px solid #334155;
            border-radius: 12px;
            padding: 12px 24px;
            display: flex;
            align-items: center;
            gap: 16px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            z-index: 10000;
            color: white;
            font-family: -apple-system, system-ui, sans-serif;
            animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        `;

        this.overlay = bar;
        this.updateUI(); // Render content
        document.body.appendChild(bar);

        // Add keyframes if needed
        if (!document.getElementById('lincoln-anim-styles')) {
            const style = document.createElement('style');
            style.id = 'lincoln-anim-styles';
            style.textContent = `@keyframes slideUp { from { transform: translate(-50%, 100%); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }`;
            document.head.appendChild(style);
        }
    },

    updateUI() {
        if (!this.overlay) return;

        const count = this.selectedIndices.size;

        this.overlay.innerHTML = `
            <div style="font-weight: 600; color: #e2e8f0; font-size: 14px;">
                ${count} selected
            </div>
            <div style="height: 20px; width: 1px; background: #334155;"></div>
            <button id="lincoln-sel-all" style="background:none; border:none; color:#94a3b8; cursor:pointer; font-size:13px; padding:4px 8px;">All</button>
            <button id="lincoln-sel-none" style="background:none; border:none; color:#94a3b8; cursor:pointer; font-size:13px; padding:4px 8px;">Clear</button>
             <div style="height: 20px; width: 1px; background: #334155;"></div>
            <button id="lincoln-sel-cancel" style="background:none; border:1px solid #334155; color:#cbd5e1; cursor:pointer; border-radius:6px; padding:6px 12px; font-size:13px;">Cancel</button>
            <button id="lincoln-sel-confirm" style="background: linear-gradient(135deg, #06b6d4, #8b5cf6); border:none; color:white; cursor:pointer; border-radius:6px; padding:6px 16px; font-weight:500; font-size:13px;">Save Selection</button>
        `;

        this.overlay.querySelector('#lincoln-sel-all').onclick = () => this.selectAll();
        this.overlay.querySelector('#lincoln-sel-none').onclick = () => this.clearSelection();
        this.overlay.querySelector('#lincoln-sel-cancel').onclick = () => this.cancel();
        this.overlay.querySelector('#lincoln-sel-confirm').onclick = () => this.confirm();
    }
};
