# Musipos Stocktake App - Setup Guide

## Quick Start

### Step 1: Set Up Firebase (Free)

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **"Create a project"** (or use an existing one)
3. Enter a project name (e.g., "musipos-stocktake")
4. Disable Google Analytics (not needed) and click **Create Project**

### Step 2: Add a Web App

1. In your Firebase project, click the **web icon** (</>) to add a web app
2. Enter a nickname (e.g., "Stocktake Web")
3. **Don't** check "Firebase Hosting" (we'll host elsewhere)
4. Click **Register app**
5. You'll see a `firebaseConfig` object - **copy these values**

### Step 3: Configure the App

1. Open `js/firebase.js` in this project
2. Replace the placeholder config with your values:

```javascript
const firebaseConfig = {
    apiKey: "AIzaSy...",           // Your API key
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abc123"
};
```

### Step 4: Enable Firestore Database

1. In Firebase Console, go to **Build > Firestore Database**
2. Click **Create database**
3. Choose **Start in test mode** (we'll secure it later)
4. Select a location close to you
5. Click **Enable**

### Step 5: Enable Anonymous Authentication

1. Go to **Build > Authentication**
2. Click **Get started**
3. Go to **Sign-in method** tab
4. Click **Anonymous** and toggle **Enable**
5. Click **Save**

### Step 6: Deploy the App

#### Option A: Local Testing
Simply open `index.html` in a web browser. For mobile testing, you'll need to serve it over HTTPS.

#### Option B: GitHub Pages (Recommended - Free)
1. Create a GitHub repository
2. Push all files to the repository
3. Go to Settings > Pages
4. Set Source to "Deploy from a branch" and select `main`
5. Your app will be live at `https://yourusername.github.io/repo-name`

#### Option C: Netlify (Free)
1. Go to [Netlify](https://www.netlify.com/)
2. Drag and drop this folder to deploy
3. Get a free HTTPS URL instantly

#### Option D: Firebase Hosting
1. Install Firebase CLI: `npm install -g firebase-tools`
2. Run `firebase login`
3. Run `firebase init hosting`
4. Run `firebase deploy`

---

## Security (Important for Production)

Once you've tested the app, update your Firestore security rules:

1. Go to **Firestore Database > Rules**
2. Replace with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Only allow authenticated users
    match /stocktakes/{sessionId} {
      allow read, write: if request.auth != null;

      match /items/{itemId} {
        allow read, write: if request.auth != null;
      }

      match /unknownBarcodes/{barcodeId} {
        allow read, write: if request.auth != null;
      }
    }
  }
}
```

3. Click **Publish**

---

## Using the App

### Starting a New Stocktake

1. Open the app on your mobile device
2. Enter your name and tap **Start**
3. Tap **Choose CSV File** and select your Musipos inventory export
4. Wait for upload to complete

### Scanning Items

1. **Scan Musipos Barcode** - Scan the custom barcode sticker
2. **Review Item** - Verify it's the correct item
3. **Scan Product Barcode** - Scan the packaging barcode (or tap "No Barcode")
4. **Enter Quantity** - Use +/- buttons or scan to count
5. **Confirm** - Tap "Save & Next" to save and continue

### Multi-User Workflow

- Multiple people can scan simultaneously
- All changes sync in real-time
- Each person enters their name to track who made changes

### Exporting Results

1. Tap the menu (☰) icon
2. Tap **Export CSV**
3. A new CSV will download with:
   - All original data
   - Updated `Product_Barcode` values
   - New `stocktake_quantity` column

---

## Troubleshooting

### "Failed to initialize app"
- Check your Firebase config values in `js/firebase.js`
- Ensure Firestore and Anonymous Auth are enabled

### Barcode scanner not working
- Ensure the scanner is paired via Bluetooth
- Tap on the input field to focus it
- Check that scanner is configured to send "Enter" after each scan

### Data not syncing
- Check your internet connection
- Verify Firestore rules allow read/write
- Check browser console for errors (F12 > Console)

---

## File Structure

```
MusiposToNeto/
├── index.html          # Main app page
├── css/
│   └── styles.css      # Mobile-first styling
├── js/
│   ├── app.js          # Main application logic
│   ├── firebase.js     # Firebase config (EDIT THIS)
│   ├── csv.js          # CSV parsing/export
│   ├── scanner.js      # Barcode input handling
│   └── ui.js           # UI utilities
├── SETUP.md            # This file
└── .gitignore          # Git ignore file
```
