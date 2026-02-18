/**
 * UI State Management & DOM Utilities
 */

const UI = {
    // Screen management
    screens: {
        welcome: 'screen-welcome',
        upload: 'screen-upload',
        scan: 'screen-scan'
    },

    steps: {
        musipos: 'step-musipos',
        itemInfo: 'step-item-info',
        productBarcode: 'step-product-barcode',
        quantity: 'step-quantity',
        confirm: 'step-confirm'
    },

    // Show a specific screen
    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });

        const screen = document.getElementById(screenId);
        if (screen) {
            screen.classList.add('active');
        }
    },

    // Show a specific step within the scan screen
    showStep(stepId) {
        document.querySelectorAll('.scan-step').forEach(step => {
            step.classList.remove('active');
        });

        const step = document.getElementById(stepId);
        if (step) {
            step.classList.add('active');
        }
    },

    // Get element by ID
    $(id) {
        return document.getElementById(id);
    },

    // Show/hide element
    show(elementOrId) {
        const el = typeof elementOrId === 'string'
            ? this.$(elementOrId)
            : elementOrId;
        if (el) el.classList.remove('hidden');
    },

    hide(elementOrId) {
        const el = typeof elementOrId === 'string'
            ? this.$(elementOrId)
            : elementOrId;
        if (el) el.classList.add('hidden');
    },

    // Loading overlay
    showLoading(message = 'Loading...') {
        this.$('loading-message').textContent = message;
        this.hide('loading-progress-container');
        this.show('loading-overlay');
    },

    showLoadingWithProgress(message, percent) {
        this.$('loading-message').textContent = message;
        this.$('loading-progress-bar').style.width = percent + '%';
        this.$('loading-progress-text').textContent = percent + '%';
        this.show('loading-progress-container');
        this.show('loading-overlay');
    },

    hideLoading() {
        this.hide('loading-overlay');
        this.hide('loading-progress-container');
        this.$('loading-progress-bar').style.width = '0%';
    },

    // Toast notifications
    toast(message, type = 'default', duration = 3000) {
        const container = this.$('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;

        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(20px)';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    },

    success(message) {
        this.toast(message, 'success');
    },

    error(message) {
        this.toast(message, 'error', 5000);
    },

    warning(message) {
        this.toast(message, 'warning', 4000);
    },

    // Update text content
    setText(id, text) {
        const el = this.$(id);
        if (el) el.textContent = text;
    },

    // Update HTML content
    setHTML(id, html) {
        const el = this.$(id);
        if (el) el.innerHTML = html;
    },

    // Set input value
    setValue(id, value) {
        const el = this.$(id);
        if (el) el.value = value;
    },

    // Get input value
    getValue(id) {
        const el = this.$(id);
        return el ? el.value : '';
    },

    // Focus an input
    focusInput(id) {
        const el = this.$(id);
        if (el) {
            el.focus();
            // On mobile, scroll into view
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    },

    // Clear an input
    clearInput(id) {
        const el = this.$(id);
        if (el) el.value = '';
    },

    // Display item details
    displayItem(item) {
        this.setText('item-sku', item.Supplier_Item_ID || 'N/A');
        this.setText('item-title', item.Title || 'Unknown Item');
        this.setText('item-barcode', item.Barcode || 'N/A');
        this.setText('item-product-barcode', item.Product_Barcode || 'Not set');
        this.setText('item-qty', item.Quantity_on_hand || '0');
    },

    // Display confirmation summary
    displayConfirmation(item, productBarcode, quantity) {
        this.setText('confirm-title', item.Title || 'Unknown Item');
        this.setText('confirm-sku', item.Supplier_Item_ID || 'N/A');
        this.setText('confirm-product-barcode', productBarcode || 'Not set');
        this.setText('confirm-quantity', quantity.toString());
    },

    // Update session info in header
    updateSessionInfo(session) {
        if (session) {
            this.setText('session-name', session.csvFileName || 'Session');
            this.setText('items-count', `${session.updatedCount || 0} / ${session.itemCount || 0} items updated`);
        }
    },

    // Render session list
    renderSessionList(sessions) {
        const container = this.$('session-list-items');
        if (!sessions || sessions.length === 0) {
            this.hide('existing-sessions');
            return;
        }

        this.show('existing-sessions');
        container.innerHTML = sessions.map(session => `
            <div class="session-list-item" data-session-id="${session.id}">
                <div>
                    <div class="session-name">${session.csvFileName || 'Unknown'}</div>
                    <div class="session-date">${this.formatDate(session.createdAt)}</div>
                </div>
                <div style="display: flex; align-items: center; gap: 12px;">
                    <span>${session.updatedCount || 0}/${session.itemCount || 0}</span>
                    <button class="btn-delete-session" data-session-id="${session.id}" title="Delete session" style="background:none;border:none;color:var(--error);font-size:1.25rem;cursor:pointer;padding:4px;">&times;</button>
                </div>
            </div>
        `).join('');
    },

    // Render unknown barcodes list
    renderUnknownBarcodes(barcodes) {
        const container = this.$('unknown-list');
        this.setText('unknown-count', barcodes.length.toString());

        if (barcodes.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: var(--text-light);">No unknown barcodes logged</p>';
            return;
        }

        container.innerHTML = barcodes.map(item => `
            <div class="unknown-item">
                <span>${item.barcode}</span>
                <span class="timestamp">${this.formatTime(item.scannedAt)}</span>
            </div>
        `).join('');
    },

    // Format timestamp
    formatDate(timestamp) {
        if (!timestamp) return 'Unknown date';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString();
    },

    formatTime(timestamp) {
        if (!timestamp) return '';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    },

    // Show existing product barcode
    showExistingProductBarcode(barcode) {
        if (barcode && barcode.trim()) {
            this.setText('current-product-barcode', barcode);
            this.show('existing-product-barcode');
        } else {
            this.hide('existing-product-barcode');
        }
    },

    // Update quantity display
    updateQuantityDisplay(quantity) {
        this.setText('quantity-value', quantity.toString());
        this.setValue('input-quantity', quantity.toString());
    },

    // Show scan feedback
    showScanFeedback(message, type = 'success') {
        const feedback = this.$('scan-count-feedback');
        feedback.textContent = message;
        feedback.className = `feedback ${type}`;
        this.show(feedback);

        // Auto-hide after delay
        setTimeout(() => this.hide(feedback), 2000);
    },

    // Show error message
    showError(elementId, message) {
        const el = this.$(elementId);
        if (el) {
            el.textContent = message;
            this.show(el);
        }
    },

    hideError(elementId) {
        this.hide(elementId);
    }
};

// Export for use in other modules
window.UI = UI;
