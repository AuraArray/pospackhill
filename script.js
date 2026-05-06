// --- DATABASE & STATE ---
let cart = [];
let salesData = JSON.parse(localStorage.getItem('pakchill_db')) || [];
let currentUser = null;

// --- DOM ELEMENTS ---
const loginScreen = document.getElementById('login-screen');
const mainApp = document.getElementById('main-app');
const pageKasir = document.getElementById('page-kasir');
const pageOwner = document.getElementById('page-owner');
const cartList = document.getElementById('cart-list');

// --- 1. SISTEM LOGIN & NAVIGASI ---
document.getElementById('btn-login').addEventListener('click', () => {
    const pass = document.getElementById('login-password').value;
    if (pass === '000') {
        currentUser = 'owner';
        showApp();
        document.getElementById('nav-to-owner').style.display = 'inline-block';
    } else if (pass === '123') {
        currentUser = 'kasir';
        showApp();
        document.getElementById('nav-to-owner').style.display = 'none';
    } else {
        alert("Password Salah!");
    }
});

function showApp() {
    loginScreen.style.display = 'none';
    mainApp.style.display = 'block';
    renderKasir();
}

document.getElementById('btn-logout').addEventListener('click', () => location.reload());
document.getElementById('nav-to-kasir').addEventListener('click', renderKasir);
document.getElementById('nav-to-owner').addEventListener('click', renderOwner);

function renderKasir() {
    pageKasir.style.display = 'grid';
    pageOwner.style.display = 'none';
}

function renderOwner() {
    pageKasir.style.display = 'none';
    pageOwner.style.display = 'block';
    updateOwnerStats();
}

// --- 2. LOGIKA KASIR (TRANSAKSI) ---
document.getElementById('add-pachoy').onclick = () => addToCart('PACHOY', 15000);
document.getElementById('add-nanas').onclick = () => addToCart('NANAS', 12000);

function addToCart(name, price) {
    cart.push({ name, price });
    updateCartUI();
}

function updateCartUI() {
    cartList.innerHTML = cart.map((item, index) => `
        <li>
            <span>${item.name}</span>
            <span>Rp ${item.price.toLocaleString()}</span>
        </li>
    `).join('');
    calculateTotal();
}

function calculateTotal() {
    let subtotal = cart.reduce((sum, item) => sum + item.price, 0);
    let discount = parseInt(document.getElementById('input-discount').value) || 0;
    let total = subtotal - discount;
    if (total < 0) total = 0;

    document.getElementById('display-subtotal').innerText = subtotal.toLocaleString();
    document.getElementById('display-total').innerText = total.toLocaleString();
}

// Pantau input diskon secara real-time
document.getElementById('input-discount').oninput = calculateTotal;

// --- 3. PROSES BAYAR & VOID ---
document.getElementById('btn-pay').onclick = () => processTransaction('Sukses');
document.getElementById('btn-compliment').onclick = () => processTransaction('Compliment');

function processTransaction(status) {
    const name = document.getElementById('customer-name').value;
    const email = document.getElementById('customer-email').value;
    const method = document.getElementById('payment-method').value;
    const subtotal = cart.reduce((sum, item) => sum + item.price, 0);
    const discount = parseInt(document.getElementById('input-discount').value) || 0;
    const finalTotal = status === 'Compliment' ? 0 : (subtotal - discount);

    if (cart.length === 0 || !name) {
        alert("Pilih menu dan isi nama pelanggan!");
        return;
    }

    const receipt = {
        id: Date.now(),
        waktu: new Date().toLocaleString('id-ID'),
        pelanggan: name,
        email: email,
        item: cart.map(i => i.name).join(", "),
        total: finalTotal,
        metode: method,
        status: status
    };

    salesData.push(receipt);
    localStorage.setItem('pakchill_db', JSON.stringify(salesData));

    // Kirim Struk via Email
    if (email) {
        const subject = `Struk Digital Pakchill - ${name}`;
        const body = `Halo ${name}, terima kasih!%0D%0AOrder: ${receipt.item}%0D%0ATotal: Rp ${receipt.total.toLocaleString()}%0D%0AMetode: ${method}`;
        window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
    }

    alert("Transaksi Berhasil!");
    resetKasir();
}

function resetKasir() {
    cart = [];
    document.getElementById('customer-name').value = '';
    document.getElementById('customer-email').value = '';
    document.getElementById('input-discount').value = '0';
    updateCartUI();
}

// --- 4. LOGIKA OWNER (REKAP & BACKUP) ---
function updateOwnerStats() {
    const historyTable = document.getElementById('history-table-body');
    const today = new Date().toLocaleDateString('id-ID');
    
    // Hitung Omzet (Hanya yang statusnya bukan Void)
    const totalRevenue = salesData.reduce((sum, s) => s.status !== 'Void' ? sum + s.total : sum, 0);
    document.getElementById('total-revenue').innerText = "Rp " + totalRevenue.toLocaleString();
    document.getElementById('transaction-count').innerText = salesData.length;

    // Render Tabel
    historyTable.innerHTML = salesData.slice().reverse().map(s => `
        <tr class="${s.status === 'Void' ? 'void-row' : ''}">
            <td>${s.waktu}</td>
            <td>${s.pelanggan}</td>
            <td>Rp ${s.total.toLocaleString()}</td>
            <td>${s.status}</td>
            <td>
                ${s.status !== 'Void' ? `<button onclick="voidOrder(${s.id})">VOID</button>` : '-'}
            </td>
        </tr>
    `).join('');

    renderChart();
}

window.voidOrder = function(id) {
    if(confirm("Batalkan transaksi ini?")) {
        salesData = salesData.map(s => s.id === id ? {...s, status: 'Void', total: 0} : s);
        localStorage.setItem('pakchill_db', JSON.stringify(salesData));
        updateOwnerStats();
    }
};

// --- 5. DOWNLOAD DATA CSV (24 JAM) ---
document.getElementById('btn-download-backup').onclick = () => {
    let csv = "ID,Waktu,Pelanggan,Item,Total,Metode,Status\n";
    salesData.forEach(s => {
        csv += `${s.id},${s.waktu},${s.pelanggan},${s.item},${s.total},${s.metode},${s.status}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Laporan_Pakchill_${new Date().toLocaleDateString()}.csv`;
    a.click();
};

// --- 6. GRAFIK (CHART.JS) ---
let myChart;
function renderChart() {
    const ctx = document.getElementById('sales-chart').getContext('2d');
    if (myChart) myChart.destroy();

    const last5 = salesData.filter(s => s.status !== 'Void').slice(-5);
    
    myChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: last5.map(s => s.pelanggan),
            datasets: [{
                label: 'Nilai Transaksi Terakhir',
                data: last5.map(s => s.total),
                backgroundColor: '#2D5A27'
            }]
        }
    });
}
