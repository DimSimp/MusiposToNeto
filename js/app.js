/**
 * Main Application Logic
 * Coordinates all services and handles the stocktake workflow
 */

const App = {
    // Application state
    state: {
        userName: '',
        sessionId: null,
        currentItem: null,
        newProductBarcode: '',
        quantity: 0,
        expectedBarcode: null, // For scan-to-count validation
        unknownBarcodes: []
    },

    // Camera scanner
    cameraScanner: null,
    cameraScanCallback: null,

    // Firebase listeners (for cleanup)
    listeners: {
        session: null,
        unknownBarcodes: null
    },

    // Initialize the application
    async init() {
        console.log('Initializing Stocktake App...');

        try {
            // Initialize Firebase
            await FirebaseService.init();

            // Sign in anonymously
            await FirebaseService.signInAnonymously();

            // Check for saved user name
            const savedName = localStorage.getItem('stocktake_username');
            if (savedName) {
                UI.setValue('user-name', savedName);
            }

            // Check for saved session
            const savedSession = localStorage.getItem('stocktake_session');
            if (savedSession) {
                this.state.sessionId = savedSession;
            }

            // Set up event listeners
            this.setupEventListeners();

            console.log('App initialized successfully');
        } catch (error) {
            console.error('Initialization error:', error);
            UI.error('Failed to initialize app. Please refresh the page.');
        }
    },

    // Set up all event listeners
    setupEventListeners() {
        // Welcome screen
        UI.$('btn-start').addEventListener('click', () => this.handleStart());
        UI.$('user-name').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.handleStart();
        });

        // Upload screen
        UI.$('csv-upload').addEventListener('change', (e) => this.handleFileUpload(e));
        UI.$('session-list-items').addEventListener('click', (e) => {
            const sessionItem = e.target.closest('.session-list-item');
            if (sessionItem) {
                this.resumeSession(sessionItem.dataset.sessionId);
            }
        });

        // Scan screen - Step navigation
        UI.$('btn-confirm-musipos').addEventListener('click', () => this.submitMusiposBarcode());
        UI.$('btn-continue-to-product').addEventListener('click', () => this.goToProductBarcode());
        UI.$('btn-skip-item').addEventListener('click', () => this.skipItem());
        UI.$('btn-back-to-item-info').addEventListener('click', () => this.goToItemInfo());
        UI.$('btn-confirm-product').addEventListener('click', () => this.confirmProductBarcode());
        UI.$('btn-no-barcode').addEventListener('click', () => this.skipProductBarcode());
        UI.$('btn-confirm-quantity').addEventListener('click', () => this.goToConfirm());
        UI.$('btn-save').addEventListener('click', () => this.saveAndNext());
        UI.$('btn-back-to-qty').addEventListener('click', () => this.goToQuantity());
        UI.$('btn-back-to-product').addEventListener('click', () => this.goToProductBarcode());

        // Quantity controls
        UI.$('btn-qty-minus').addEventListener('click', () => this.adjustQuantity(-1));
        UI.$('btn-qty-plus').addEventListener('click', () => this.adjustQuantity(1));
        UI.$('input-quantity').addEventListener('change', (e) => {
            const val = parseInt(e.target.value) || 0;
            this.state.quantity = Math.max(0, val);
            UI.updateQuantityDisplay(this.state.quantity);
        });

        // Camera scan buttons
        document.querySelectorAll('.btn-camera').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const targetId = e.currentTarget.dataset.target;
                this.openCameraScanner(targetId);
            });
        });
        UI.$('btn-close-camera').addEventListener('click', () => this.closeCameraScanner());
        UI.$('btn-cancel-camera').addEventListener('click', () => this.closeCameraScanner());

        // Menu
        UI.$('btn-menu').addEventListener('click', () => UI.show('menu-overlay'));
        UI.$('btn-close-menu').addEventListener('click', () => UI.hide('menu-overlay'));
        UI.$('btn-view-unknown').addEventListener('click', () => {
            UI.hide('menu-overlay');
            UI.show('unknown-overlay');
        });
        UI.$('btn-close-unknown').addEventListener('click', () => UI.hide('unknown-overlay'));
        UI.$('btn-export').addEventListener('click', () => this.exportCSV());
        UI.$('btn-export-unknown').addEventListener('click', () => this.exportUnknownBarcodes());
        UI.$('btn-change-session').addEventListener('click', () => this.changeSession());

        // Close overlays on backdrop click
        UI.$('menu-overlay').addEventListener('click', (e) => {
            if (e.target.id === 'menu-overlay') UI.hide('menu-overlay');
        });
        UI.$('unknown-overlay').addEventListener('click', (e) => {
            if (e.target.id === 'unknown-overlay') UI.hide('unknown-overlay');
        });
    },

    // Handle start button
    async handleStart() {
        const name = UI.getValue('user-name').trim();

        if (!name) {
            UI.error('Please enter your name');
            return;
        }

        this.state.userName = name;
        localStorage.setItem('stocktake_username', name);

        UI.showLoading('Loading sessions...');

        try {
            // Load existing sessions
            const sessions = await FirebaseService.getSessions();
            UI.renderSessionList(sessions);

            UI.showScreen('screen-upload');
        } catch (error) {
            console.error('Error loading sessions:', error);
            UI.error('Failed to load sessions');
        } finally {
            UI.hideLoading();
        }
    },

    // Handle file upload
    async handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        UI.showLoading('Parsing CSV...');
        UI.setText('upload-status', `Processing ${file.name}...`);

        try {
            // Parse CSV
            const items = await CSVService.parseFile(file);
            const itemCount = items.length;

            UI.setText('upload-status', `Found ${itemCount} items. Uploading...`);
            UI.showLoading('Uploading to database...');

            // Create session in Firebase
            const sessionId = await FirebaseService.createSession(file.name, itemCount);

            // Upload items in batches
            await this.uploadItemsInBatches(sessionId, items);

            // Save session ID
            this.state.sessionId = sessionId;
            localStorage.setItem('stocktake_session', sessionId);

            UI.success(`Uploaded ${itemCount} items successfully!`);

            // Start scanning
            this.startScanning();
        } catch (error) {
            console.error('Upload error:', error);
            UI.error(`Upload failed: ${error.message}`);
            UI.setText('upload-status', '');
        } finally {
            UI.hideLoading();
            // Reset file input
            event.target.value = '';
        }
    },

    // Upload items in batches with progress
    async uploadItemsInBatches(sessionId, items) {
        const batchSize = 400; // Slightly under Firestore limit
        const totalBatches = Math.ceil(items.length / batchSize);

        for (let i = 0; i < totalBatches; i++) {
            const start = i * batchSize;
            const end = Math.min(start + batchSize, items.length);
            const batch = items.slice(start, end);

            UI.showLoading(`Uploading batch ${i + 1} of ${totalBatches}...`);

            const itemsRef = firebase.firestore()
                .collection('stocktakes')
                .doc(sessionId)
                .collection('items');

            const writeBatch = firebase.firestore().batch();

            batch.forEach((item, index) => {
                const barcode = item.Barcode || `NO_BARCODE_${start + index}`;
                const docRef = itemsRef.doc(barcode);
                writeBatch.set(docRef, {
                    ...item,
                    _modified: false,
                    _stocktake_quantity: null,
                    _createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            });

            await writeBatch.commit();
        }
    },

    // Resume existing session
    async resumeSession(sessionId) {
        UI.showLoading('Loading session...');

        try {
            const session = await FirebaseService.getSession(sessionId);
            if (!session) {
                UI.error('Session not found');
                return;
            }

            this.state.sessionId = sessionId;
            localStorage.setItem('stocktake_session', sessionId);

            this.startScanning();
        } catch (error) {
            console.error('Error resuming session:', error);
            UI.error('Failed to load session');
        } finally {
            UI.hideLoading();
        }
    },

    // Start the scanning workflow
    async startScanning() {
        const session = await FirebaseService.getSession(this.state.sessionId);

        if (!session) {
            UI.error('Session not found');
            return;
        }

        // Update UI
        UI.updateSessionInfo(session);
        UI.setText('menu-user-name', this.state.userName);

        // Set up real-time listeners
        this.setupRealtimeListeners();

        // Show scan screen
        UI.showScreen('screen-scan');
        this.goToMusiposScan();
    },

    // Set up Firebase real-time listeners
    setupRealtimeListeners() {
        // Clean up existing listeners
        if (this.listeners.session) this.listeners.session();
        if (this.listeners.unknownBarcodes) this.listeners.unknownBarcodes();

        // Session updates
        this.listeners.session = FirebaseService.onSessionUpdate(
            this.state.sessionId,
            (session) => UI.updateSessionInfo(session)
        );

        // Unknown barcodes
        this.listeners.unknownBarcodes = FirebaseService.onUnknownBarcodesUpdate(
            this.state.sessionId,
            (barcodes) => {
                this.state.unknownBarcodes = barcodes;
                UI.renderUnknownBarcodes(barcodes);
            }
        );
    },

    // Step 1: Scan Musipos barcode
    goToMusiposScan() {
        // Reset state for new item
        this.state.currentItem = null;
        this.state.newProductBarcode = '';
        this.state.quantity = 0;
        this.state.expectedBarcode = null;

        UI.showStep('step-musipos');
        UI.hideError('musipos-error');
        UI.clearInput('input-musipos-barcode');

        // Attach scanner
        ScannerService.attachToInput(
            UI.$('input-musipos-barcode'),
            (barcode) => this.handleMusiposScan(barcode)
        );
    },

    // Submit musipos barcode via Confirm button
    submitMusiposBarcode() {
        const barcode = UI.getValue('input-musipos-barcode').trim().toUpperCase();
        if (barcode) {
            this.handleMusiposScan(barcode);
        }
    },

    // Handle Musipos barcode scan
    async handleMusiposScan(barcode) {
        UI.hideError('musipos-error');

        try {
            const item = await FirebaseService.getItemByBarcode(
                this.state.sessionId,
                barcode
            );

            if (!item) {
                // Log unknown barcode
                await FirebaseService.logUnknownBarcode(
                    this.state.sessionId,
                    barcode,
                    this.state.userName
                );

                UI.showError('musipos-error', `Barcode "${barcode}" not found in inventory. Logged for review.`);
                ScannerService.playErrorSound();
                UI.focusInput('input-musipos-barcode');
                return;
            }

            // Found item
            this.state.currentItem = item;
            this.goToItemInfo();
        } catch (error) {
            console.error('Lookup error:', error);
            UI.showError('musipos-error', 'Error looking up barcode. Please try again.');
        }
    },

    // Step 2: Show item info
    goToItemInfo() {
        UI.showStep('step-item-info');
        UI.displayItem(this.state.currentItem);
        ScannerService.detach();
    },

    // Skip current item
    skipItem() {
        this.goToMusiposScan();
    },

    // Step 3: Product barcode
    goToProductBarcode() {
        UI.showStep('step-product-barcode');
        UI.clearInput('input-product-barcode');

        // Show existing barcode if present
        const existingBarcode = this.state.currentItem.Product_Barcode;
        UI.showExistingProductBarcode(existingBarcode);

        // Pre-fill if exists
        if (existingBarcode) {
            UI.setValue('input-product-barcode', existingBarcode);
        }

        // Attach scanner - auto-advance on scan
        ScannerService.attachToInput(
            UI.$('input-product-barcode'),
            (barcode) => {
                this.state.newProductBarcode = barcode;
                this.state.expectedBarcode = barcode;
                this.goToQuantity();
            }
        );
    },

    // Confirm product barcode
    confirmProductBarcode() {
        const barcode = UI.getValue('input-product-barcode').trim();
        this.state.newProductBarcode = barcode;
        this.state.expectedBarcode = barcode; // For scan-to-count validation
        this.goToQuantity();
    },

    // Skip product barcode (no barcode on packaging)
    skipProductBarcode() {
        this.state.newProductBarcode = '';
        this.state.expectedBarcode = null;
        this.goToQuantity();
    },

    // Step 4: Quantity entry
    goToQuantity() {
        UI.showStep('step-quantity');
        ScannerService.detach();

        // Show item name for context
        UI.setText('qty-item-name', this.state.currentItem.Title);

        // Reset quantity
        this.state.quantity = 0;
        UI.updateQuantityDisplay(0);
        UI.hide('scan-count-feedback');

        // Attach scanner for count mode
        ScannerService.attachToInput(
            UI.$('input-scan-count'),
            (barcode) => this.handleCountScan(barcode)
        );
    },

    // Handle scan-to-count
    handleCountScan(barcode) {
        // If we have an expected barcode, validate
        if (this.state.expectedBarcode && barcode !== this.state.expectedBarcode) {
            UI.showScanFeedback(
                `Warning: Scanned "${barcode}" but expected "${this.state.expectedBarcode}"`,
                'warning'
            );
            ScannerService.playErrorSound();
            return;
        }

        // Increment count
        this.state.quantity++;
        UI.updateQuantityDisplay(this.state.quantity);
        UI.showScanFeedback(`Count: ${this.state.quantity}`, 'success');

        // Store expected barcode for future scans
        if (!this.state.expectedBarcode) {
            this.state.expectedBarcode = barcode;
        }
    },

    // Adjust quantity with +/- buttons
    adjustQuantity(delta) {
        this.state.quantity = Math.max(0, this.state.quantity + delta);
        UI.updateQuantityDisplay(this.state.quantity);
    },

    // Step 5: Confirmation
    goToConfirm() {
        UI.showStep('step-confirm');
        ScannerService.detach();

        UI.displayConfirmation(
            this.state.currentItem,
            this.state.newProductBarcode,
            this.state.quantity
        );
    },

    // Save and move to next item
    async saveAndNext() {
        UI.showLoading('Saving...');

        try {
            const updates = {
                Product_Barcode: this.state.newProductBarcode,
                _stocktake_quantity: this.state.quantity
            };

            await FirebaseService.updateItem(
                this.state.sessionId,
                this.state.currentItem.Barcode,
                updates,
                this.state.userName
            );

            UI.success('Item saved!');
            this.goToMusiposScan();
        } catch (error) {
            console.error('Save error:', error);
            UI.error('Failed to save. Please try again.');
        } finally {
            UI.hideLoading();
        }
    },

    // Export CSV
    async exportCSV() {
        UI.hide('menu-overlay');
        UI.showLoading('Preparing export...');

        try {
            const items = await FirebaseService.getAllItems(this.state.sessionId);
            const session = await FirebaseService.getSession(this.state.sessionId);

            const fileName = `stocktake_${session.csvFileName || 'export'}_${new Date().toISOString().slice(0, 10)}.csv`;
            CSVService.exportToCSV(items, fileName);

            UI.success('CSV exported successfully!');
        } catch (error) {
            console.error('Export error:', error);
            UI.error('Export failed');
        } finally {
            UI.hideLoading();
        }
    },

    // Export unknown barcodes
    exportUnknownBarcodes() {
        if (this.state.unknownBarcodes.length === 0) {
            UI.warning('No unknown barcodes to export');
            return;
        }

        const fileName = `unknown_barcodes_${new Date().toISOString().slice(0, 10)}.csv`;
        CSVService.exportUnknownBarcodes(this.state.unknownBarcodes, fileName);
        UI.success('Unknown barcodes exported!');
    },

    // Change session
    // Camera scanner
    openCameraScanner(targetInputId) {
        const targetInput = UI.$(targetInputId);
        if (!targetInput) return;

        UI.show('camera-overlay');

        // Determine what to do with the scanned result based on which input triggered it
        this.cameraScanCallback = (barcode) => {
            // Put the barcode value into the target input and trigger the scanner handler
            targetInput.value = barcode;
            ScannerService.activeInput = targetInput;
            ScannerService.processScan(barcode);
        };

        const config = {
            fps: 10,
            qrbox: { width: 250, height: 100 },
            aspectRatio: 1.0,
            formatsToSupport: [
                Html5QrcodeSupportedFormats.EAN_13,
                Html5QrcodeSupportedFormats.EAN_8,
                Html5QrcodeSupportedFormats.UPC_A,
                Html5QrcodeSupportedFormats.UPC_E,
                Html5QrcodeSupportedFormats.CODE_128,
                Html5QrcodeSupportedFormats.CODE_39,
                Html5QrcodeSupportedFormats.CODE_93,
                Html5QrcodeSupportedFormats.ITF
            ]
        };

        this.cameraScanner = new Html5Qrcode("camera-reader");
        this.cameraScanner.start(
            { facingMode: "environment" },
            config,
            (decodedText) => {
                // Barcode detected
                if (this.cameraScanCallback) {
                    this.cameraScanCallback(decodedText);
                }
                this.closeCameraScanner();
                ScannerService.triggerHaptic();
            },
            (errorMessage) => {
                // Scan error (expected while searching) - ignore
            }
        ).catch(err => {
            console.error('Camera error:', err);
            UI.error('Could not access camera. Check permissions.');
            this.closeCameraScanner();
        });
    },

    closeCameraScanner() {
        if (this.cameraScanner) {
            this.cameraScanner.stop()
                .then(() => {
                    this.cameraScanner.clear();
                    this.cameraScanner = null;
                })
                .catch(err => {
                    console.warn('Camera stop error:', err);
                    this.cameraScanner = null;
                });
        }
        this.cameraScanCallback = null;
        UI.hide('camera-overlay');
    },

    async changeSession() {
        UI.hide('menu-overlay');

        // Clean up listeners
        if (this.listeners.session) this.listeners.session();
        if (this.listeners.unknownBarcodes) this.listeners.unknownBarcodes();

        // Load sessions and show upload screen
        UI.showLoading('Loading sessions...');

        try {
            const sessions = await FirebaseService.getSessions();
            UI.renderSessionList(sessions);
            UI.showScreen('screen-upload');
        } catch (error) {
            UI.error('Failed to load sessions');
        } finally {
            UI.hideLoading();
        }
    }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

// Export for debugging
window.App = App;
