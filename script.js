// ==========================================================================
// 1. DATABASE CORE MATRIX ENGINE (AUTO LOCALSTORAGE MANAGER)
// ==========================================================================
let sysDatabase = JSON.parse(localStorage.getItem('pakchill_enterprise_db_v5.2')) || {
    menu: [
        { id: 'm-1', name: 'PAKCHOY PINEAPPLE', price: 15000, type: 'Reguler' },
        { id: 'm-2', name: 'CHILLY SALAD BOWL', price: 18000, type: 'Reguler' },
        { id: 'm-3', name: 'MINI INFUSED WATER', price: 0, type: 'Complimentary' }
    ], 
    bundles: [
        { id: 'b-1', name: 'PAKET BOOSTER IMUN', price: 28000 }
    ],
    vouchers: [
        { code: 'PAKCHILLSEHAT', nominal: 5000, type: 'Voucher' },
        { code: 'DISKONMEMBER', nominal: 3000, type: 'Diskon' }
    ],
    rekening: [
        { bank: 'BCA', nomor: '8410923121', holder: 'PT PAKCHILL ENTERPRISE' },
        { bank: 'GoPay', nomor: '081234567890', holder: 'PAKCHILL INDO OPERATIONAL' }
    ],
    members: [
        { name: 'ANTON', wa: '08123456', poin: 12 }
    ],
    transactions: [],
    lastOrderDate: new Date().toDateString(),
    currentOrderSeq: 101
};

// Auto-Reset No Urut Order saat Hari Berganti
const appTodayString = new Date().toDateString();
if (sysDatabase.lastOrderDate !== appTodayString) {
    sysDatabase.currentOrderSeq = 101;
    sysDatabase.lastOrderDate = appTodayString;
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
// 2. OTENTIKASI & SECURITY FILTER PIN
// ==========================================================================
function executeAuthentication() {
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
        alert('PIN Otentikasi Salah! Silakan masukkan 123 (Kasir) atau 000 (Owner).');
    }
}

function unlockInterface() {
    document.getElementById('login-screen-overlay').style.display = 'none';
    document.getElementById('main-app-layer').style.display = 'block';
    
    const roleBadge = document.getElementById('badge-status-role');
    if (activeRole === 'kasir') {
        roleBadge.innerText = 'Staff Kasir';
        document.getElementById('view-segment-kasir').style.display = 'grid';
        document.getElementById('view-segment-owner').style.display = 'none';
    } else if (activeRole === 'owner') {
        roleBadge.innerText = 'Owner Control Center';
        document.getElementById('view-segment-kasir').style.display = 'grid'; 
        document.getElementById('view-segment-owner').style.display = 'block';
    }

    document.getElementById('sys-pin-access').value = '';
    document.getElementById('txt-live-order-number').innerText = `Order #: ${sysDatabase.currentOrderSeq}`;
    
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
    document.getElementById('main-app-layer').style.display = 'none';
    document.getElementById('login-screen-overlay').style.display = 'flex';
}

// ==========================================================================
// 3. ENGINE RENDERING KATALOG & KART BELANJA
// ==========================================================================
function renderKatalogKasir() {
    const target = document.getElementById('katalog-render-target');
    if (!target) return;
    target.innerHTML = '';

    // Render Menu Reguler & Complimentary
    sysDatabase.menu.forEach(item => {
        const isComp = item.type === 'Complimentary';
        const displayPrice = isComp ? 'FREE / BONUS' : `Rp ${item.price.toLocaleString('id-ID')}`;
        const cardClass = isComp ? 'product-item-card complimentary-card' : 'product-item-card';
        
        target.innerHTML += `
            <div class="${cardClass}" onclick="pushItemToCart('${item.name}', ${item.price}, '${item.type}')">
                <div class="product-name">${isComp ? '🎁 ' : ''}${item.name}</div>
                <div class="product-price">${displayPrice}</div>
            </div>
        `;
    });

    // Render Paket Bundling Hemat
    sysDatabase.bundles.forEach(bundle => {
        target.innerHTML += `
            <div class="product-item-card bundle-card" onclick="pushItemToCart('${bundle.name}', ${bundle.price}, 'Bundle')">
                <div class="product-name">📦 ${bundle.name}</div>
                <div class="product-price">Rp ${bundle.price.toLocaleString('id-ID')}</div>
            </div>
        `;
    });
}

function pushItemToCart(name, price, type) {
    activeCart.push({ name, price, type, uid: Date.now() + Math.random() });
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
        container.innerHTML = '<p style="text-align:center; color:#999; padding:20px; font-size:12px;">Keranjang kosong.</p>';
        document.getElementById('txt-subtotal-val').innerText = 'Rp 0';
        document.getElementById('txt-grand-total-display').innerText = 'Rp 0';
        return;
    }

    activeCart.forEach(item => {
        const rowClass = item.type === 'Complimentary' ? 'cart-item-row comp-row' : 'cart-item-row';
        container.innerHTML += `
            <div class="${rowClass}">
                <span>${item.name}</span>
                <div>
                    <span>${item.price === 0 ? 'FREE' : 'Rp ' + item.price.toLocaleString('id-ID')}</span>
                    <button onclick="removeItemFromCart(${item.uid})" class="btn-remove-cart">✕</button>
                </div>
            </div>
        `;
    });
    recalculateCartTotals();
}

function recalculateCartTotals() {
    let subtotal = activeCart.reduce((sum, item) => sum + item.price, 0);
    document.getElementById('txt-subtotal-val').innerText = 'Rp ' + subtotal.toLocaleString('id-ID');

    let diskonRaw = document.getElementById('kasir-input-diskon') ? document.getElementById('kasir-input-diskon').value.trim() : '0';
    let voucherRaw = document.getElementById('kasir-input-voucher') ? document.getElementById('kasir-input-voucher').value.trim() : '0';

    let nilaiDiskon = 0;
    let nilaiVoucher = 0;

    if (diskonRaw !== '' && diskonRaw !== '0') {
        let match = sysDatabase.vouchers.find(v => v.code.toUpperCase() === diskonRaw.toUpperCase() && v.type === 'Diskon');
        nilaiDiskon = match ? match.nominal : (parseInt(diskonRaw) || 0);
    }
    if (voucherRaw !== '' && voucherRaw !== '0') {
        let match = sysDatabase.vouchers.find(v => v.code.toUpperCase() === voucherRaw.toUpperCase() && v.type === 'Voucher');
        nilaiVoucher = match ? match.nominal : (parseInt(voucherRaw) || 0);
    }

    let grandTotal = subtotal - nilaiDiskon - nilaiVoucher;
    if (grandTotal < 0) grandTotal = 0;

    document.getElementById('txt-grand-total-display').innerText = 'Rp ' + grandTotal.toLocaleString('id-ID');
    return { subtotal, diskon: nilaiDiskon, voucher: nilaiVoucher, total: grandTotal };
}

// ==========================================================================
// 4. METODE PEMBAYARAN & REKENING DINAMIS INTERFACE
// ==========================================================================
function handlePaymentDropdownBranching() {
    const method = document.getElementById('kasir-select-paymethod').value;
    
    document.getElementById('wrapper-sub-cash').style.display = (method === 'Cash') ? 'block' : 'none';
    document.getElementById('wrapper-sub-qris').style.display = (method === 'QRIS') ? 'block' : 'none';
    document.getElementById('wrapper-sub-transfer').style.display = (method === 'Transfer') ? 'block' : 'none';
    
    if (method === 'Transfer') populateTransferDropdown();
    calculateCashReturn();
}

function calculateCashReturn() {
    const financials = recalculateCartTotals();
    const uangBayar = parseInt(document.getElementById('kasir-cash-input-uang').value) || 0;
    let kembalian = uangBayar - financials.total;
    if (kembalian < 0) kembalian = 0;
    document.getElementById('cash-return-info').innerText = 'Kembalian: Rp ' + kembalian.toLocaleString('id-ID');
}

function populateTransferDropdown() {
    const select = document.getElementById('sub-target-transfer');
    if (!select) return;
    select.innerHTML = '';
    
    if (sysDatabase.rekening.length === 0) {
        select.innerHTML = '<option value="">Belum ada rekening aktif</option>';
        document.getElementById('live-rekening-info-box').innerText = 'Data rekening kosong. Hubungi Owner.';
        return;
    }
    sysDatabase.rekening.forEach((rek, index) => {
        select.innerHTML += `<option value="${index}">${rek.bank}</option>`;
    });
    updateLiveRekeningInfo();
}

function updateLiveRekeningInfo() {
    const idx = document.getElementById('sub-target-transfer').value;
    const box = document.getElementById('live-rekening-info-box');
    if (idx !== "" && sysDatabase.rekening[idx] && box) {
        const item = sysDatabase.rekening[idx];
        box.innerText = `🏦 ${item.bank} — No: ${item.nomor} (A/N: ${item.holder})`;
    }
}

// ==========================================================================
// 5. MEMBERSHIP TRACKING ENGINE & LIVE VALiDATION
// ==========================================================================
function executeLiveSearchMember() {
    const query = document.getElementById('kasir-search-member').value.trim().toUpperCase();
    const infoBox = document.getElementById('kasir-member-status-box');
    if (!infoBox) return;
    
    if (query === "") { infoBox.innerText = ''; activeMemberObj = null; return; }

    activeMemberObj = sysDatabase.members.find(m => m.name.toUpperCase() === query || m.wa === query);
    
    if (activeMemberObj) {
        infoBox.innerText = `🌟 MEMBER LOGGED: ${activeMemberObj.name} | Poin Anda: ${activeMemberObj.poin}`;
        infoBox.style.color = "var(--pakchill-green-soft)";
    } else {
        infoBox.innerText = "Status: Pelanggan Umum";
        infoBox.style.color = "var(--accent-orange)";
    }
}

function registerFastMemberFromKasir() {
    const name = document.getElementById('kasir-fast-name').value.trim();
    const wa = document.getElementById('kasir-fast-wa').value.trim();

    if (!name || !wa) return alert('Mohon lengkapi Nama dan No WhatsApp!');
    if (sysDatabase.members.some(m => m.wa === wa)) return alert('Nomor WA sudah terdaftar!');

    sysDatabase.members.push({ name: name.toUpperCase(), wa: wa, poin: 0 });
    saveToStorage();
    
    alert(`Member Berhasil Terdaftar: ${name.toUpperCase()}`);
    document.getElementById('kasir-search-member').value = wa;
    document.getElementById('kasir-fast-name').value = '';
    document.getElementById('kasir-fast-wa').value = '';
    
    executeLiveSearchMember();
    renderMemberTable();
}

// ==========================================================================
// 6. FINALISASI TRANSAKSI & EMULATOR STRUK THERMAL 58MM
// ==========================================================================
function finalizeTransactionReceipt(mode) {
    if (activeCart.length === 0) return alert('Keranjang masih kosong!');
    
    const financials = recalculateCartTotals();
    const method = document.getElementById('kasir-select-paymethod').value;
    
    if (method === 'Cash') {
        const uangBayar = parseInt(document.getElementById('kasir-cash-input-uang').value) || 0;
        if (uangBayar < financials.total) return alert(`Uang tunai kurang dari total tagihan!`);
    }
    
    let namaPelangganFix = 'Umum';
    if (activeMemberObj) {
        namaPelangganFix = activeMemberObj.name;
        let index = sysDatabase.members.findIndex(m => m.wa === activeMemberObj.wa);
        if (index !== -1) {
            sysDatabase.members[index].poin += activeCart.length; // 1 Item = 1 Poin (Berlaku Kelipatan)
        }
    } else {
        const manualName = document.getElementById('kasir-search-member').value.trim();
        if (manualName !== "") namaPelangganFix = manualName.toUpperCase();
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
        alert(`Transaksi Sukses! Nomor Antrean: #${currentOrderNo}`);
    }

    // Reset Workspace Kasir
    activeCart = [];
    activeMemberObj = null;
    document.getElementById('kasir-search-member').value = '';
    document.getElementById('kasir-cash-input-uang').value = '';
    document.getElementById('kasir-member-status-box').innerText = '';
    document.getElementById('cash-return-info').innerText = 'Kembalian: Rp 0';
    document.getElementById('txt-live-order-number').innerText = `Order #: ${sysDatabase.currentOrderSeq}`;
    
    renderCartUI();
    calculateLiveClosingDashboard();
    renderMemberTable();
    if (activeRole === 'owner') { renderOwnerDashboardMetrics(); }
}

function buildThermalReceiptHTML(trx, financial) {
    const area = document.getElementById('thermal-receipt-output');
    if (!area) return;
    area.innerHTML = `
        <div style="text-align:center; font-weight:bold;">PAKCHILL POS v5.2</div>
        <div style="text-align:center; font-weight:bold; padding:2px; margin:4px 0;">ORDER NO: #${trx.orderNumber}</div>
        <hr style="border-top:1px dashed #000;">
        <div>Nota  : ${trx.id}</div>
        <div>Tgl   : ${new Date(trx.timestamp).toLocaleString('id-ID')}</div>
        <div>Cust  : ${trx.customer}</div>
        <hr style="border-top:1px dashed #000;">
        <div>Items : ${trx.items}</div>
        <hr style="border-top:1px dashed #000;">
        <div style="display:flex; justify-content:space-between;"><span>Subtotal:</span><span>Rp ${financial.subtotal.toLocaleString('id-ID')}</span></div>
        <div style="display:flex; justify-content:space-between;"><span>Potongan:</span><span>Rp ${(financial.diskon + financial.voucher).toLocaleString('id-ID')}</span></div>
        <div style="display:flex; justify-content:space-between; font-weight:bold;"><span>TOTAL:</span><span>Rp ${trx.total.toLocaleString('id-ID')}</span></div>
        <div>Bayar : ${trx.payment}</div>
        <hr style="border-top:1px dashed #000;">
        <div style="text-align:center; font-size:9px; font-weight:bold; margin-top:10px;">
            "Terima kasih telah mendukung petani local. Stay Healthy, Stay Chill bersama Pakchill. Poin Member Anda telah ditambahkan."
        </div>
    `;
}

// ==========================================================================
// 7. DASHBOARD DATA EXPORTER (PDF & EXCEL SPREADSHEETS)
// ==========================================================================
function exportKasirReportPDF() {
    const element = document.getElementById('closing-report-pdf-area');
    if (typeof html2pdf === 'undefined') return alert('Library PDF belum termuat sempurna.');
    html2pdf().set({ margin: 10, filename: `Closing-Kasir-${appTodayString}.pdf` }).from(element).save();
}

function exportKasirReportExcel() {
    if(typeof XLSX === 'undefined') return alert('Library Excel offline.');
    const activeTodayTrx = sysDatabase.transactions.filter(t => t.status === 'Sukses' && new Date(t.timestamp).toDateString() === appTodayString);
    let rows = activeTodayTrx.map(t => ({ "Order #": t.orderNumber, "Pelanggan": t.customer, "Menu": t.items, "Total": t.total, "Metode": t.payment }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Kasir Closing");
    XLSX.writeFile(wb, `Kasir-Closing-${appTodayString}.xlsx`);
}

function exportOwnerReportPDF() {
    const element = document.getElementById('table-owner-transactions-log');
    if (typeof html2pdf === 'undefined') return alert('Library PDF offline.');
    html2pdf().set({ margin: 5, filename: `Master-Log-Audit.pdf` }).from(element).save();
}

function exportOwnerReportExcel() {
    if(typeof XLSX === 'undefined') return alert('Library Excel offline.');
    let rows = sysDatabase.transactions.map(t => ({ "Order #": t.orderNumber, "ID Nota": t.id, "Waktu": t.timestamp, "Pelanggan": t.customer, "Total": t.total, "Metode": t.payment, "Status": t.status }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Operational Log Master");
    XLSX.writeFile(wb, "Master-Enterprise-Log.xlsx");
}

// ==========================================================================
// 8. MONITOR METRIK KEUANGAN & PROTEKSI GRAFIK CHART.JS (CRASH-SAFE)
// ==========================================================================
function calculateLiveClosingDashboard() {
    const activeTodayTrx = sysDatabase.transactions.filter(t => t.status === 'Sukses' && new Date(t.timestamp).toDateString() === appTodayString);
    let totalUang = 0, totalQty = 0;
    let menuMap = {};

    activeTodayTrx.forEach(t => {
        totalUang += t.total;
        totalQty += t.itemCount;
        if (t.rawItemsArray) {
            t.rawItemsArray.forEach(mName => { menuMap[mName] = (menuMap[mName] || 0) + 1; });
        }
    });

    document.getElementById('txt-closing-total-omzet').innerText = 'Rp ' + totalUang.toLocaleString('id-ID');
    document.getElementById('txt-closing-total-qty').innerText = totalQty + ' Item';

    const listTarget = document.getElementById('closing-menu-list-render');
    listTarget.innerHTML = '';
    let keys = Object.keys(menuMap);
    if (keys.length === 0) {
        listTarget.innerHTML = '<span style="color:#aaa; font-style:italic;">Belum ada item terjual.</span>';
        return;
    }
    keys.forEach(name => { listTarget.innerHTML += `<div>🥗 ${name} &times; ${menuMap[name]} Porsi</div>`; });
}

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

    document.getElementById('own-rekap-hari').innerText = 'Rp ' + omzetHari.toLocaleString('id-ID');
    document.getElementById('own-rekap-minggu').innerText = 'Rp ' + omzetMinggu.toLocaleString('id-ID');
    document.getElementById('own-rekap-bulan').innerText = 'Rp ' + omzetBulan.toLocaleString('id-ID');
    document.getElementById('own-rekap-tahun').innerText = 'Rp ' + omzetTahun.toLocaleString('id-ID');

    // Proteksi Try-Catch Grafik agar Kebal Crash Offline
    try {
        if (typeof Chart !== 'undefined') {
            if (chartInstanceGlobal) chartInstanceGlobal.destroy();
            const canvasEl = document.getElementById('canvasTrenOwner');
            if (canvasEl) {
                chartInstanceGlobal = new Chart(canvasEl.getContext('2d'), {
                    type: 'line',
                    data: {
                        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'],
                        datasets: [{ 
                            label: 'Omzet Bersih Pakchill (Rp)', 
                            data: monthlyDataArray, 
                            borderColor: '#2d5a27', 
                            backgroundColor: 'rgba(45,90,39,0.1)',
                            tension: 0.2, 
                            fill: true 
                        }]
                    },
                    options: { responsive: true, maintainAspectRatio: false }
                });
            }
        }
    } catch (e) { 
        console.error("[Chart.js Safe-Guard] Gagal memuat grafik omzet:", e.message); 
    }

    renderHistoryTable();
    renderMemberTable();
    renderMenuManagementTable();
    renderRekeningManagementTable();
}

// ==========================================================================
// 9. REKENING TRANSFER MANAGEMENT SYSTEM (CRUD)
// ==========================================================================
function saveNewRekeningFromOwner() {
    const bank = document.getElementById('own-rek-bankname').value;
    const nomor = document.getElementById('own-rek-number').value.trim();
    const holder = document.getElementById('own-rek-holder').value.trim();
    if (!nomor || !holder) return alert('Data input belum lengkap!');

    sysDatabase.rekening.push({ bank, nomor, holder: holder.toUpperCase() });
    saveToStorage();
    alert('Rekening Baru Berhasil Diaktifkan!');
    document.getElementById('own-rek-number').value = '';
    document.getElementById('own-rek-holder').value = '';
    
    renderRekeningManagementTable();
    populateTransferDropdown();
}

function renderRekeningManagementTable() {
    const tbody = document.getElementById('own-render-rekening-rows');
    if (!tbody) return; tbody.innerHTML = '';
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
    let newNo = prompt("Ubah Nomor Rekening / HP:", item.nomor); if (!newNo) return;
    let newHolder = prompt("Ubah Atas Nama Pemilik (A/N):", item.holder); if (!newHolder) return;

    sysDatabase.rekening[index].nomor = newNo.trim();
    sysDatabase.rekening[index].holder = newHolder.trim().toUpperCase();
    saveToStorage();
    renderRekeningManagementTable();
    populateTransferDropdown();
}

// ==========================================================================
// 10. PRODUCT & BUNDLING MANAGEMENT CORE (CRUD)
// ==========================================================================
function saveNewMenuFromOwner() {
    const name = document.getElementById('own-add-menu-name').value.trim().toUpperCase();
    let price = parseInt(document.getElementById('own-add-menu-price').value);
    const type = document.getElementById('own-add-menu-type').value;

    if (!name) return alert('Nama item menu wajib diisi!');
    if (type === 'Complimentary') price = 0; // Menu Gratis wajib bernilai 0 Rupiah
    else if (isNaN(price) || price < 0) return alert('Masukkan nominal harga jual reguler yang valid!');

    sysDatabase.menu.push({ id: 'm-' + Date.now(), name, price, type });
    saveToStorage();
    alert('Menu Berhasil Ditambahkan ke Katalog!');
    document.getElementById('own-add-menu-name').value = '';
    document.getElementById('own-add-menu-price').value = '';
    
    renderKatalogKasir();
    renderMenuManagementTable();
}

function saveNewBundleFromOwner() {
    const name = document.getElementById('own-add-bundle-name').value.trim().toUpperCase();
    const price = parseInt(document.getElementById('own-add-bundle-price').value);
    if (!name || isNaN(price)) return alert('Lengkapi Nama dan Harga Paket Bundling!');

    sysDatabase.bundles.push({ id: 'b-' + Date.now(), name, price });
    saveToStorage();
    alert('Paket Hemat Berhasil Diaktifkan!');
    document.getElementById('own-add-bundle-name').value = '';
    document.getElementById('own-add-bundle-price').value = '';
    
    renderKatalogKasir();
}

function renderMenuManagementTable() {
    const tbody = document.getElementById('own-render-menu-rows');
    if (!tbody) return; tbody.innerHTML = '';
    sysDatabase.menu.forEach((item, index) => {
        tbody.innerHTML += `
            <tr>
                <td><b>${item.name}</b></td>
                <td>${item.price === 0 ? 'FREE' : 'Rp ' + item.price.toLocaleString('id-ID')}</td>
                <td><span style="font-weight:bold; color:${item.type==='Complimentary'?'#007aff':'green'};">${item.type}</span></td>
                <td>
                    <button onclick="executeEditMenu(${index})">Edit</button>
                    <button onclick="executeDeleteMenu(${index})">Hapus</button>
                </td>
            </tr>
        `;
    });
}

function executeDeleteMenu(index) {
    if (!confirm('Hapus item menu ini dari katalog?')) return;
    sysDatabase.menu.splice(index, 1);
    saveToStorage();
    renderMenuManagementTable();
    renderKatalogKasir();
}

function executeEditMenu(index) {
    let target = sysDatabase.menu[index];
    let newName = prompt("Ubah Nama Menu:", target.name); if (!newName) return;
    let newPrice = target.price;
    if (target.type !== 'Complimentary') {
        let inputPrice = prompt("Ubah Harga Jual Reguler (Rp):", target.price); if (!inputPrice) return;
        newPrice = parseInt(inputPrice) || 0;
    }
    sysDatabase.menu[index].name = newName.trim().toUpperCase();
    sysDatabase.menu[index].price = newPrice;
    saveToStorage();
    renderMenuManagementTable();
    renderKatalogKasir();
}

// ==========================================================================
// 11. MANAGEMENT MEMBER LOYALTY DATABASE CONTROL
// ==========================================================================
function renderMemberTable() {
    const tbody = document.getElementById('own-render-member-rows');
    if (!tbody) return; tbody.innerHTML = '';
    sysDatabase.members.forEach((m, index) => {
        tbody.innerHTML += `
            <tr>
                <td><b>${m.name}</b></td>
                <td>${m.wa}</td>
                <td style="font-weight:bold; color:var(--pakchill-green-soft);">${m.poin} Poin</td>
                <td>
                    <button onclick="executeEditMember(${index})">Edit</button>
                    <button onclick="executeDeleteMember(${index})">Hapus</button>
                </td>
            </tr>`;
    });
}

function executeDeleteMember(index) {
    if (!confirm(`Hapus data member dari database?`)) return;
    sysDatabase.members.splice(index, 1);
    saveToStorage();
    renderMemberTable();
}

function executeEditMember(index) {
    let m = sysDatabase.members[index];
    let n = prompt("Ubah Nama Member:", m.name); if (!n) return;
    let w = prompt("Ubah No WA:", m.wa); if (!w) return;
    let p = prompt("Ubah Jumlah Poin Loyalty:", m.poin); if (p === null) return;
    
    sysDatabase.members[index] = { name: n.trim().toUpperCase(), wa: w.trim(), poin: parseInt(p) || 0 };
    saveToStorage();
    renderMemberTable();
}

// ==========================================================================
// 12. OPERATION REKAP & SECURITY MASTER VOID ENGINE
// ==========================================================================
function renderHistoryTable() {
    const tbody = document.getElementById('own-render-history-rows');
    if (!tbody) return; tbody.innerHTML = '';
    const filterMonth = document.getElementById('own-filter-month-select') ? document.getElementById('own-filter-month-select').value : 'all';
    
    let filtered = sysDatabase.transactions;
    if (activeRole === 'kasir') {
        const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000); // Filter Riwayat Kasir Hanya 24 Jam Terakhir
        filtered = filtered.filter(t => Date.parse(t.timestamp) >= oneDayAgo);
    } else if (activeRole === 'owner' && filterMonth !== 'all') {
        filtered = filtered.filter(t => new Date(t.timestamp).getMonth() === parseInt(filterMonth));
    }

    filtered.forEach(t => {
        let actionButton = '';
        if (activeRole === 'owner' && t.status === 'Sukses') {
            actionButton = `<button onclick="executeVoidTransaction('${t.id}')">VOID</button>`;
        } else if (t.status === 'Voided') {
            actionButton = `<span style="color:#aaa; font-style:italic;">Voided</span>`;
        }
        let styleRow = t.status === 'Voided' ? 'style="text-decoration: line-through; color: #aaa;"' : '';
        
        tbody.innerHTML += `
            <tr ${styleRow}>
                <td style="font-weight:bold; color:var(--accent-orange);">#${t.orderNumber}</td>
                <td>${t.id}</td>
                <td>${new Date(t.timestamp).toLocaleString('id-ID')}</td>
                <td>${t.customer}</td>
                <td style="font-weight:bold;">Rp ${t.total.toLocaleString('id-ID')}</td>
                <td><mark style="padding:2px 5px; border-radius:4px; font-size:11px;">${t.payment}</mark></td>
                <td style="font-weight:bold; color:${t.status==='Sukses'?'green':'red'};">${t.status}</td>
                <td>${actionButton}</td>
            </tr>
        `;
    });
}

function executeVoidTransaction(id) {
    if (!confirm(`Apakah Anda yakin ingin membatalkan (VOID) Transaksi ini? Poin member yang diperoleh otomatis dikurangi.`)) return;
    let idx = sysDatabase.transactions.findIndex(t => t.id === id);
    if (idx !== -1) {
        let trxObj = sysDatabase.transactions[idx];
        let memberMatch = sysDatabase.members.findIndex(m => m.name === trxObj.customer);
        if (memberMatch !== -1) {
            sysDatabase.members[memberMatch].poin -= trxObj.itemCount; // Pengurangan akurat poin terkoneksi
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
    if (!code || !nominal) return alert('Mohon lengkapi data voucher!');
    
    sysDatabase.vouchers.push({ code, nominal, type });
    saveToStorage();
    alert(`Promo Code "${code}" Berhasil Dirilis.`);
    document.getElementById('own-vch-code').value = '';
    document.getElementById('own-vch-nominal').value = '';
}
