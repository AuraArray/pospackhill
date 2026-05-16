// ==========================================================================
// 1. ENGINE DATABASE CORE (MANDIRI & REAL-TIME LOCALSTORAGE)
// ==========================================================================
let sysDatabase = JSON.parse(localStorage.getItem('pakchill_enterprise_db_v5.2')) || {
    menu: [], 
    bundles: [],
    vouchers: [
        { code: 'PAKCHILLSEHAT', nominal: 5000, type: 'Voucher' }
    ],
    rekening: [
        { bank: 'BCA', nomor: '8410923121', holder: 'PT PAKCHILL ENTERPRISE' },
        { bank: 'GoPay', nomor: '081234567890', holder: 'PAKCHILL INDO GRUP' }
    ],
    members: [
        { name: 'APRIL', wa: '0812', poin: 10 }
    ],
    transactions: [],
    lastOrderDate: new Date().toDateString(),
    currentOrderSeq: 101
};

// Auto Reset Nomor Orderan jika mendeteksi Hari Berganti
const todayStr = new Date().toDateString();
if (sysDatabase.lastOrderDate !== todayStr) {
    sysDatabase.currentOrderSeq = 101;
    sysDatabase.lastOrderDate = todayStr;
    localStorage.setItem('pakchill_enterprise_db_v5.2', JSON.stringify(sysDatabase));
}

let activeRole = null;
let activeCart = [];
let activeMemberObj = null; 
let chartInstanceGlobal = null;

function saveToStorage() {
    localStorage.setItem('pakchill_enterprise_db_v5.2', JSON.stringify(sysDatabase));
}

// ==========================================================================
// 2. FUNGSI LOGIN & OTENTIKASI (STRUKTUR ASLI AWAL ANDA)
// ==========================================================================
function executeAuthentication() {
    // Kembali menggunakan ID asli bawaan HTML awal Anda tanpa modifikasi nama variabel
    const pinInput = document.getElementById('sys-pin-access');
    if (!pinInput) return;
    
    const pin = pinInput.value.trim();
    
    if (pin === '123') {
        activeRole = 'kasir';
        unlockInterface();
    } else if (pin === '000') {
        activeRole = 'owner';
        unlockInterface();
    } else {
        alert('PIN Otentikasi Salah!');
    }
}

function unlockInterface() {
    // Menampilkan layar utama sesuai sistem awal Anda
    if (document.getElementById('login-screen-overlay')) document.getElementById('login-screen-overlay').style.display = 'none';
    if (document.getElementById('main-app-layer')) document.getElementById('main-app-layer').style.display = 'block';
    
    // Membuka segmentasi visual asli bawaan CSS awal Anda
    if (activeRole === 'kasir') {
        if (document.getElementById('view-segment-kasir')) document.getElementById('view-segment-kasir').style.display = 'grid';
        if (document.getElementById('view-segment-owner')) document.getElementById('view-segment-owner').style.display = 'none';
    } else if (activeRole === 'owner') {
        if (document.getElementById('view-segment-kasir')) document.getElementById('view-segment-kasir').style.display = 'grid'; 
        if (document.getElementById('view-segment-owner')) document.getElementById('view-segment-owner').style.display = 'block';
    }

    if (document.getElementById('sys-pin-access')) document.getElementById('sys-pin-access').value = '';
    if (document.getElementById('txt-live-order-number')) document.getElementById('txt-live-order-number').innerText = `Order #: ${sysDatabase.currentOrderSeq}`;
    
    // Jalankan semua render bawaan awal
    renderKatalogKasir();
    renderCartUI();
    renderHistoryTable();
    renderMemberTable();
    populateTransferDropdown();
    calculateLiveClosingDashboard();
    
    if (activeRole === 'owner') {
        renderOwnerDashboardMetrics();
    }
}

function triggerSystemLogout() {
    activeRole = null;
    activeCart = [];
    activeMemberObj = null;
    if (document.getElementById('main-app-layer')) document.getElementById('main-app-layer').style.display = 'none';
    if (document.getElementById('login-screen-overlay')) document.getElementById('login-screen-overlay').style.display = 'flex';
}

// ==========================================================================
// 3. CATALOG & CART ENGINE (KLOP DENGAN CLASS CSS AWAL)
// ==========================================================================
function renderKatalogKasir() {
    const target = document.getElementById('katalog-render-target');
    if (!target) return;
    target.innerHTML = '';

    if (sysDatabase.menu.length === 0 && sysDatabase.bundles.length === 0) {
        target.innerHTML = '<p style="grid-column:1/-1; text-align:center; font-style:italic; color:#666;">Katalog kosong.</p>';
        return;
    }

    // Merender menggunakan susunan struktur div asli agar dibaca CSS awal Anda
    sysDatabase.menu.forEach(item => {
        const isComp = item.type === 'Complimentary';
        const displayPrice = isComp ? 'FREE' : `Rp ${item.price.toLocaleString('id-ID')}`;
        
        target.innerHTML += `
            <div class="product-item-card" onclick="pushItemToCart('${item.name}', ${item.price})">
                <div class="product-name">${item.name}</div>
                <div class="product-price">${displayPrice}</div>
            </div>
        `;
    });

    sysDatabase.bundles.forEach(bundle => {
        target.innerHTML += `
            <div class="product-item-card bundle-card" onclick="pushItemToCart('${bundle.name}', ${bundle.price})">
                <div class="product-name">${bundle.name}</div>
                <div class="product-price">Rp ${bundle.price.toLocaleString('id-ID')}</div>
            </div>
        `;
    });
}

function pushItemToCart(name, price) {
    activeCart.push({ name, price, uid: Date.now() + Math.random() });
    renderCartUI();
}

function removeItemFromCart(uid) {
    activeCart = activeCart.filter(item => item.uid !== uid);
    renderCartUI();
}

function renderCartUI() {
    const container = document.getElementById('cart-items-wrapper');
    if (!container) return;
    container.innerHTML = '';
    
    if (activeCart.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:#999; padding:10px;">Keranjang kosong.</p>';
        if (document.getElementById('txt-subtotal-val')) document.getElementById('txt-subtotal-val').innerText = 'Rp 0';
        if (document.getElementById('txt-grand-total-display')) document.getElementById('txt-grand-total-display').innerText = 'Rp 0';
        return;
    }

    activeCart.forEach(item => {
        container.innerHTML += `
            <div class="cart-item-row">
                <span>${item.name}</span>
                <div>
                    <span>Rp ${item.price.toLocaleString('id-ID')}</span>
                    <button onclick="removeItemFromCart(${item.uid})" class="btn-remove-cart">✕</button>
                </div>
            </div>
        `;
    });
    recalculateCartTotals();
}

function recalculateCartTotals() {
    let subtotal = activeCart.reduce((sum, item) => sum + item.price, 0);
    if (document.getElementById('txt-subtotal-val')) {
        document.getElementById('txt-subtotal-val').innerText = 'Rp ' + subtotal.toLocaleString('id-ID');
    }

    let diskonRaw = document.getElementById('kasir-input-diskon') ? document.getElementById('kasir-input-diskon').value.trim() : '0';
    let voucherRaw = document.getElementById('kasir-input-voucher') ? document.getElementById('kasir-input-voucher').value.trim() : '0';

    let nilaiDiskon = 0;
    let nilaiVoucher = 0;

    if (diskonRaw !== '' && diskonRaw !== '0') {
        let match = sysDatabase.vouchers.find(v => v.code.toUpperCase() === diskonRaw.toUpperCase() && v.type === 'Diskon');
        if (match) nilaiDiskon = match.nominal;
        else nilaiDiskon = parseInt(diskonRaw) || 0;
    }

    if (voucherRaw !== '' && voucherRaw !== '0') {
        let match = sysDatabase.vouchers.find(v => v.code.toUpperCase() === voucherRaw.toUpperCase() && v.type === 'Voucher');
        if (match) nilaiVoucher = match.nominal;
        else nilaiVoucher = parseInt(voucherRaw) || 0;
    }

    let grandTotal = subtotal - nilaiDiskon - nilaiVoucher;
    if (grandTotal < 0) grandTotal = 0;

    if (document.getElementById('txt-grand-total-display')) {
        document.getElementById('txt-grand-total-display').innerText = 'Rp ' + grandTotal.toLocaleString('id-ID');
    }
    return { subtotal, diskon: nilaiDiskon, voucher: nilaiVoucher, total: grandTotal };
}

// ==========================================================================
// 4. METODE PEMBAYARAN DINAMIS & KEMBALIAN
// ==========================================================================
function handlePaymentDropdownBranching() {
    const selectMethod = document.getElementById('kasir-select-paymethod');
    if (!selectMethod) return;
    const method = selectMethod.value;
    
    if (document.getElementById('wrapper-sub-cash')) document.getElementById('wrapper-sub-cash').style.display = (method === 'Cash') ? 'block' : 'none';
    if (document.getElementById('wrapper-sub-qris')) document.getElementById('wrapper-sub-qris').style.display = (method === 'QRIS') ? 'block' : 'none';
    if (document.getElementById('wrapper-sub-transfer')) document.getElementById('wrapper-sub-transfer').style.display = (method === 'Transfer') ? 'block' : 'none';
    
    if (method === 'Transfer') populateTransferDropdown();
    calculateCashReturn();
}

function calculateCashReturn() {
    const financials = recalculateCartTotals();
    const inputUangEl = document.getElementById('kasir-cash-input-uang');
    const inputUang = inputUangEl ? inputUangEl.value : '0';
    const uangBayar = parseInt(inputUang) || 0;
    
    let kembalian = uangBayar - financials.total;
    if (kembalian < 0) kembalian = 0;
    
    if (document.getElementById('cash-return-info')) {
        document.getElementById('cash-return-info').innerText = 'Kembalian: Rp ' + kembalian.toLocaleString('id-ID');
    }
}

// ==========================================================================
// 5. MEMBERSHIP LIVE SEARCH
// ==========================================================================
function executeLiveSearchMember() {
    const searchInput = document.getElementById('kasir-search-member');
    if (!searchInput) return;
    const query = searchInput.value.trim().toUpperCase();
    const infoBox = document.getElementById('kasir-member-status-box');
    if (!infoBox) return;
    
    if (query === "") {
        infoBox.innerText = '';
        activeMemberObj = null;
        return;
    }

    activeMemberObj = sysDatabase.members.find(m => m.name.toUpperCase() === query || m.wa === query);
    
    if (activeMemberObj) {
        infoBox.innerText = `🌟 MEMBER: ${activeMemberObj.name} | Poin: ${activeMemberObj.poin}`;
    } else {
        infoBox.innerText = "Status: Pelanggan Umum";
    }
}

function registerFastMemberFromKasir() {
    const nameInput = document.getElementById('kasir-fast-name');
    const waInput = document.getElementById('kasir-fast-wa');
    if (!nameInput || !waInput) return;

    const name = nameInput.value.trim();
    const wa = waInput.value.trim();

    if (!name || !wa) return alert('Mohon isi Nama dan No WA!');
    
    let exists = sysDatabase.members.some(m => m.wa === wa);
    if (exists) return alert('Nomor WA sudah terdaftar!');

    sysDatabase.members.push({ name: name.toUpperCase(), wa: wa, poin: 0 });
    saveToStorage();
    
    alert(`Sukses daftar member: ${name.toUpperCase()}`);
    if (document.getElementById('kasir-search-member')) document.getElementById('kasir-search-member').value = wa;
    nameInput.value = '';
    waInput.value = '';
    
    executeLiveSearchMember();
    renderMemberTable();
}

// ==========================================================================
// 6. CLOSING & FINALIZE TRANSAKSI
// ==========================================================================
function calculateLiveClosingDashboard() {
    const todayStr = new Date().toDateString();
    const activeTodayTrx = sysDatabase.transactions.filter(t => t.status === 'Sukses' && new Date(t.timestamp).toDateString() === todayStr);

    let totalUang = 0;
    let totalQty = 0;
    let menuMap = {};

    activeTodayTrx.forEach(t => {
        totalUang += t.total;
        totalQty += t.itemCount;
        if (t.rawItemsArray) {
            t.rawItemsArray.forEach(mName => {
                menuMap[mName] = (menuMap[mName] || 0) + 1;
            });
        }
    });

    if (document.getElementById('txt-closing-total-omzet')) document.getElementById('txt-closing-total-omzet').innerText = 'Rp ' + totalUang.toLocaleString('id-ID');
    if (document.getElementById('txt-closing-total-qty')) document.getElementById('txt-closing-total-qty').innerText = totalQty + ' Item';

    const menuListTarget = document.getElementById('closing-menu-list-render');
    if (!menuListTarget) return;
    menuListTarget.innerHTML = '';
    
    let mapKeys = Object.keys(menuMap);
    mapKeys.forEach(mName => {
        menuListTarget.innerHTML += `<div>🥗 ${mName}: ${menuMap[mName]} Porsi</div>`;
    });
}

function finalizeTransactionReceipt(mode) {
    if (activeCart.length === 0) return alert('Keranjang masih kosong!');
    
    const financials = recalculateCartTotals();
    const selectMethod = document.getElementById('kasir-select-paymethod');
    const method = selectMethod ? selectMethod.value : 'Cash';
    
    if (method === 'Cash') {
        const cashInput = document.getElementById('kasir-cash-input-uang');
        const uangBayar = cashInput ? (parseInt(cashInput.value) || 0) : 0;
        if (uangBayar < financials.total) {
            return alert('Uang tunai kurang!');
        }
    }
    
    let namaPelangganFix = 'Umum';
    if (activeMemberObj) {
        namaPelangganFix = activeMemberObj.name;
        let index = sysDatabase.members.findIndex(m => m.wa === activeMemberObj.wa);
        if (index !== -1) {
            sysDatabase.members[index].poin += activeCart.length; 
        }
    }

    const currentOrderNo = sysDatabase.currentOrderSeq;
    const trxId = 'TRX-' + Date.now();
    
    const newTransaction = {
        orderNumber: currentOrderNo,
        id: trxId,
        timestamp: new Date().toISOString(),
        customer: namaPelangganFix,
        items: activeCart.map(i => i.name).join(', '),
        rawItemsArray: activeCart.map(i => i.name), 
        itemCount: activeCart.length,
        total: financials.total,
        payment: method,
        status: 'Sukses'
    };

    sysDatabase.transactions.push(newTransaction);
    sysDatabase.currentOrderSeq += 1; 
    saveToStorage();

    if (mode === 'Print') {
        buildThermalReceiptHTML(newTransaction, financials);
        window.print();
    } else {
        alert(`Transaksi Sukses! Order #: ${currentOrderNo}`);
    }

    // Reset Form Kasir
    activeCart = [];
    activeMemberObj = null;
    if (document.getElementById('kasir-search-member')) document.getElementById('kasir-search-member').value = '';
    if (document.getElementById('kasir-cash-input-uang')) document.getElementById('kasir-cash-input-uang').value = '';
    if (document.getElementById('kasir-member-status-box')) document.getElementById('kasir-member-status-box').innerText = '';
    if (document.getElementById('txt-live-order-number')) document.getElementById('txt-live-order-number').innerText = `Order #: ${sysDatabase.currentOrderSeq}`;
    
    renderCartUI();
    calculateLiveClosingDashboard();
    renderMemberTable();
    if (activeRole === 'owner') { renderOwnerDashboardMetrics(); }
}

function buildThermalReceiptHTML(trx, financial) {
    const area = document.getElementById('thermal-receipt-output');
    if (!area) return;
    area.innerHTML = `
        <div style="text-align:center; font-weight:bold;">PAKCHILL POS</div>
        <div style="text-align:center;">Order #: ${trx.orderNumber}</div>
        <hr>
        <div>Nota: ${trx.id}</div>
        <div>Cust: ${trx.customer}</div>
        <hr>
        <div>Menu: ${trx.items}</div>
        <hr>
        <div>Total: Rp ${trx.total.toLocaleString('id-ID')}</div>
        <div style="text-align:center; font-size:10px; margin-top:10px;">
            "Terima kasih telah mendukung petani local. Stay Healthy, Stay Chill bersama Pakchill. Poin Member Anda telah ditambahkan."
        </div>
    `;
}

// ==========================================================================
// 7. EXPORT DATA CENTER
// ==========================================================================
function exportKasirReportPDF() {
    const element = document.getElementById('closing-report-pdf-area');
    if (!element) return;
    if(typeof html2pdf === 'undefined') return alert('html2pdf belum siap.');
    html2pdf().from(element).save();
}

function exportKasirReportExcel() {
    const activeTodayTrx = sysDatabase.transactions.filter(t => t.status === 'Sukses' && new Date(t.timestamp).toDateString() === todayStr);
    let rows = activeTodayTrx.map(t => ({ "Order": t.orderNumber, "Pelanggan": t.customer, "Item": t.items, "Total": t.total }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Closing");
    XLSX.writeFile(wb, `Kasir-Closing-${todayStr}.xlsx`);
}

function exportOwnerReportPDF() {
    const element = document.getElementById('table-owner-transactions-log');
    if (!element) return;
    if(typeof html2pdf === 'undefined') return alert('html2pdf belum siap.');
    html2pdf().from(element).save();
}

function exportOwnerReportExcel() {
    let rows = sysDatabase.transactions.map(t => ({ "Order": t.orderNumber, "Nota": t.id, "Pelanggan": t.customer, "Total": t.total, "Status": t.status }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Master Log");
    XLSX.writeFile(wb, "Master-Owner-Log.xlsx");
}

// ==========================================================================
// 8. OWNER PANEL DATA CENTER & PROTECTION GRAFIK
// ==========================================================================
function renderOwnerDashboardMetrics() {
    const validTrx = sysDatabase.transactions.filter(t => t.status === 'Sukses');
    const now = new Date();
    let omzetHari = 0, omzetMinggu = 0, omzetBulan = 0, omzetTahun = 0;
    let monthlyDataArray = Array(12).fill(0);

    validTrx.forEach(t => {
        const tDate = new Date(t.timestamp);
        const diffDays = Math.ceil(Math.abs(now - tDate) / (1000 * 60 * 60 * 24));
        if (tDate.getFullYear() === now.getFullYear()) monthlyDataArray[tDate.getMonth()] += t.total;
        if (tDate.toDateString() === now.toDateString()) omzetHari += t.total;
        if (diffDays <= 7) omzetMinggu += t.total;
        if (tDate.getMonth() === now.getMonth() && tDate.getFullYear() === now.getFullYear()) omzetBulan += t.total;
        if (tDate.getFullYear() === now.getFullYear()) omzetTahun += t.total;
    });

    if (document.getElementById('own-rekap-hari')) document.getElementById('own-rekap-hari').innerText = 'Rp ' + omzetHari.toLocaleString('id-ID');
    if (document.getElementById('own-rekap-minggu')) document.getElementById('own-rekap-minggu').innerText = 'Rp ' + omzetMinggu.toLocaleString('id-ID');
    if (document.getElementById('own-rekap-bulan')) document.getElementById('own-rekap-bulan').innerText = 'Rp ' + omzetBulan.toLocaleString('id-ID');
    if (document.getElementById('own-rekap-tahun')) document.getElementById('own-rekap-tahun').innerText = 'Rp ' + omzetTahun.toLocaleString('id-ID');

    // Proteksi Grafik: Jika script Chart.js belum ke-load, sistem manajemen owner tidak akan macet/eror
    try {
        if (typeof Chart !== 'undefined') {
            if (chartInstanceGlobal) chartInstanceGlobal.destroy();
            const canvasEl = document.getElementById('canvasTrenOwner');
            if (canvasEl) {
                chartInstanceGlobal = new Chart(canvasEl.getContext('2d'), {
                    type: 'line',
                    data: {
                        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'],
                        datasets: [{ label: 'Omzet Bersih (Rp)', data: monthlyDataArray, borderColor: '#2d5a27', tension: 0.3, fill: true }]
                    },
                    options: { responsive: true, maintainAspectRatio: false }
                });
            }
        }
    } catch (e) { 
        console.warn("Chart.js belum dimuat sempuna:", e.message); 
    }

    renderHistoryTable();
    renderMemberTable();
    renderMenuManagementTable();
    renderRekeningManagementTable();
}

// ==========================================================================
// 9. REKENING & DINAMIS TRANSFER SYSTEM
// ==========================================================================
function populateTransferDropdown() {
    const select = document.getElementById('sub-target-transfer');
    if (!select) return;
    select.innerHTML = '';
    if (sysDatabase.rekening.length === 0) {
        select.innerHTML = '<option value="">Belum ada rekening aktif</option>';
        return;
    }
    sysDatabase.rekening.forEach((rek, index) => {
        select.innerHTML += `<option value="${index}">${rek.bank}</option>`;
    });
    updateLiveRekeningInfo();
}

function updateLiveRekeningInfo() {
    const selectEl = document.getElementById('sub-target-transfer');
    if (!selectEl) return;
    const idx = selectEl.value;
    const box = document.getElementById('live-rekening-info-box');
    if (idx !== "" && sysDatabase.rekening[idx] && box) {
        const item = sysDatabase.rekening[idx];
        box.innerText = `🏦 ${item.bank} - No: ${item.nomor} (A/N: ${item.holder})`;
    }
}

function saveNewRekeningFromOwner() {
    const bank = document.getElementById('own-rek-bankname').value;
    const nomor = document.getElementById('own-rek-number').value.trim();
    const holder = document.getElementById('own-rek-holder').value.trim();
    if (!nomor || !holder) return alert('Data wajib diisi!');

    sysDatabase.rekening.push({ bank, nomor, holder });
    saveToStorage();
    alert('Akun Pembayaran Sukses Ditambahkan!');
    document.getElementById('own-rek-number').value = '';
    document.getElementById('own-rek-holder').value = '';
    renderRekeningManagementTable();
    populateTransferDropdown();
}

function renderRekeningManagementTable() {
    const tbody = document.getElementById('own-render-rekening-rows');
    if (!tbody) return;
    tbody.innerHTML = '';
    sysDatabase.rekening.forEach((rek, index) => {
        tbody.innerHTML += `
            <tr>
                <td><b>${rek.bank}</b></td>
                <td>${rek.nomor}</td>
                <td>${rek.holder}</td>
                <td>
                    <button onclick="executeEditRekening(${index})">Edit</button>
                    <button onclick="executeDeleteRekening(${index})">Hapus</button>
                </td>
            </tr>
        `;
    });
}

function executeDeleteRekening(index) {
    if (!confirm('Hapus akun pembayaran ini?')) return;
    sysDatabase.rekening.splice(index, 1);
    saveToStorage();
    renderRekeningManagementTable();
    populateTransferDropdown();
}

function executeEditRekening(index) {
    let item = sysDatabase.rekening[index];
    let newNo = prompt("Ubah Nomor Rekening:", item.nomor);
    if (newNo === null) return;
    let newHolder = prompt("Ubah Atas Nama:", item.holder);
    if (newHolder === null) return;

    sysDatabase.rekening[index].nomor = newNo.trim();
    sysDatabase.rekening[index].holder = newHolder.trim().toUpperCase();
    saveToStorage();
    renderRekeningManagementTable();
    populateTransferDropdown();
}

// ==========================================================================
// 10. PRODUCT MANAGEMENT TABLE CRUD
// ==========================================================================
function saveNewMenuFromOwner() {
    const name = document.getElementById('own-add-menu-name').value.trim().toUpperCase();
    let price = parseInt(document.getElementById('own-add-menu-price').value);
    const type = document.getElementById('own-add-menu-type').value;

    if (!name) return alert('Nama produk tidak boleh kosong!');
    if (type === 'Complimentary') price = 0; 

    sysDatabase.menu.push({ id: 'm-' + Date.now(), name, price, type });
    saveToStorage();
    alert('Menu Berhasil Didaftarkan!');
    document.getElementById('own-add-menu-name').value = '';
    document.getElementById('own-add-menu-price').value = '';
    renderKatalogKasir();
    renderMenuManagementTable();
}

function saveNewBundleFromOwner() {
    const name = document.getElementById('own-add-bundle-name').value.trim();
    const price = parseInt(document.getElementById('own-add-bundle-price').value);
    if (!name || isNaN(price)) return alert('Lengkapi data bundling!');

    sysDatabase.bundles.push({ id: 'b-' + Date.now(), name, price });
    saveToStorage();
    alert('Paket Bundling Hemat Aktif!');
    document.getElementById('own-add-bundle-name').value = '';
    document.getElementById('own-add-bundle-price').value = '';
    renderKatalogKasir();
}

function renderMenuManagementTable() {
    const tbody = document.getElementById('own-render-menu-rows');
    if (!tbody) return;
    tbody.innerHTML = '';
    sysDatabase.menu.forEach((item, index) => {
        tbody.innerHTML += `
            <tr>
                <td><b>${item.name}</b></td>
                <td>Rp ${item.price.toLocaleString('id-ID')}</td>
                <td>${item.type}</td>
                <td>
                    <button onclick="executeEditMenu(${index})">Edit</button>
                    <button onclick="executeDeleteMenu(${index})">Hapus</button>
                </td>
            </tr>
        `;
    });
}

function executeDeleteMenu(index) {
    if (!confirm('Hapus item ini?')) return;
    sysDatabase.menu.splice(index, 1);
    saveToStorage();
    renderMenuManagementTable();
    renderKatalogKasir();
}

function executeEditMenu(index) {
    let target = sysDatabase.menu[index];
    let newName = prompt("Ubah Nama Menu:", target.name);
    if (newName === null) return;
    let newPrice = target.price;
    if (target.type !== 'Complimentary') {
        let inputPrice = prompt("Ubah Harga Jual:", target.price);
        if (inputPrice === null) return;
        newPrice = parseInt(inputPrice) || 0;
    }
    sysDatabase.menu[index].name = newName.trim().toUpperCase();
    sysDatabase.menu[index].price = newPrice;
    saveToStorage();
    renderMenuManagementTable();
    renderKatalogKasir();
}

// ==========================================================================
// 11. MEMBERSHIP CONTROL ACTIONS
// ==========================================================================
function renderMemberTable() {
    const tbody = document.getElementById('own-render-member-rows');
    if (!tbody) return;
    tbody.innerHTML = '';
    sysDatabase.members.forEach((m, index) => {
        tbody.innerHTML += `
            <tr>
                <td><b>${m.name}</b></td>
                <td>${m.wa}</td>
                <td>${m.poin} Poin</td>
                <td>
                    <button onclick="executeEditMember(${index})">Edit</button>
                    <button onclick="executeDeleteMember(${index}, '${m.name}')">Hapus</button>
                </td>
            </tr>`;
    });
}

function executeDeleteMember(index, name) {
    if (!confirm(`Hapus member "${name}"?`)) return;
    sysDatabase.members.splice(index, 1);
    saveToStorage();
    renderMemberTable();
}

function executeEditMember(index) {
    let m = sysDatabase.members[index];
    let n = prompt("Ubah Nama:", m.name); if (n === null) return;
    let w = prompt("Ubah WA:", m.wa); if (w === null) return;
    let p = prompt("Ubah Poin:", m.poin); if (p === null) return;
    
    sysDatabase.members[index] = { name: n.trim().toUpperCase(), wa: w.trim(), poin: parseInt(p) || 0 };
    saveToStorage();
    renderMemberTable();
}

// ==========================================================================
// 12. LOG HISTORI TRANSAKSI & CORE VOID
// ==========================================================================
function renderHistoryTable() {
    const tbody = document.getElementById('own-render-history-rows');
    if (!tbody) return;
    tbody.innerHTML = '';
    const filterMonth = document.getElementById('own-filter-month-select') ? document.getElementById('own-filter-month-select').value : 'all';
    
    let filtered = sysDatabase.transactions;
    if (activeRole === 'kasir') {
        const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
        filtered = filtered.filter(t => Date.parse(t.timestamp) >= oneDayAgo);
    } else if (activeRole === 'owner' && filterMonth !== 'all') {
        filtered = filtered.filter(t => new Date(t.timestamp).getMonth() === parseInt(filterMonth));
    }

    filtered.forEach(t => {
        let actionButton = '';
        if (activeRole === 'owner' && t.status === 'Sukses') {
            actionButton = `<button onclick="executeVoidTransaction('${t.id}')">VOID</button>`;
        }
        let styleRow = t.status === 'Voided' ? 'style="text-decoration: line-through; color: #aaa;"' : '';
        
        tbody.innerHTML += `
            <tr ${styleRow}>
                <td>#${t.orderNumber || '-'}</td>
                <td>${t.id}</td>
                <td>${new Date(t.timestamp).toLocaleString('id-ID')}</td>
                <td>${t.customer}</td>
                <td>Rp ${t.total.toLocaleString('id-ID')}</td>
                <td>${t.payment}</td>
                <td>${t.status}</td>
                <td>${actionButton}</td>
            </tr>
        `;
    });
}

function executeVoidTransaction(id) {
    if (!confirm(`Void transaksi ${id}?`)) return;
    let idx = sysDatabase.transactions.findIndex(t => t.id === id);
    if (idx !== -1) {
        let trxObj = sysDatabase.transactions[idx];
        let memberMatch = sysDatabase.members.findIndex(m => m.name === trxObj.customer);
        if (memberMatch !== -1) {
            sysDatabase.members[memberMatch].poin -= trxObj.itemCount;
            if (sysDatabase.members[memberMatch].poin < 0) sysDatabase.members[memberMatch].poin = 0;
        }
        sysDatabase.transactions[idx].total = 0;
        sysDatabase.transactions[idx].status = 'Voided';
        saveToStorage();
        renderOwnerDashboardMetrics();
        calculateLiveClosingDashboard();
    }
}

function saveNewVoucherFromOwner() {
    const code = document.getElementById('own-vch-code').value.trim().toUpperCase();
    const nominal = parseInt(document.getElementById('own-vch-nominal').value);
    const type = document.getElementById('own-vch-type').value;
    if (!code || !nominal) return alert('Isi lengkap data diskon!');
    sysDatabase.vouchers.push({ code, nominal, type });
    saveToStorage();
    alert(`Kode ${code} Berhasil Didaftarkan.`);
    document.getElementById('own-vch-code').value = '';
    document.getElementById('own-vch-nominal').value = '';
}
