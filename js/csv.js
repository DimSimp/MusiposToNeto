/**
 * CSV Parsing & Export Functions
 * Uses Papa Parse library for CSV handling
 */

const CSVService = {
    // Original CSV headers (preserved for export)
    originalHeaders: [],

    // Parse uploaded CSV file
    parseFile(file) {
        return new Promise((resolve, reject) => {
            Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                transformHeader: (header) => header.trim(),
                complete: (results) => {
                    if (results.errors.length > 0) {
                        console.warn('CSV parsing warnings:', results.errors);
                    }

                    // Store original headers
                    this.originalHeaders = results.meta.fields || [];

                    // Validate required columns
                    const requiredColumns = ['Barcode', 'Title'];
                    const missingColumns = requiredColumns.filter(
                        col => !this.originalHeaders.includes(col)
                    );

                    if (missingColumns.length > 0) {
                        reject(new Error(`Missing required columns: ${missingColumns.join(', ')}`));
                        return;
                    }

                    console.log(`Parsed ${results.data.length} rows`);
                    resolve(results.data);
                },
                error: (error) => {
                    reject(error);
                }
            });
        });
    },

    // Export items back to CSV
    exportToCSV(items, fileName = 'stocktake_export.csv', headers = null) {
        // Use provided headers, falling back to in-memory headers from parsing
        const originalHeaders = (headers && headers.length > 0)
            ? headers
            : this.originalHeaders;

        // Build final column list: original headers + stocktake_quantity
        const exportHeaders = [...originalHeaders];
        if (!exportHeaders.includes('stocktake_quantity')) {
            exportHeaders.push('stocktake_quantity');
        }

        // Sort items alphabetically by Supplier_Item_ID (SKU)
        const sorted = [...items].sort((a, b) => {
            const skuA = (a.Supplier_Item_ID || '').toString().toUpperCase();
            const skuB = (b.Supplier_Item_ID || '').toString().toUpperCase();
            return skuA.localeCompare(skuB);
        });

        // Map to export format - only original columns + stocktake_quantity
        const exportData = sorted.map(item => {
            const row = {};
            originalHeaders.forEach(header => {
                row[header] = item[header] !== undefined ? item[header] : '';
            });
            row['stocktake_quantity'] = item._stocktake_quantity !== null && item._stocktake_quantity !== undefined
                ? item._stocktake_quantity
                : '';
            return row;
        });

        const csv = Papa.unparse(exportData, { columns: exportHeaders });
        this.downloadFile(csv, fileName, 'text/csv');
    },

    // Export unknown barcodes
    exportUnknownBarcodes(barcodes, fileName = 'unknown_barcodes.csv') {
        const exportData = barcodes.map(item => ({
            barcode: item.barcode,
            scanned_at: item.scannedAt?.toDate?.()?.toISOString() || '',
            scanned_by: item.scannedBy || ''
        }));

        const csv = Papa.unparse(exportData);
        this.downloadFile(csv, fileName, 'text/csv');
    },

    // Helper to trigger file download
    downloadFile(content, fileName, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        URL.revokeObjectURL(url);
    },

    // Get item count
    getItemCount(items) {
        return items.length;
    },

    // Get items with barcodes
    getItemsWithBarcodes(items) {
        return items.filter(item => item.Barcode && item.Barcode.trim() !== '');
    },

    // Validate barcode format (basic check)
    isValidBarcode(barcode) {
        if (!barcode) return false;
        // Allow alphanumeric barcodes, at least 1 character
        return /^[A-Za-z0-9\-_]+$/.test(barcode.trim());
    }
};

// Export for use in other modules
window.CSVService = CSVService;
