// ==========================================================================
// INITIALIZATION & DATABASE SEEDING (LOCALSTORAGE)
// ==========================================================================
let currentRole = null;
let cart = [];
let monthlyChartInstance = null;

// Ambil atau set up database produk default
let menuDatabase = JSON.parse(localStorage.getItem('pakchill_menu_db'));
if (!menuDatabase || menuDatabase.length === 0) {
    menuDatabase = [
        { id: 'p1', name: 'PACHOY', price: 15000 },
        { id: 'p2', name: 'NANAS', price: 12000 }
    ];
    localStorage.setItem('pakchill_menu_db', JSON.stringify(menuDatabase));
}

// Ambil atau set up database transaksi
let transactionDatabase = JSON.parse(localStorage.getItem('pakchill_pos_db')) || [];

// Tunggu DOM selesai dimuat
document.addEventListener('DOMContentLoaded', () => {
    initEventListeners();
    renderKatalog();
});

// ==========================================================================
// EVENT LISTENERS REGISTER
// ==========================================================================
function initEventListeners() {
    // Auth & Navigation
    document.getElementById('btn-login').addEventListener('click', handleLogin);
    document.getElementById('login-password').addEventListener('keypress', (e) => { if (e.key === 'Enter') handleLogin(); });
    document.getElementById('btn-logout').addEventListener('click', handleLogout);
    document.getElementById('nav-btn-kasir').addEventListener('click', () => switchTab('kasir'));
    document.getElementById('nav-btn-owner').addEventListener('click', () => switchTab('owner'));

    // Kasir Finansial & Input
    document.getElementById('input-diskon').addEventListener('input', calculateCartTotal);
    document.getElementById('input-voucher').addEventListener('input', calculateCartTotal);
    document.getElementById('main-payment-method').addEventListener('change', handlePaymentBranching);

    // Kasir Checkout Actions
    document.getElementById('btn-submit-compliment').addEventListener('click', () => processCheckout('Compliment'));
    document.getElementById('btn-checkout-email').addEventListener('click', () => processCheckout('Email'));
    document.getElementById('btn-checkout-print').addEventListener('click', () => processCheckout('Print'));
    document.getElementById('btn-close-qris-modal').addEventListener('click', closeQrisModalAndFinalize);

    // Owner Actions
    document.getElementById('btn-save-new-product').addEventListener('click', handleAddNewProduct);
    document.getElementById('filter-month-owner').addEventListener('change', renderHistoryTable);
    document.getElementById('btn-export-pdf').addEventListener('click', exportOwnerReportPDF);
    document.getElementById('btn-export-excel').addEventListener('click', exportOwnerReportExcel);
}

// ==========================================================================
// GERBANG OTENTIKASI & SEGREGASI HAK AKSES
// ==========================================================================
function handleLogin() {
    const pinInput = document.getElementById('login-password').value;
    
    if (pinInput === '123') {
        currentRole = 'kasir';
        document.getElementById('badge-role').textContent = 'Staff Kasir';
        document.getElementById('nav-btn-owner').style.display = 'none';
        executeUnlock();
    } else if (pinInput === '000') {
        currentRole = 'owner';
        document.getElementById('badge-role').textContent = 'Owner App';
        document.getElementById('nav-btn-owner').style.display = 'block';
        executeUnlock();
    } else {
        alert('PIN Akses Salah. Keamanan Terkunci!');
    }
}

function executeUnlock() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('main-app').style.display = 'block';
    document.getElementById('login-password').value = '';
    switchTab('kasir');
}

function handleLogout() {
    currentRole = null;
    cart = [];
    renderCart();
    document.getElementById('main-app').style.display = 'none';
    document.getElementById('login-screen').style.display = 'flex';
}

function switchTab(tabName) {
    document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.page-view').forEach(view => view.classList.remove('active-view'));

    if (tabName === 'kasir') {
        document.getElementById('nav-btn-kasir').classList.add('active');
        document.getElementById('page-kasir').classList.add('active-view');
    } else if (tabName === 'owner' && currentRole === 'owner') {
        document.getElementById('nav-btn-owner').classList.add('active');
        document.getElementById('page-owner').classList.add('active-view');
        // Refresh data Owner metrics
        calculateOwnerMetrics();
        renderHistoryTable();
    }
}

// ==========================================================================
// MODUL TERMINAL KASIR OPERASIONAL
// ==========================================================================
function renderKatalog() {
    const container = document.getElementById('katalog-container');
    container.innerHTML = '';
    
    menuDatabase.forEach(product => {
        const card = document.createElement('div');
        card.className = 'product-item-card';
        card.innerHTML = `
            <div class="pro-icon-avatar">${product.name.charAt(0)}</div>
            <div class="pro-name">${product.name}</div>
            <div class="pro-price">Rp ${product.price.toLocaleString('id-ID')}</div>
        `;
        card.addEventListener('click', () => addToCart(product));
        container.appendChild(card);
    });
}

function addToCart(product) {
    cart.push({ ...product, cartId: Date.now() + Math.random() });
    renderCart();
}

function removeFromCart(cartId) {
    cart = cart.filter(item => item.cartId !== cartId);
    renderCart();
}

function renderCart() {
    const tbody = document.getElementById('cart-table-body');
    tbody.innerHTML = '';

    cart.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><b>${item.name}</b></td>
            <td>Rp ${item.price.toLocaleString('id-ID')}</td>
            <td style="text-align: center;">
                <button class="btn-delete-item" onclick="removeFromCart(${item.cartId})">✕</button>
            </td>
        `;
        tbody.appendChild(row);
    });
    calculateCartTotal();
}

function calculateCartTotal() {
    const subtotal = cart.reduce((sum, item) => sum + item.price, 0);
    const diskon = parseInt(document.getElementById('input-diskon').value) || 0;
    const voucher = parseInt(document.getElementById('input-voucher').value) || 0;
    
    let total = subtotal - diskon - voucher;
    if (total < 0) total = 0; // Mengunci batas minimum total Rp 0 sesuai rumus blueprint

    document.getElementById('summary-subtotal').textContent = `Rp ${subtotal.toLocaleString('id-ID')}`;
    document.getElementById('summary-total').textContent = `Rp ${total.toLocaleString('id-ID')}`;
    return { subtotal, diskon, voucher, total };
}

// LOGIKA PERCABANGAN METODE PEMBAYARAN
function handlePaymentBranching() {
    const mainMethod = document.getElementById('main-payment-method').value;
    const qrisWrapper = document.getElementById('sub-qris-wrapper');
    const transferWrapper = document.getElementById('sub-transfer-wrapper');

    qrisWrapper.style.display = (mainMethod === 'QRIS') ? 'block' : 'none';
    transferWrapper.style.display = (mainMethod === 'Transfer') ? 'block' : 'none';
}

// ==========================================================================
// SISTEM FINALISASI TRANSAKSI & CHECKOUT GANDA
// ==========================================================================
let pendingTransactionData = null; // Menyimpan data sementara jika menunggu modal QRIS selesai

function processCheckout(outputType) {
    const customerName = document.getElementById('customer-name').value.trim();
    const customerEmail = document.getElementById('customer-email').value.trim();
    
    if (cart.length === 0) return alert('Keranjang belanja masih kosong!');
    if (!customerName) return alert('Nama Pelanggan Wajib diisi!');

    const financial = calculateCartTotal();
    const mainMethod = document.getElementById('main-payment-method').value;
    let detailMetode = mainMethod;

    if (mainMethod === 'QRIS') {
        detailMetode = `QRIS ${document.getElementById('sub-qris-vendor').value}`;
    } else if (mainMethod === 'Transfer') {
        detailMetode = `TF ${document.getElementById('sub-transfer-target').value}`;
    }

    // Jika compliment, paksa total jadi 0 rupiah
    let finalTotal = financial.total;
    let statusTransaksi = 'Success';
    if (outputType === 'Compliment') {
        finalTotal = 0;
        statusTransaksi = 'Compliment';
        detailMetode = 'Compliment Gratis';
    }

    // Formasi data struktural log transaksi
    const trx = {
        id: 'PC-' + Date.now(),
        timestamp: new Date().toISOString(),
        customerName: customerName,
        customerEmail: customerEmail,
        items: cart.map(i => i.name).join(', '),
        subtotal: financial.subtotal,
        diskon: financial.diskon,
        voucher: financial.voucher,
        total: finalTotal,
        paymentMethod: detailMetode,
        status: statusTransaksi
    };

    if (mainMethod === 'QRIS' && outputType !== 'Compliment') {
        // Tampilkan Pop Up QRIS sesuai blueprint sebelum menyimpan data
        pendingTransactionData = { trx, outputType };
        document.getElementById('qris-modal-title').textContent = `PEMBAYARAN via ${detailMetode.toUpperCase()}`;
        document.getElementById('qris-modal-overlay').style.display = 'flex';
    } else {
        executeSaveAndOutput(trx, outputType);
    }
}

function closeQrisModalAndFinalize() {
    document.getElementById('qris-modal-overlay').style.display = 'none';
    if (pendingTransactionData) {
        executeSaveAndOutput(pendingTransactionData.trx, pendingTransactionData.outputType);
        pendingTransactionData = null;
    }
}

function executeSaveAndOutput(transactionObj, outputType) {
    // Simpan ke database localstorage
    transactionDatabase.push(transactionObj);
    localStorage.setItem('pakchill_pos_db', JSON.stringify(transactionDatabase));

    // Eksekusi Output Struk Ganda Sesuai Blueprint
    if (outputType === 'Email' && transactionObj.customerEmail) {
        triggerMailtoReceipt(transactionObj);
    } else if (outputType === 'Print') {
        triggerThermalHardwarePrint(transactionObj);
    }

    alert('Transaksi Berhasil Diproses!');
    
    // Reset Form Input
    cart = [];
    document.getElementById('customer-name').value = '';
    document.getElementById('customer-email').value = '';
    document.getElementById('input-diskon').value = 0;
    document.getElementById('input-voucher').value = 0;
    document.getElementById('main-payment-method').value = 'Cash';
    handlePaymentBranching();
    renderCart();
}

// STRUK OPSI 1: KIRIM MELALUI EMAIL (AUTOMATION MAILTO)
function triggerMailtoReceipt(t) {
    const subject = encodeURIComponent(`Struk Belanja Digital Pakchill #${t.id}`);
    const body = encodeURIComponent(
        `Halo ${t.customerName},\n\n` +
        `Terima kasih telah membeli produk kesehatan Pakchill.\n` +
        `Berikut adalah detail nota transaksi digital Anda:\n\n` +
        `ID NOTA : ${t.id}\n` +
        `TANGGAL : ${new Date(t.timestamp).toLocaleString('id-ID')}\n` +
        `PRODUK  : ${t.items}\n` +
        `SUBTOTAL: Rp ${t.subtotal.toLocaleString('id-ID')}\n` +
        `DISKON  : Rp ${t.diskon.toLocaleString('id-ID')}\n` +
        `VOUCHER : Rp ${t.voucher.toLocaleString('id-ID')}\n` +
        `-----------------------------------------\n` +
        `TOTAL   : Rp ${t.total.toLocaleString('id-ID')}\n` +
        `METODE  : ${t.paymentMethod}\n\n` +
        `Salam Sehat, Pakchill Corp.`
    );
    window.location.href = `mailto:${t.customerEmail}?subject=${subject}&body=${body}`;
}

// STRUK OPSI 2: LANGSUNG CETAK LAYOUT MINI THERMAL PRINTER
function triggerThermalHardwarePrint(t) {
    const printArea = document.getElementById('thermal-receipt-area');
    printArea.innerHTML = `
        <div class="thermal-receipt">
            <div class="thermal-header">
                <h2>PAKCHILL POS</h2>
                <p>Premium Packchoy & Nanas</p>
                <p style="font-size:9px;">ID: ${t.id}</p>
            </div>
            <div class="thermal-divider"></div>
            <p>Waktu: ${new Date(t.timestamp).toLocaleString('id-ID')}</p>
            <p>Kasir: Active Staff</p>
            <p>Pelanggan: ${t.customerName}</p>
            <div class="thermal-divider"></div>
            <p style="font-weight:bold;">Items:</p>
            <p>${t.items}</p>
            <div class="thermal-divider"></div>
            <div class="thermal-row"><span>Subtotal:</span><span>Rp ${t.subtotal.toLocaleString('id-ID')}</span></div>
            <div class="thermal-row"><span>Diskon:</span><span>Rp ${t.diskon.toLocaleString('id-ID')}</span></div>
            <div class="thermal-row"><span>Voucher:</span><span>Rp ${t.voucher.toLocaleString('id-ID')}</span></div>
            <div class="thermal-divider"></div>
            <div class="thermal-total-row"><span>TOTAL:</span><span>Rp ${t.total.toLocaleString('id-ID')}</span></div>
            <div class="thermal-row" style="font-size:9px; margin-top:4px;"><span>Metode:</span><span>${t.paymentMethod}</span></div>
            <div class="thermal-divider"></div>
            <div class="thermal-footer">
                <p>Terima Kasih Atas Kunjungan Anda</p>
                <p>~ Stay Healthy Stay Chill ~</p>
            </div>
        </div>
    `;
    window.print();
}

// ==========================================================================
// MODUL MANAGEMENT OWNER & METRICS ANALISIS FINANSIAL
// ==========================================================================
function calculateOwnerMetrics() {
    const now = new Date();
    let omzetHari = 0, omzetMinggu = 0, omzetBulan = 0, omzetTahun = 0;

    // Persiapan array wadah untuk visualisasi Chart 12 bulan (Jan - Des)
    let monthlyFinData = Array(12).fill(0);

    transactionDatabase.forEach(t => {
        if (t.status === 'Void') return; // Mengabaikan data void sesuai blueprint

        const tDate = new Date(t.timestamp);
        const timeDiff = now - tDate;

        // Hitung filter Kalender Real-Time
        // 1. Hari ini (Tanggal, Bulan, Tahun sama)
        if (tDate.toDateString() === now.toDateString()) omzetHari += t.total;
        // 2. 7 Hari Terakhir
        if (timeDiff <= 7 * 24 * 60 * 60 * 1000) omzetMinggu += t.total;
        // 3. Bulan ini
        if (tDate.getMonth() === now.getMonth() && tDate.getFullYear() === now.getFullYear()) omzetBulan += t.total;
        // 4. Tahun Ini
        if (tDate.getFullYear() === now.getFullYear()) omzetTahun += t.total;

        // Distribusi grafik 1 tahun terakhir ke bulannya masing-masing
        if (tDate.getFullYear() === now.getFullYear()) {
            monthlyFinData[tDate.getMonth()] += t.total;
        }
    });

    // Pasang angka ke kartu rekapitulasi owner
    document.getElementById('txt-rekap-hari').textContent = `Rp ${omzetHari.toLocaleString('id-ID')}`;
    document.getElementById('txt-rekap-minggu').textContent = `Rp ${omzetMinggu.toLocaleString('id-ID')}`;
    document.getElementById('txt-rekap-bulan').textContent = `Rp ${omzetBulan.toLocaleString('id-ID')}`;
    document.getElementById('txt-rekap-tahun').textContent = `Rp ${omzetTahun.toLocaleString('id-ID')}`;

    renderChartJS(monthlyFinData);
}

// INTEGRASI CHART.JS BULANAN OWNER
function renderChartJS(chartDataPoints) {
    const ctx = document.getElementById('owner-monthly-chart').getContext('2d');
    
    if (monthlyChartInstance) {
        monthlyChartInstance.destroy(); // Hancurkan instance lama agar tidak bentrok rendering
    }

    monthlyChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agustus', 'Sep', 'Okt', 'Nov', 'Des'],
            datasets: [{
                label: 'Omzet Bersih Pakchill (Rp)',
                data: chartDataPoints,
                borderColor: '#2d5a27',
                backgroundColor: 'rgba(71, 130, 65, 0.1)',
                borderWidth: 3,
                tension: 0.3,
                fill: true,
                pointBackgroundColor: '#1e3f1b'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.03)' } },
                x: { grid: { display: false } }
            }
        }
    });
}

// LOG DATA RIWAYAT DENGAN PEMBATASAN AKSES KETAT (KASIR VS OWNER)
function renderHistoryTable() {
    const tbody = document.getElementById('history-table-body');
    tbody.innerHTML = '';

    const now = new Date();
    const filterMonth = document.getElementById('filter-month-owner').value;

    // Sorting kronologis: Transaksi terbaru ditaruh paling atas
    const sortedData = [...transactionDatabase].reverse();

    sortedData.forEach(t => {
        const tDate = new Date(t.timestamp);
        
        // ATURAN BLUEPRINT: PEMBATASAN HAK KASIR VS OWNER
        if (currentRole === 'kasir') {
            const hoursDiff = (now - tDate) / (1000 * 60 * 60);
            if (hoursDiff > 24) return; // Menyembunyikan riwayat berumur di atas 24 jam dari kasir
        } else if (currentRole === 'owner') {
            // Saringan Filter Dropdown Bulan Milik Owner (1 Tahun Terakhir)
            if (tDate.getFullYear() !== now.getFullYear()) return; // Batasi 1 tahun kalender berjalan
            if (filterMonth !== 'all' && tDate.getMonth().toString() !== filterMonth) return;
        }

        const isVoid = t.status === 'Void';
        const row = document.createElement('tr');
        
        if (isVoid) row.className = 'row-void'; // Modifikasi baris pudar & tercoret jika status VOID

        let badgeClass = 'success';
        if (t.status === 'Void') badgeClass = 'void';
        if (t.status === 'Compliment') badgeClass = 'compliment';

        // Validasi tombol Void agar hanya aktif untuk Owner saja
        const disableVoidBtn = (currentRole !== 'owner' || isVoid) ? 'disabled' : '';

        row.innerHTML = `
            <td><b>${t.id}</b></td>
            <td>${tDate.toLocaleString('id-ID')}</td>
            <td>${t.customerName}</td>
            <td><span style="font-size:11px; color:#555;">${t.items}</span></td>
            <td><small>${t.paymentMethod}</small></td>
            <td><b>Rp ${t.total.toLocaleString('id-ID')}</b></td>
            <td><span class="status-badge ${badgeClass}">${t.status}</span></td>
            <td>
                <button class="btn-void-action" ${disableVoidBtn} onclick="triggerVoidTransaction('${t.id}')">Void</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// SISTEM OTORITAS VOID DATA PENJUALAN
function triggerVoidTransaction(trxId) {
    if (confirm(`Apakah Anda yakin selaku Owner ingin mem-VOID Nota ${trxId}? Tindakan ini tidak bisa dibatalkan.`)) {
        const index = transactionDatabase.findIndex(t => t.id === trxId);
        if (index !== -1) {
            transactionDatabase[index].status = 'Void';
            transactionDatabase[index].total = 0; // Ubah nilai nominal ke 0 rupiah sesuai blueprint
            localStorage.setItem('pakchill_pos_db', JSON.stringify(transactionDatabase));
            
            // Rekalkulasi total dashboard dan render ulang visual table secara real-time
            calculateOwnerMetrics();
            renderHistoryTable();
        }
    }
}

// MODUL TAMBAH MENU BARU SECARA REAL-TIME
function handleAddNewProduct() {
    const nameInput = document.getElementById('new-product-name').value.trim().toUpperCase();
    const priceInput = parseInt(document.getElementById('new-product-price').value);

    if (!nameInput || isNaN(priceInput) || priceInput <= 0) {
        return alert('Harap isi Nama Menu dan Harga Jual Jelas & Valid!');
    }

    const itemBaru = {
        id: 'p-' + Date.now(),
        name: nameInput,
        price: priceInput
    };

    menuDatabase.push(itemBaru);
    localStorage.setItem('pakchill_menu_db', JSON.stringify(menuDatabase));
    
    alert(`Menu "${nameInput}" sukses dimasukkan ke katalog kasir!`);
    
    document.getElementById('new-product-name').value = '';
    document.getElementById('new-product-price').value = '';
    
    renderKatalog(); // Update katalog seketika
}

// ==========================================================================
// DOKUMEN OUTPUT UTK OWNER (PDF & EXCEL SPREADSHEET)
// ==========================================================================

// OUTPUT AKHIR 1: CETAK LAPORAN BERBENTUK PDF (HTML2PDF PUSTAKA)
function exportOwnerReportPDF() {
    const activeHistoryTable = document.getElementById('history-table-body');
    if (activeHistoryTable.children.length === 0) return alert('Tidak ada data transaksi untuk dicetak pada bulan ini!');

    // Kloning container log data visual untuk dicetak rapi secara terisolasi
    const element = document.createElement('div');
    element.style.padding = '20px';
    element.style.color = '#000000';
    element.innerHTML = `
        <h1 style="text-align:center; color:#2d5a27;">LAPORAN PENJUALAN RESMI PAKCHILL</h1>
        <p style="text-align:center;">Arsip Cetak Dokumen Finansial Owner • Tanggal: ${new Date().toLocaleString('id-ID')}</p>
        <hr style="border: 1px dashed #000; margin: 20px 0;">
        <table border="1" cellpadding="8" style="width:100%; border-collapse:collapse; font-size:12px;">
            <thead>
                <tr style="background-color:#f2f2f7;">
                    <th>ID Nota</th><th>Waktu</th><th>Pelanggan</th><th>Items</th><th>Metode</th><th>Total Bersih</th><th>Status</th>
                </tr>
            </thead>
            <tbody>
                ${Array.from(activeHistoryTable.rows).map(row => `
                    <tr style="${row.classList.contains('row-void') ? 'background-color:#ffe5e5; text-decoration:line-through;' : ''}">
                        <td>${row.cells[0].innerText}</td>
                        <td>${row.cells[1].innerText}</td>
                        <td>${row.cells[2].innerText}</td>
                        <td>${row.cells[3].innerText}</td>
                        <td>${row.cells[4].innerText}</td>
                        <td>${row.cells[5].innerText}</td>
                        <td>${row.cells[6].innerText}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;

    const opt = {
        margin:       10,
        filename:     `Laporan_Owner_Pakchill_${Date.now()}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2 },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'landscape' }
    };

    html2pdf().set(opt).from(element).save();
}

// OUTPUT AKHIR 2: EXPORT TRANSAKSI LANGSUNG JADI EXCEL (SHEETJS PUSTAKA)
function exportOwnerReportExcel() {
    if (transactionDatabase.length === 0) return alert('Database transaksi kosong, tidak ada data untuk diexport!');

    // Transformasi data mentah ke baris kolom spreadsheet bersih
    const excelRows = transactionDatabase.map(t => ({
        'ID Nota': t.id,
        'Waktu Transaksi': new Date(t.timestamp).toLocaleString('id-ID'),
        'Nama Pelanggan': t.customerName,
        'Email Pelanggan': t.customerEmail || '-',
        'Daftar Produk Pesanan': t.items,
        'Subtotal Gross': t.subtotal,
        'Potongan Diskon': t.diskon,
        'Potongan Voucher': t.voucher,
        'Net Total Omzet': t.total,
        'Metode Pembayaran': t.paymentMethod,
        'Status Nota': t.status
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Log POS Transaksi");

    // Unduh berkas berekstensi .xlsx secara instan
    XLSX.writeFile(workbook, `Rekap_TutupBuku_Pakchill_${Date.now()}.xlsx`);
}
