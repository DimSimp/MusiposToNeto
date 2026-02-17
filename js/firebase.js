/**
 * Firebase Configuration & Helper Functions
 *
 * SETUP INSTRUCTIONS:
 * 1. Go to https://console.firebase.google.com/
 * 2. Create a new project (or use existing)
 * 3. Add a Web App to your project
 * 4. Copy the firebaseConfig object and paste below
 * 5. Enable Firestore Database (Start in test mode for now)
 * 6. Enable Anonymous Authentication in Authentication > Sign-in method
 */

// TODO: Replace with your Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyCrYRFLRRYu9k5-e5qRbFVlpdf7YU5O0oI",
  authDomain: "musipos-stocktake.firebaseapp.com",
  projectId: "musipos-stocktake",
  storageBucket: "musipos-stocktake.firebasestorage.app",
  messagingSenderId: "432066232833",
  appId: "1:432066232833:web:958631a576002600f8b600"
};

// Initialize Firebase
let app, db, auth;

const FirebaseService = {
    initialized: false,

    init() {
        if (this.initialized) return Promise.resolve();

        try {
            app = firebase.initializeApp(firebaseConfig);
            db = firebase.firestore();
            auth = firebase.auth();

            // Enable offline persistence
            db.enablePersistence({ synchronizeTabs: true })
                .catch(err => {
                    if (err.code === 'failed-precondition') {
                        console.warn('Persistence failed: Multiple tabs open');
                    } else if (err.code === 'unimplemented') {
                        console.warn('Persistence not supported in this browser');
                    }
                });

            this.initialized = true;
            console.log('Firebase initialized');
            return Promise.resolve();
        } catch (error) {
            console.error('Firebase initialization error:', error);
            return Promise.reject(error);
        }
    },

    // Anonymous authentication
    async signInAnonymously() {
        try {
            const result = await auth.signInAnonymously();
            return result.user.uid;
        } catch (error) {
            console.error('Auth error:', error);
            throw error;
        }
    },

    getCurrentUserId() {
        return auth.currentUser?.uid;
    },

    // Session Management
    async createSession(fileName, itemCount) {
        const sessionRef = db.collection('stocktakes').doc();
        const sessionData = {
            id: sessionRef.id,
            csvFileName: fileName,
            itemCount: itemCount,
            updatedCount: 0,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdBy: this.getCurrentUserId()
        };

        await sessionRef.set(sessionData);
        return sessionRef.id;
    },

    async getSessions() {
        const snapshot = await db.collection('stocktakes')
            .orderBy('createdAt', 'desc')
            .limit(10)
            .get();

        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    },

    async getSession(sessionId) {
        const doc = await db.collection('stocktakes').doc(sessionId).get();
        if (!doc.exists) return null;
        return { id: doc.id, ...doc.data() };
    },

    // Item Management
    async uploadItems(sessionId, items) {
        const batch = db.batch();
        const itemsRef = db.collection('stocktakes').doc(sessionId).collection('items');

        // Firestore batch limit is 500
        const batchSize = 500;
        let batchCount = 0;

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const barcode = item.Barcode || `NO_BARCODE_${i}`;
            const docRef = itemsRef.doc(barcode);

            batch.set(docRef, {
                ...item,
                _modified: false,
                _stocktake_quantity: null,
                _createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            batchCount++;

            // Commit batch when reaching limit
            if (batchCount === batchSize || i === items.length - 1) {
                await batch.commit();
                batchCount = 0;
            }
        }

        return true;
    },

    async getItemByBarcode(sessionId, barcode) {
        // First try direct lookup by Barcode (document ID)
        const doc = await db.collection('stocktakes')
            .doc(sessionId)
            .collection('items')
            .doc(barcode)
            .get();

        if (doc.exists) return { id: doc.id, ...doc.data() };

        // If not found, try searching by Supplier_Item_ID (SKU)
        const skuSnapshot = await db.collection('stocktakes')
            .doc(sessionId)
            .collection('items')
            .where('Supplier_Item_ID', '==', barcode)
            .limit(1)
            .get();

        if (!skuSnapshot.empty) {
            const skuDoc = skuSnapshot.docs[0];
            return { id: skuDoc.id, ...skuDoc.data() };
        }

        return null;
    },

    async updateItem(sessionId, barcode, updates, userName) {
        const itemRef = db.collection('stocktakes')
            .doc(sessionId)
            .collection('items')
            .doc(barcode);

        await itemRef.update({
            ...updates,
            _modified: true,
            _modifiedAt: firebase.firestore.FieldValue.serverTimestamp(),
            _modifiedBy: userName
        });

        // Increment updated count
        await db.collection('stocktakes').doc(sessionId).update({
            updatedCount: firebase.firestore.FieldValue.increment(1)
        });

        return true;
    },

    async getAllItems(sessionId) {
        const snapshot = await db.collection('stocktakes')
            .doc(sessionId)
            .collection('items')
            .get();

        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    },

    async getModifiedItems(sessionId) {
        const snapshot = await db.collection('stocktakes')
            .doc(sessionId)
            .collection('items')
            .where('_modified', '==', true)
            .get();

        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    },

    // Unknown Barcodes
    async logUnknownBarcode(sessionId, barcode, userName) {
        await db.collection('stocktakes')
            .doc(sessionId)
            .collection('unknownBarcodes')
            .add({
                barcode: barcode,
                scannedAt: firebase.firestore.FieldValue.serverTimestamp(),
                scannedBy: userName
            });
    },

    async getUnknownBarcodes(sessionId) {
        const snapshot = await db.collection('stocktakes')
            .doc(sessionId)
            .collection('unknownBarcodes')
            .orderBy('scannedAt', 'desc')
            .get();

        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    },

    // Real-time listeners
    onSessionUpdate(sessionId, callback) {
        return db.collection('stocktakes')
            .doc(sessionId)
            .onSnapshot(doc => {
                if (doc.exists) {
                    callback({ id: doc.id, ...doc.data() });
                }
            });
    },

    onUnknownBarcodesUpdate(sessionId, callback) {
        return db.collection('stocktakes')
            .doc(sessionId)
            .collection('unknownBarcodes')
            .orderBy('scannedAt', 'desc')
            .onSnapshot(snapshot => {
                const barcodes = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                callback(barcodes);
            });
    }
};

// Export for use in other modules
window.FirebaseService = FirebaseService;
