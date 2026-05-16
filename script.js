// ==========================================================================
// 1. ENGINE DATABASE CORE (LOCALSTORAGE RECONCILIATION)
// ==========================================================================
let sysDatabase = JSON.parse(localStorage.getItem('pakchill_enterprise_db_v5')) || {
    menu: [
        { id: 'm1', name: 'PACHOY', price: 15000 },
        { id: 'm2', name: 'NANAS', price: 12000 }
    ],
    bundles: [],
    vouchers: [
        { code: 'PAKCHILLSEHAT', nominal: 5000, type: 'Voucher' }
    ],
    rekening: [
        { bank: 'BCA', nomor: '8410923121 a/n PT PAKCHILL' },
        { bank: 'GoPay', nomor: '081234567890 a/n PAKCHILL INDO' }
    ],
    members: [
        { name: 'APRIl', wa: '0812', poin: 10 }
    ],
    transactions: []
};

let activeRole = null;
let activeCart = [];
let activeMemberObj = null;
let chartInstanceGlobal = null;

function saveToStorage() {
    localStorage.setItem('pakchill_enterprise_db_v5', JSON.stringify(sysDatabase));
}

// ==========================================================================
// 2. OTENTIKASI SISTEM (KASIR: 123 | OWNER: 000)
// ==========================================================================
function executeAuthentication() {
    const pin = document.getElementById('sys-pin-access').value.trim();
    
    if (pin === '123') {
        activeRole = 'kasir';
        document.getElementById('badge-status-role').innerText = 'Staff Kasir';
        document.getElementById('badge-status-role').style.background = '#2d5a27';
        document.getElementById('view-segment-kasir').style.display = 'grid';
        document.getElementById('view-segment-owner').style.display = 'none';
        document.getElementById('owner-filter-wrapper').style.display = 'none'; // Sembunyikan filter bulan milik owner
        unlockInterface();
    } else if (pin === '000') {
        activeRole = 'owner';
        document.getElementById('badge-status-role').innerText = 'Owner Control';
        document.getElementById('badge-status-role').style.background = '#5856d6';
        document.getElementById('view-segment-kasir').style.display = 'block';
        document.getElementById('view-segment-owner').style.display = 'block';
        document.getElementById('owner-filter-wrapper').style.display = 'flex'; // Munculkan filter bulan untuk owner
        unlockInterface();
        renderOwnerDashboardMetrics(); // Render Chart & Angka Finansial Agar Tidak Kosong
    } else {
        alert('PIN Otentikasi Salah! Akses Sistem Terkunci.');
    }
}

function unlockInterface() {
    document.getElementById('login-screen-overlay').style.display = 'none';
    document.getElementById('main-app-layer').style.display = 'block';
    document.getElementById('sys-pin-access').value = '';
    renderKatalogKasir();
    renderCartUI();
    renderHistoryTable();
    renderMemberTable();
}

function triggerSystemLogout() {
    activeRole = null;
    activeCart = [];
    activeMemberObj = null;
    document.getElementById('main-app-layer').style.display = 'none';
    document.getElementById('login-screen-overlay').style.display = 'flex';
}

// ==========================================================================
// 3. ENGINE UTAMA KATALOG & OPERASIONAL KASIR
// ==========================================================================
function renderKatalogKasir() {
    const target = document.getElementById('katalog-render-target');
    target.innerHTML = '';

    // Menu Reguler
    sysDatabase.menu.forEach(item => {
        target.innerHTML += `
            <div class="product-item-card" onclick="pushItemToCart('${item.name}', ${item.price})">
                <div style="font-weight:900; font-size:15px; color:var(--pakchill-green-dark);">${item.name}</div>
                <div style="color:var(--pakchill-green-soft); font-weight:700; margin-top:5px;">Rp ${item.price.toLocaleString('id-ID')}</div>
            </div>
        `;
    });

    // Paket Bundling Promo Owner
    sysDatabase.bundles.forEach(bundle => {
        target.innerHTML += `
            <div class="product-item-card" onclick="pushItemToCart('${bundle.name}', ${bundle.price})">
                <span class="badge-bundling-tag">Paket</span>
                <div style="font-weight:900; font-size:14px; color:#ff9500; margin-top:10px;">${bundle.name}</div>
                <div style="color:var(--pakchill-green-soft); font-weight:700; margin-top:5px;">Rp ${bundle.price.toLocaleString('id-ID')}</div>
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
    container.innerHTML = '';
    
    if (activeCart.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:#999; font-size:13px; padding:20px;">Keranjang belanja kosong.</p>';
        document.getElementById('txt-subtotal-val').innerText = 'Rp 0';
        document.getElementById('txt-grand-total-display').innerText = 'Rp 0';
        return;
    }

    activeCart.forEach(item => {
        container.innerHTML += `
            <div class="cart-item-row">
                <div style="width: 45%; font-weight:bold; font-size:13px;">${item.name}</div>
                <div style="width: 35%; text-align: right; font-size:13px; color:#333;">Rp ${item.price.toLocaleString('id-ID')}</div>
                <div style="width: 20%; text-align: right;">
                    <button onclick="removeItemFromCart(${item.uid})" style="width:auto; margin:0; padding:3px 8px; background:#ff3b30; color:white; border:none; border-radius:6px; font-weight:bold; cursor:pointer; font-size:11px;">✕</button>
                </div>
            </div>
        `;
    });
    recalculateCartTotals();
}

// ==========================================================================
// 4. MULTI-INPUT CALCULATOR (ANGKA MANUAL vs KODE VOUCHER)
// ==========================================================================
function recalculateCartTotals() {
    let subtotal = activeCart.reduce((sum, item) => sum + item.price, 0);
    document.getElementById('txt-subtotal-val').innerText = 'Rp ' + subtotal.toLocaleString('id-ID');

    let diskonRaw = document.getElementById('kasir-input-diskon').value.trim();
    let voucherRaw = document.getElementById('kasir-input-voucher').value.trim();

    let nilaiDiskon = 0;
    let nilaiVoucher = 0;

    // Logika Diskon Multi-input
    if (diskonRaw !== '' && diskonRaw !== '0') {
        let match = sysDatabase.vouchers.find(v => v.code.toUpperCase() === diskonRaw.toUpperCase() && v.type === 'Diskon');
        if (match) {
            nilaiDiskon = match.nominal;
        } else {
            nilaiDiskon = parseInt(diskonRaw) || 0; // Jika angka murni
        }
    }

    // Logika Voucher Multi-input
    if (voucherRaw !== '' && voucherRaw !== '0') {
        let match = sysDatabase.vouchers.find(v => v.code.toUpperCase() === voucherRaw.toUpperCase() && v.type === 'Voucher');
        if (match) {
            nilaiVoucher = match.nominal;
        } else {
            nilaiVoucher = parseInt(voucherRaw) || 0; // Jika angka murni
        }
    }

    let grandTotal = subtotal - nilaiDiskon - nilaiVoucher;
    if (grandTotal < 0) grandTotal = 0;

    document.getElementById('txt-grand-total-display').innerText = 'Rp ' + grandTotal.toLocaleString('id-ID');
    calculateCashReturn();
    return { subtotal, diskon: nilaiDiskon, voucher: nilaiVoucher, total: grandTotal };
}

// ==========================================================================
// 5. PERCABANGAN METODE BAYAR & REKENING DINAMIS
// ==========================================================================
function handlePaymentDropdownBranching() {
    const method = document.getElementById('kasir-select-paymethod').value;
    document.getElementById('wrapper-sub-cash').style.display = (method === 'Cash') ? 'block' : 'none';
    document.getElementById('wrapper-sub-qris').style.display = (method === 'QRIS') ? 'block' : 'none';
    document.getElementById('wrapper-sub-transfer').style.display = (method === 'Transfer') ? 'block' : 'none';
    
    if (method === 'Transfer') {
        populateTransferDropdown();
    }
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
    select.innerHTML = '';
    if (sysDatabase.rekening.length === 0) {
        select.innerHTML = '<option value="">Belum ada data bank</option>';
        document.getElementById('live-rekening-info-box').innerText = 'Silakan isi rekening di panel owner.';
        return;
    }
    sysDatabase.rekening.forEach((rek, index) => {
        select.innerHTML += `<option value="${index}">${rek.bank}</option>`;
    });
    updateLiveRekeningInfo();
}

function updateLiveRekeningInfo() {
    const idx = document.getElementById('sub-target-transfer').value;
    if (idx !== "" && sysDatabase.rekening[idx]) {
        document.getElementById('live-rekening-info-box').innerText = "Info Rekening: " + sysDatabase.rekening[idx].nomor;
    }
}

// ==========================================================================
// 6. SEARCH LIVE LOYALTY & REGISTER MEMBER
// ==========================================================================
function executeLiveSearchMember() {
    const query = document.getElementById('kasir-search-member').value.trim().toUpperCase();
    const infoBox = document.getElementById('kasir-member-status-box');
    
    if(query === "") {
        infoBox.innerText = '';
        activeMemberObj = null;
        return;
    }

    activeMemberObj = sysDatabase.members.find(m => m.name.toUpperCase() === query || m.wa === query);
    
    if (activeMemberObj) {
        infoBox.innerText = `🌟 MEMBER FOUND: ${activeMemberObj.name} | Poin Anda: ${activeMemberObj.poin}`;
        infoBox.style.color = "#2d5a27";
    } else {
        infoBox.innerText = "Pelanggan Umum (Belum terdaftar Member)";
        infoBox.style.color = "#ff9500";
    }
}

function registerFastMemberFromKasir() {
    const nama = document.getElementById('kasir-search-member').value.trim();
    const wa = document.getElementById('kasir-fast-wa').value.trim();

    if(!nama || !wa) return alert('Input Nama Pelanggan dan No WA untuk pendaftaran cepat!');
    
    let exists = sysDatabase.members.some(m => m.wa === wa);
    if(exists) return alert('Nomor WhatsApp ini sudah terdaftar!');

    sysDatabase.members.push({ name: nama, wa: wa, poin: 0 });
    saveToStorage();
    alert(`Member ${nama} Sukses Didaftarkan!`);
    document.getElementById('kasir-fast-wa').value = '';
    executeLiveSearchMember();
    renderMemberTable();
}

// ==========================================================================
// 7. FINALISASI TRANSAKSI & CETAK NOTA KERTAS THERMAL
// ==========================================================================
function finalizeTransactionReceipt(mode) {
    if (activeCart.length === 0) return alert('Pilih produk terlebih dahulu!');
    
    const financials = recalculateCartTotals();
    const method = document.getElementById('kasir-select-paymethod').value;
    
    // Logika Akumulasi Kelipatan Poin: 1 item = 1 Poin
    let poinTambahan = activeCart.length;

    if (activeMemberObj) {
        let index = sysDatabase.members.findIndex(m => m.wa === activeMemberObj.wa);
        if(index !== -1) {
            sysDatabase.members[index].poin += poinTambahan;
        }
    }

    const trxId = 'TRX-' + Date.now();
    const newTransaction = {
        id: trxId,
        timestamp: new Date().toISOString(),
        customer: activeMemberObj ? activeMemberObj.name : document.getElementById('kasir-search-member').value || 'Umum',
        items: activeCart.map(i => i.name).join(', '),
        itemCount: activeCart.length,
        total: financials.total,
        payment: method,
        status: 'Sukses'
    };

    sysDatabase.transactions.push(newTransaction);
    saveToStorage();

    if (mode === 'Print') {
        buildThermalReceiptHTML(newTransaction, financials);
        window.print();
    } else {
        alert('Transaksi Disimpan! Notifikasi email diarahkan ke API Gateway.');
    }

    // Reset Kasir
    activeCart = [];
    document.getElementById('kasir-input-diskon').value = '0';
    document.getElementById('kasir-input-voucher').value = '0';
    document.getElementById('kasir-search-member').value = '';
    document.getElementById('kasir-cash-input-uang').value = '';
    document.getElementById('kasir-member-status-box').innerText = '';
    renderCartUI();
    if(activeRole === 'owner') renderOwnerDashboardMetrics();
}

function buildThermalReceiptHTML(trx, financial) {
    const area = document.getElementById('thermal-receipt-output');
    area.innerHTML = `
        <div style="text-align:center; font-weight:bold;">PAKCHILL POS v5.0</div>
        <div style="text-align:center; font-size:10px;">Enterprise Mobile Edition</div>
        <hr style="border-top:1px dashed #000;">
        <div>ID  : ${trx.id}</div>
        <div>Tgl : ${new Date(trx.timestamp).toLocaleString('id-ID')}</div>
        <div>Cust: ${trx.customer}</div>
        <hr style="border-top:1px dashed #000;">
        <div>Items: ${trx.items}</div>
        <hr style="border-top:1px dashed #000;">
        <div style="display:flex; justify-content:space-between;"><span>Subtotal:</span><span>Rp ${financial.subtotal.toLocaleString('id-ID')}</span></div>
        <div style="display:flex; justify-content:space-between;"><span>Potongan:</span><span>Rp ${(financial.diskon + financial.voucher).toLocaleString('id-ID')}</span></div>
        <div style="display:flex; justify-content:space-between; font-weight:bold;"><span>TOTAL:</span><span>Rp ${trx.total.toLocaleString('id-ID')}</span></div>
        <div>Bayar via: ${trx.payment}</div>
        <hr style="border-top:1px dashed #000;">
        <div style="text-align:center; font-size:10px; font-weight:bold;">
            "Terima kasih telah mendukung petani local. Stay Healthy, Stay Chill bersama Pakchill. Poin Member Anda telah ditambahkan."
        </div>
    `;
}

// ==========================================================================
// 8. ENGINE SUB-DASHBOARD MANAGEMENT CONTROL (OWNER AREA)
// ==========================================================================
function renderOwnerDashboardMetrics() {
    // Saring transaksi aktif (Bukan Void)
    const validTrx = sysDatabase.transactions.filter(t => t.status === 'Sukses');
    const now = new Date();

    let omzetHari = 0, omzetMinggu = 0, omzetBulan = 0, omzetTahun = 0;
    let monthlyDataArray = Array(12).fill(0);

    validTrx.forEach(t => {
        const tDate = new Date(t.timestamp);
        const diffTime = Math.abs(now - tDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        // Pengisian Data Chart Berdasarkan Bulan Kejadian
        if(tDate.getFullYear() === now.getFullYear()) {
            monthlyDataArray[tDate.getMonth()] += t.total;
        }

        // Hitung Omzet Hari Ini
        if(tDate.toDateString() === now.toDateString()) omzetHari += t.total;
        // Hitung 7 Hari Terakhir
        if(diffDays <= 7) omzetMinggu += t.total;
        // Hitung Bulan Ini
        if(tDate.getMonth() === now.getMonth() && tDate.getFullYear() === now.getFullYear()) omzetBulan += t.total;
        // Hitung Tahun Ini
        if(tDate.getFullYear() === now.getFullYear()) omzetTahun += t.total;
    });

    // Pasang Nilai ke 4 Kartu Rekap Utama
    document.getElementById('own-rekap-hari').innerText = 'Rp ' + omzetHari.toLocaleString('id-ID');
    document.getElementById('own-rekap-minggu').innerText = 'Rp ' + omzetMinggu.toLocaleString('id-ID');
    document.getElementById('own-rekap-bulan').innerText = 'Rp ' + omzetBulan.toLocaleString('id-ID');
    document.getElementById('own-rekap-tahun').innerText = 'Rp ' + omzetTahun.toLocaleString('id-ID');

    // RENDERING GRAFIK TREN BULANAN (CHART.JS) DENGAN SAFE-GUARD TRY-CATCH
    try {
        if (chartInstanceGlobal) {
            chartInstanceGlobal.destroy();
        }
        const ctx = document.getElementById('canvasTrenOwner').getContext('2d');
        chartInstanceGlobal = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'],
                datasets: [{
                    label: 'Tren Omzet Bersih Pakchill (Rp)',
                    data: monthlyDataArray,
                    borderColor: '#2d5a27',
                    backgroundColor: 'rgba(45, 90, 39, 0.1)',
                    borderWidth: 3,
                    tension: 0.3,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: { y: { beginAtZero: true } }
            }
        });
    } catch (error) {
        console.error("Chart.js Error Guard Triggered:", error);
    }

    renderHistoryTable();
    renderMemberTable();
}

// MANAGEMENT FORM ACTIONS BY OWNER
function saveNewMenuFromOwner() {
    const name = document.getElementById('own-add-menu-name').value.trim().toUpperCase();
    const price = parseInt(document.getElementById('own-add-menu-price').value);
    if(!name || !price) return alert('Mohon isi nama dan harga produk!');
    
    sysDatabase.menu.push({ id: 'm-' + Date.now(), name, price });
    saveToStorage();
    alert('Menu Baru Berhasil Masuk Katalog!');
    document.getElementById('own-add-menu-name').value = '';
    document.getElementById('own-add-menu-price').value = '';
    renderKatalogKasir();
}

function saveNewBundleFromOwner() {
    const name = document.getElementById('own-add-bundle-name').value.trim();
    const price = parseInt(document.getElementById('own-add-bundle-price').value);
    if(!name || !price) return alert('Isi Nama Paket dan Harga Promo Paket!');

    sysDatabase.bundles.push({ id: 'b-' + Date.now(), name, price });
    saveToStorage();
    alert('Paket Bundling Hemat Aktif!');
    document.getElementById('own-add-bundle-name').value = '';
    document.getElementById('own-add-bundle-price').value = '';
    renderKatalogKasir();
}

function saveNewVoucherFromOwner() {
    const code = document.getElementById('own-vch-code').value.trim().toUpperCase();
    const nominal = parseInt(document.getElementById('own-vch-nominal').value);
    const type = document.getElementById('own-vch-type').value;
    if(!code || !nominal) return alert('Isi lengkap data pendaftaran diskon!');

    sysDatabase.vouchers.push({ code, nominal, type });
    saveToStorage();
    alert(`Kode Unik Potongan ${code} Berhasil Didaftarkan.`);
    document.getElementById('own-vch-code').value = '';
    document.getElementById('own-vch-nominal').value = '';
}

function saveNewRekeningFromOwner() {
    const bank = document.getElementById('own-rek-bankname').value;
    const nomor = document.getElementById('own-rek-number').value.trim();
    if(!nomor) return alert('Masukkan nomor rekening bank!');

    sysDatabase.rekening.push({ bank, nomor });
    saveToStorage();
    alert('Data Rekening Berhasil Ditambahkan.');
    document.getElementById('own-rek-number').value = '';
}

function registerNewMemberDirectly() {
    const nama = prompt("Masukkan Nama Member Baru:");
    const wa = prompt("Masukkan Nomor WhatsApp Aktif:");
    if(!nama || !wa) return;
    sysDatabase.members.push({ name: nama, wa: wa, poin: 0 });
    saveToStorage();
    renderMemberTable();
}

// ==========================================================================
// 9. RENDER LOG TABLES & KRITIKAL VOID TRANSAKSI
// ==========================================================================
function renderMemberTable() {
    const tbody = document.getElementById('own-render-member-rows');
    tbody.innerHTML = '';
    sysDatabase.members.forEach(m => {
        tbody.innerHTML += `<tr><td><b>${m.name}</b></td><td>${m.wa}</td><td style="color:#2d5a27; font-weight:bold;">${m.poin} Poin</td></tr>`;
    });
}

function renderHistoryTable() {
    const tbody = document.getElementById('own-render-history-rows');
    tbody.innerHTML = '';
    const filterMonth = document.getElementById('own-filter-month-select').value;
    
    // Pembatasan Log Kasir (Hanya 24 jam terakhir)
    let filtered = sysDatabase.transactions;
    if (activeRole === 'kasir') {
        const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
        filtered = filtered.filter(t => Date.parse(t.timestamp) >= oneDayAgo);
    } else if (activeRole === 'owner' && filterMonth !== 'all') {
        filtered = filtered.filter(t => new Date(t.timestamp).getMonth() === parseInt(filterMonth));
    }

    filtered.forEach(t => {
        let actionButton = '';
        // Tombol VOID hanya ada di akun Owner Control
        if (activeRole === 'owner' && t.status === 'Sukses') {
            actionButton = `<button onclick="executeVoidTransaction('${t.id}')" style="background:#ff3b30; color:white; border:none; padding:4px 8px; font-size:11px; font-weight:bold; border-radius:6px; cursor:pointer;">VOID</button>`;
        } else if (t.status === 'Voided') {
            actionButton = `<span style="color:#aaa; font-style:italic;">Dibatalkan</span>`;
        }

        let styleRow = t.status === 'Voided' ? 'style="text-decoration: line-through; color: #aaa;"' : '';
        
        tbody.innerHTML += `
            <tr ${styleRow}>
                <td>${t.id}</td>
                <td>${new Date(t.timestamp).toLocaleString('id-ID')}</td>
                <td>${t.customer}</td>
                <td style="font-weight:bold;">Rp ${t.total.toLocaleString('id-ID')}</td>
                <td><mark style="background:#f0f0f0; padding:2px 6px; border-radius:4px;">${t.payment}</mark></td>
                <td style="color:${t.status === 'Sukses' ? '#34c759' : '#ff3b30'}; font-weight:bold;">${t.status}</td>
                <td>${actionButton}</td>
            </tr>
        `;
    });
}

function executeVoidTransaction(id) {
    if(!confirm(`Apakah Anda yakin ingin melakukan VOID pada transaksi ${id}? Tindakan ini akan merubah omzet secara real-time!`)) return;
    
    let idx = sysDatabase.transactions.findIndex(t => t.id === id);
    if(idx !== -1) {
        // Kurangi poin member kembali jika transaksi ini pakai member
        let trxObj = sysDatabase.transactions[idx];
        let memberMatch = sysDatabase.members.findIndex(m => m.name === trxObj.customer);
        if(memberMatch !== -1) {
            sysDatabase.members[memberMatch].poin -= trxObj.itemCount;
            if(sysDatabase.members[memberMatch].poin < 0) sysDatabase.members[memberMatch].poin = 0;
        }

        // Coret Nilai & Ganti Status
        sysDatabase.transactions[idx].total = 0;
        sysDatabase.transactions[idx].status = 'Voided';
        saveToStorage();
        
        // Refresh Dashboard Owner Secara Real-Time
        renderOwnerDashboardMetrics();
    }
}
