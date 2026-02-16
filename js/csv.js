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
    exportToCSV(items, fileName = 'stocktake_export.csv') {
        // Build headers - use original headers plus any new stocktake columns
        const stocktakeColumns = ['_stocktake_quantity', '_modified', '_modifiedAt', '_modifiedBy'];
        const exportHeaders = [...this.originalHeaders];

        // Add stocktake_quantity column if not present
        if (!exportHeaders.includes('stocktake_quantity')) {
            exportHeaders.push('stocktake_quantity');
        }

        // Map items to export format
        const exportData = items.map(item => {
            const row = {};

            // Copy original columns
            this.originalHeaders.forEach(header => {
                row[header] = item[header] || '';
            });

            // Add stocktake quantity
            row['stocktake_quantity'] = item._stocktake_quantity !== null
                ? item._stocktake_quantity
                : '';

            return row;
        });

        // Generate CSV
        const csv = Papa.unparse(exportData, {
            columns: exportHeaders.includes('stocktake_quantity')
                ? exportHeaders
                : [...exportHeaders, 'stocktake_quantity']
        });

        // Download file
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
