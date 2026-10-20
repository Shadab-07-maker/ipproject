/**
 * ==============================================================================
 * Warehouse Management System (WMS) - JavaScript Logic
 * File: script.js
 * 
 * Features:
 * - LocalStorage state persistence with robust JSON error-recovery
 * - Real-time KPI calculations (SKUs, Total Units, Inventory Value, Low Stock)
 * - Full Product Catalog CRUD (Create, Read, Update, Delete)
 * - Inbound (Stock IN) & Outbound (Stock OUT) adjustments with stock validation
 * - Instant search (SKU, Name, Bin Location) & multi-attribute dropdown filters
 * - Chronological stock movement audit trail
 * - CSV data export & Toast alert system
 * ==============================================================================
 */

// LocalStorage persistent keys
const STORAGE_KEY_PRODUCTS = 'wms_simple_products';
const STORAGE_KEY_LOGS = 'wms_simple_logs';

// Default sample products loaded on first launch or reset
const DEFAULT_PRODUCTS = [
    { id: '1', sku: 'ELEC-SENS-01', name: 'Industrial Optical LiDAR Sensor', category: 'Electronics', location: 'A-01-S2-B1', price: 120.00, stock: 45, minStock: 15 },
    { id: '2', sku: 'ELEC-CTRL-02', name: 'Programmable Logic Controller (PLC)', category: 'Electronics', location: 'A-02-S1-B3', price: 310.00, stock: 18, minStock: 10 },
    { id: '3', sku: 'TOOL-PNEU-01', name: 'Pneumatic Air Impact Wrench', category: 'Industrial Tools', location: 'B-01-S3-B2', price: 85.00, stock: 32, minStock: 12 },
    { id: '4', sku: 'SAFE-VEST-01', name: 'Hi-Vis Reflective Safety Vest', category: 'Safety Equipment', location: 'C-01-S1-B1', price: 6.50, stock: 120, minStock: 40 },
    { id: '5', sku: 'PACK-BOX-MED', name: 'Corrugated Shipping Cartons (Bundle 25)', category: 'Packaging', location: 'C-02-S2-B4', price: 18.00, stock: 65, minStock: 25 },
    { id: '6', sku: 'RAWM-POLY-HD', name: 'High-Density Polyethylene Resin 25kg', category: 'Raw Materials', location: 'D-01-S1-B1', price: 42.00, stock: 80, minStock: 30 },
    { id: '7', sku: 'TOOL-HYDR-02', name: 'Hydraulic Pallet Jack 5500 lbs', category: 'Industrial Tools', location: 'B-04-S1-B1', price: 280.00, stock: 4, minStock: 6 },
    { id: '8', sku: 'ELEC-CABL-CAT6', name: 'Shielded Industrial Cat6A Spool 1000ft', category: 'Electronics', location: 'A-03-S2-B2', price: 110.00, stock: 2, minStock: 8 },
    { id: '9', sku: 'PACK-STR-TAPE', name: 'Heavy Duty Packaging Tape (Pack of 6)', category: 'Packaging', location: 'C-01-S3-B2', price: 14.20, stock: 0, minStock: 20 }
];

// Initial stock activity audit logs
const DEFAULT_LOGS = [
    { id: 'L1', timestamp: new Date(Date.now() - 3600000 * 3).toLocaleString(), type: 'IN', sku: 'ELEC-SENS-01', name: 'Optical LiDAR Sensor', qty: 25, balance: 45, reason: 'Supplier PO #1002 Delivery' },
    { id: 'L2', timestamp: new Date(Date.now() - 3600000 * 6).toLocaleString(), type: 'OUT', sku: 'PACK-STR-TAPE', name: 'Heavy Duty Packaging Tape', qty: 15, balance: 0, reason: 'Outbound Customer Order #481' },
    { id: 'L3', timestamp: new Date(Date.now() - 3600000 * 12).toLocaleString(), type: 'OUT', sku: 'TOOL-HYDR-02', name: 'Hydraulic Pallet Jack', qty: 2, balance: 4, reason: 'Dispatched to Assembly Line B' }
];

// Active runtime state
let products = [];
let logs = [];

/**
 * Initialize application state from LocalStorage or seed defaults
 */
function initApp() {
    try {
        const savedProducts = localStorage.getItem(STORAGE_KEY_PRODUCTS);
        products = savedProducts ? JSON.parse(savedProducts) : [...DEFAULT_PRODUCTS];
        if (!Array.isArray(products) || products.length === 0) {
            products = [...DEFAULT_PRODUCTS];
        }
    } catch (err) {
        console.warn('Could not parse saved products from localStorage, resetting to defaults:', err);
        products = [...DEFAULT_PRODUCTS];
    }

    try {
        const savedLogs = localStorage.getItem(STORAGE_KEY_LOGS);
        logs = savedLogs ? JSON.parse(savedLogs) : [...DEFAULT_LOGS];
        if (!Array.isArray(logs)) {
            logs = [...DEFAULT_LOGS];
        }
    } catch (err) {
        console.warn('Could not parse saved logs from localStorage, resetting to defaults:', err);
        logs = [...DEFAULT_LOGS];
    }

    saveState();
    renderApp();
}

/**
 * Persist current state to browser's LocalStorage
 */
function saveState() {
    try {
        localStorage.setItem(STORAGE_KEY_PRODUCTS, JSON.stringify(products));
        localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(logs));
    } catch (err) {
        console.error('LocalStorage write error:', err);
    }
}

/**
 * Restore original sample records
 */
function resetToSampleData() {
    if (confirm('Are you sure you want to reset all data to default warehouse sample records?')) {
        products = [...DEFAULT_PRODUCTS];
        logs = [...DEFAULT_LOGS];
        saveState();
        renderApp();
        showToast('Reset to sample dataset successfully!', 'success');
    }
}

/**
 * Master UI update function
 */
function renderApp() {
    renderKPIs();
    renderInventoryTable();
    renderActivityLog();
}

/**
 * 1. Calculate & render KPI summary metrics
 */
function renderKPIs() {
    let totalUnits = 0;
    let totalValuation = 0;
    let lowOrOutCount = 0;

    products.forEach(p => {
        const stock = Number(p.stock) || 0;
        const price = Number(p.price) || 0;
        const min = Number(p.minStock) || 0;

        totalUnits += stock;
        totalValuation += (stock * price);

        if (stock <= min) {
            lowOrOutCount++;
        }
    });

    const skusEl = document.getElementById('stat-total-skus');
    const unitsEl = document.getElementById('stat-total-units');
    const valEl = document.getElementById('stat-total-val');
    const lowEl = document.getElementById('stat-low-stock');

    if (skusEl) skusEl.textContent = products.length;
    if (unitsEl) unitsEl.textContent = totalUnits.toLocaleString();
    if (valEl) valEl.textContent = '$' + totalValuation.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (lowEl) lowEl.textContent = lowOrOutCount;
}

/**
 * 2. Render Product Inventory Table with real-time search & filters
 */
function renderInventoryTable() {
    const tbody = document.getElementById('inventory-table-body');
    if (!tbody) return;

    const searchInput = document.getElementById('search-input');
    const categorySelect = document.getElementById('filter-category');
    const statusSelect = document.getElementById('filter-status');

    const searchVal = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const categoryVal = categorySelect ? categorySelect.value : 'ALL';
    const statusVal = statusSelect ? statusSelect.value : 'ALL';

    const filtered = products.filter(p => {
        // Multi-field search (SKU, Name, Bin Location)
        const skuStr = String(p.sku || '').toLowerCase();
        const nameStr = String(p.name || '').toLowerCase();
        const locStr = String(p.location || '').toLowerCase();

        const matchesSearch = !searchVal || 
            skuStr.includes(searchVal) || 
            nameStr.includes(searchVal) || 
            locStr.includes(searchVal);

        // Category filter
        const matchesCategory = (categoryVal === 'ALL') || (p.category === categoryVal);

        // Stock status filter
        let matchesStatus = true;
        const stock = Number(p.stock) || 0;
        const min = Number(p.minStock) || 0;

        if (statusVal === 'IN_STOCK') {
            matchesStatus = stock > min;
        } else if (statusVal === 'LOW_STOCK') {
            matchesStatus = stock > 0 && stock <= min;
        } else if (statusVal === 'OUT_OF_STOCK') {
            matchesStatus = stock === 0;
        }

        return matchesSearch && matchesCategory && matchesStatus;
    });

    const badge = document.getElementById('product-count-badge');
    if (badge) badge.textContent = `${filtered.length} Products`;

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="10" class="empty-state">
                    <span class="empty-state-icon">🔍</span>
                    <p>No products match your search or filter criteria.</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = filtered.map(p => {
        const stock = Number(p.stock) || 0;
        const min = Number(p.minStock) || 0;
        const price = Number(p.price) || 0;
        
        let badgeClass = 'badge-in-stock';
        let badgeText = '● In Stock';

        if (stock === 0) {
            badgeClass = 'badge-out-of-stock';
            badgeText = '✖ Out of Stock';
        } else if (stock <= min) {
            badgeClass = 'badge-low-stock';
            badgeText = '▲ Low Stock';
        }

        return `
            <tr>
                <td><span class="sku-badge">${escapeHTML(p.sku)}</span></td>
                <td><strong>${escapeHTML(p.name)}</strong></td>
                <td><span style="color: var(--text-muted);">${escapeHTML(p.category)}</span></td>
                <td><span class="location-tag">${escapeHTML(p.location)}</span></td>
                <td style="text-align: right; font-weight: 600;">$${price.toFixed(2)}</td>
                <td style="text-align: right; font-weight: 700; ${stock <= min ? 'color: var(--danger);' : ''}">${stock}</td>
                <td style="text-align: right; color: var(--text-muted);">${min}</td>
                <td style="text-align: center;"><span class="badge ${badgeClass}">${badgeText}</span></td>
                <td style="text-align: center;">
                    <div class="action-buttons-group" style="justify-content: center;">
                        <button class="btn btn-sm btn-success" onclick="openAdjustModal('${p.id}', 'IN')" title="Add Stock (Inbound)">+ In</button>
                        <button class="btn btn-sm btn-danger" onclick="openAdjustModal('${p.id}', 'OUT')" title="Deduct Stock (Dispatch)">- Out</button>
                    </div>
                </td>
                <td style="text-align: center;">
                    <div class="action-buttons-group" style="justify-content: center;">
                        <button class="btn-icon edit" onclick="openEditModal('${p.id}')" title="Edit Product">✏️</button>
                        <button class="btn-icon delete" onclick="deleteProduct('${p.id}')" title="Delete Product">🗑️</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

/**
 * 3. Render Chronological Stock Activity / Movement Log
 */
function renderActivityLog() {
    const tbody = document.getElementById('activity-log-body');
    if (!tbody) return;
    
    if (logs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="empty-state">No stock activity logged yet.</td></tr>`;
        return;
    }

    tbody.innerHTML = logs.slice(0, 10).map(l => {
        let typeClass = 'movement-in';
        let sign = '+';
        if (l.type === 'OUT') {
            typeClass = 'movement-out';
            sign = '-';
        }

        return `
            <tr>
                <td><small style="color: var(--text-muted);">${l.timestamp}</small></td>
                <td><span class="movement-type ${typeClass}">${l.type}</span></td>
                <td><strong>${escapeHTML(l.sku)}</strong> <small>(${escapeHTML(l.name)})</small></td>
                <td style="text-align: right; font-weight: 700; color: ${l.type === 'IN' ? 'var(--success-text)' : 'var(--danger-text)'};">
                    ${sign}${Math.abs(Number(l.qty) || 0)}
                </td>
                <td style="text-align: right; font-weight: 600;">${l.balance}</td>
                <td><small style="color: var(--text-muted);">${escapeHTML(l.reason)}</small></td>
            </tr>
        `;
    }).join('');
}

/**
 * Open modal to add a brand new product
 */
function openAddModal() {
    const form = document.getElementById('product-form');
    if (form) form.reset();
    document.getElementById('prod-id').value = '';
    document.getElementById('product-modal-title').textContent = '➕ Add New Product';
    openModal('product-modal');
}

/**
 * Open modal pre-filled with selected product's information
 */
function openEditModal(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    document.getElementById('prod-id').value = product.id;
    document.getElementById('prod-sku').value = product.sku;
    document.getElementById('prod-name').value = product.name;
    document.getElementById('prod-category').value = product.category;
    document.getElementById('prod-location').value = product.location;
    document.getElementById('prod-price').value = product.price;
    document.getElementById('prod-qty').value = product.stock;
    document.getElementById('prod-min').value = product.minStock;

    document.getElementById('product-modal-title').textContent = '✏️ Edit Product: ' + product.sku;
    openModal('product-modal');
}

/**
 * Handle Add/Edit form submission
 */
function saveProduct(event) {
    event.preventDefault();

    const id = document.getElementById('prod-id').value;
    const sku = document.getElementById('prod-sku').value.trim().toUpperCase();
    const name = document.getElementById('prod-name').value.trim();
    const category = document.getElementById('prod-category').value;
    const location = document.getElementById('prod-location').value.trim().toUpperCase();
    const price = parseFloat(document.getElementById('prod-price').value) || 0;
    const stock = parseInt(document.getElementById('prod-qty').value, 10) || 0;
    const minStock = parseInt(document.getElementById('prod-min').value, 10) || 0;

    if (price < 0 || stock < 0 || minStock < 0) {
        showToast('Quantities and prices cannot be negative numbers.', 'danger');
        return;
    }

    // Check for duplicate SKU
    const duplicate = products.find(p => p.sku === sku && p.id !== id);
    if (duplicate) {
        showToast(`SKU "${sku}" is already in use by another item!`, 'danger');
        return;
    }

    if (id) {
        // Update existing item
        const index = products.findIndex(p => p.id === id);
        if (index !== -1) {
            products[index] = { ...products[index], sku, name, category, location, price, stock, minStock };
            showToast(`Product "${sku}" updated successfully!`, 'success');
        }
    } else {
        // Create new item
        const newProduct = {
            id: Date.now().toString(),
            sku,
            name,
            category,
            location,
            price,
            stock,
            minStock
        };
        products.unshift(newProduct);

        // Record initial inventory receipt in log
        logs.unshift({
            id: 'L' + Date.now(),
            timestamp: new Date().toLocaleString(),
            type: 'IN',
            sku,
            name,
            qty: stock,
            balance: stock,
            reason: 'Initial Product Registration'
        });

        showToast(`Product "${sku}" added to inventory!`, 'success');
    }

    saveState();
    closeModal('product-modal');
    renderApp();
}

/**
 * Delete a product from inventory
 */
function deleteProduct(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    if (confirm(`Are you sure you want to permanently delete "${product.name}" (${product.sku})?`)) {
        products = products.filter(p => p.id !== productId);
        saveState();
        renderApp();
        showToast(`Product ${product.sku} deleted.`, 'danger');
    }
}

/**
 * Open Stock In / Stock Out adjustment modal
 */
function openAdjustModal(productId, actionType) {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const form = document.getElementById('adjust-form');
    if (form) form.reset();

    document.getElementById('adjust-prod-id').value = productId;
    document.getElementById('adjust-action-type').value = actionType;

    const isStockIn = actionType === 'IN';
    document.getElementById('adjust-modal-title').textContent = isStockIn ? '📥 Stock IN (Receive Goods)' : '📤 Stock OUT (Dispatch Goods)';
    document.getElementById('adjust-qty-label').textContent = isStockIn ? 'Quantity to Receive *' : 'Quantity to Dispatch *';
    document.getElementById('adjust-submit-btn').className = isStockIn ? 'btn btn-success' : 'btn btn-danger';
    document.getElementById('adjust-submit-btn').textContent = isStockIn ? 'Receive Stock (+)' : 'Dispatch Stock (-)';

    document.getElementById('adjust-prod-info').innerHTML = `
        Product: <strong style="color: var(--primary);">${escapeHTML(product.sku)}</strong> - ${escapeHTML(product.name)}<br>
        Current In-Hand Stock: <strong>${product.stock} units</strong>
    `;

    openModal('adjust-modal');
}

/**
 * Process Stock In / Stock Out adjustments
 */
function saveStockAdjustment(event) {
    event.preventDefault();

    const productId = document.getElementById('adjust-prod-id').value;
    const actionType = document.getElementById('adjust-action-type').value;
    const qty = parseInt(document.getElementById('adjust-qty').value, 10);
    const reason = document.getElementById('adjust-reason').value.trim();

    const product = products.find(p => p.id === productId);
    if (!product || isNaN(qty) || qty <= 0) {
        showToast('Please enter a valid quantity greater than zero.', 'danger');
        return;
    }

    // Outbound validation: cannot dispatch more than available
    if (actionType === 'OUT' && product.stock < qty) {
        showToast(`Insufficient stock! Cannot dispatch ${qty} units. Current stock is ${product.stock}.`, 'danger');
        return;
    }

    // Apply stock delta
    if (actionType === 'IN') {
        product.stock += qty;
    } else {
        product.stock -= qty;
    }

    // Append to movement audit log
    logs.unshift({
        id: 'L' + Date.now(),
        timestamp: new Date().toLocaleString(),
        type: actionType,
        sku: product.sku,
        name: product.name,
        qty: qty,
        balance: product.stock,
        reason: reason
    });

    saveState();
    closeModal('adjust-modal');
    renderApp();

    showToast(`${actionType === 'IN' ? 'Received' : 'Dispatched'} ${qty} units for ${product.sku}!`, 'success');
}

/**
 * Export current inventory table into a downloadable CSV file
 */
function exportToCSV() {
    if (products.length === 0) {
        showToast('No products to export!', 'warning');
        return;
    }

    const headers = ['SKU', 'Product Name', 'Category', 'Bin Location', 'Unit Price ($)', 'Current Stock', 'Min Stock Level', 'Inventory Valuation ($)'];
    const rows = products.map(p => {
        const priceNum = Number(p.price) || 0;
        const stockNum = Number(p.stock) || 0;
        const minNum = Number(p.minStock) || 0;
        const valNum = priceNum * stockNum;

        return [
            `"${String(p.sku || '').replace(/"/g, '""')}"`,
            `"${String(p.name || '').replace(/"/g, '""')}"`,
            `"${String(p.category || '').replace(/"/g, '""')}"`,
            `"${String(p.location || '').replace(/"/g, '""')}"`,
            priceNum.toFixed(2),
            stockNum,
            minNum,
            valNum.toFixed(2)
        ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Warehouse_Inventory_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast('Inventory exported to CSV!', 'success');
}

/**
 * Modal visibility helpers
 */
function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.add('active');
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove('active');
}

// Close modal when clicking backdrop
window.addEventListener('click', (e) => {
    if (e.target && e.target.classList && e.target.classList.contains('modal-overlay')) {
        e.target.classList.remove('active');
    }
});

// Close modal on ESC key
window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
    }
});

/**
 * Display toast notification popup
 */
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

/**
 * Sanitize strings against XSS injection
 */
function escapeHTML(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Bootstrap app safely across all loading states
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
