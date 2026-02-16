/**
 * Barcode Scanner Input Handler
 *
 * Handles barcode scanner input (which typically acts as keyboard input)
 * Detects rapid keystrokes followed by Enter key as scanner input
 */

const ScannerService = {
    // Configuration
    config: {
        minBarcodeLength: 1,
        maxBarcodeLength: 50,
        scanTimeout: 100, // ms between keystrokes to consider it scanner input
        requireEnter: true // Scanner typically sends Enter after barcode
    },

    // State
    buffer: '',
    lastKeyTime: 0,
    activeInput: null,
    onScanCallback: null,

    // Initialize scanner for a specific input
    attachToInput(inputElement, onScan) {
        this.activeInput = inputElement;
        this.onScanCallback = onScan;
        this.buffer = '';

        // Remove existing listeners
        inputElement.removeEventListener('keydown', this.handleKeyDown);
        inputElement.removeEventListener('input', this.handleInput);

        // Attach new listeners
        inputElement.addEventListener('keydown', this.handleKeyDown.bind(this));
        inputElement.addEventListener('input', this.handleInput.bind(this));

        // Focus the input
        inputElement.focus();
    },

    detach() {
        if (this.activeInput) {
            this.activeInput.removeEventListener('keydown', this.handleKeyDown);
            this.activeInput.removeEventListener('input', this.handleInput);
            this.activeInput = null;
        }
        this.onScanCallback = null;
        this.buffer = '';
    },

    handleKeyDown(event) {
        const now = Date.now();

        // Check if this is rapid input (likely from scanner)
        if (event.key === 'Enter') {
            event.preventDefault();

            const barcode = this.activeInput.value.trim();

            if (barcode.length >= this.config.minBarcodeLength) {
                this.processScan(barcode);
            }

            return;
        }

        // Track timing for scanner detection
        this.lastKeyTime = now;
    },

    handleInput(event) {
        // Input event fires after value changes
        // We use this to handle paste events and mobile input
    },

    processScan(barcode) {
        if (!barcode || barcode.length < this.config.minBarcodeLength) {
            return;
        }

        if (barcode.length > this.config.maxBarcodeLength) {
            console.warn('Barcode too long, truncating');
            barcode = barcode.substring(0, this.config.maxBarcodeLength);
        }

        // Clear the input
        if (this.activeInput) {
            this.activeInput.value = '';
        }

        // Trigger haptic feedback if available
        this.triggerHaptic();

        // Call the callback
        if (this.onScanCallback) {
            this.onScanCallback(barcode);
        }
    },

    // Manual submit (for when user types and clicks button)
    manualSubmit() {
        if (this.activeInput) {
            const barcode = this.activeInput.value.trim();
            if (barcode) {
                this.processScan(barcode);
            }
        }
    },

    // Get current value without submitting
    getCurrentValue() {
        return this.activeInput?.value?.trim() || '';
    },

    // Set input value programmatically
    setValue(value) {
        if (this.activeInput) {
            this.activeInput.value = value;
        }
    },

    // Clear input
    clear() {
        if (this.activeInput) {
            this.activeInput.value = '';
        }
        this.buffer = '';
    },

    // Focus the active input
    focus() {
        if (this.activeInput) {
            this.activeInput.focus();
        }
    },

    // Trigger haptic feedback (mobile)
    triggerHaptic() {
        if ('vibrate' in navigator) {
            navigator.vibrate(50);
        }
    },

    // Play success sound (optional)
    playSuccessSound() {
        // Could add audio feedback here
    },

    // Play error sound (optional)
    playErrorSound() {
        if ('vibrate' in navigator) {
            navigator.vibrate([100, 50, 100]);
        }
    }
};

// Export for use in other modules
window.ScannerService = ScannerService;
