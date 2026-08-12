// ============================================================
//  SENTER - FRONTEND dengan Midtrans
//  Integrasi pembayaran GoPay & DANA
// ============================================================

// ============================================================
//  KONFIGURASI
// ============================================================

const BACKEND_URL = 'http://localhost:3000'; // Ganti dengan URL backend kamu

// ============================================================
//  ELEMEN DOM
// ============================================================

const statusText = document.getElementById('statusText');
const statusIndicator = document.getElementById('statusIndicator');
const btnOn = document.getElementById('btnOn');
const btnOff = document.getElementById('btnOff');
const footerText = document.getElementById('footerText');
const body = document.body;

// Payment elements
const paymentOverlay = document.getElementById('paymentOverlay');
const payBtn = document.getElementById('payBtn');
const cancelBtn = document.getElementById('cancelBtn');
const selectedMethodEl = document.getElementById('selectedMethod');
const methodElements = document.querySelectorAll('.payment-method');

// Loading
const loadingOverlay = document.getElementById('loadingOverlay');
const loadingText = document.getElementById('loadingText');

// ============================================================
//  VARIABEL STATE
// ============================================================

let isFlashOn = false;
let track = null;
let imageCapture = null;
let isSupported = false;
let selectedMethod = null;
let selectedMethodName = '';
let isPaymentOpen = false;
let snapToken = null;
let currentOrderId = null;
let isProcessing = false;

// ============================================================
//  CEK DUKUNGAN BROWSER (Flashlight)
// ============================================================

function checkSupport() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        return false;
    }
    if (!('ImageCapture' in window)) {
        return false;
    }
    return true;
}

// ============================================================
//  INISIALISASI KAMERA
// ============================================================

async function initCamera() {
    try {
        const constraints = {
            video: {
                facingMode: { exact: 'environment' },
                width: { ideal: 320 },
                height: { ideal: 240 }
            }
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        track = stream.getVideoTracks()[0];

        if (!track) {
            throw new Error('Tidak ada track video');
        }

        imageCapture = new ImageCapture(track);
        const capabilities = track.getCapabilities();

        if (!capabilities || !capabilities.torch) {
            throw new Error('Flashlight tidak didukung');
        }

        isSupported = true;
        footerText.textContent = '✅ Flashlight siap digunakan';
        footerText.className = 'footer-text success';
        btnOn.disabled = false;
        btnOff.disabled = false;

        console.log('✅ Flashlight ready!');
        return true;

    } catch (error) {
        console.error('Error init camera:', error);

        try {
            const constraints2 = {
                video: {
                    facingMode: 'environment',
                    width: { ideal: 320 },
                    height: { ideal: 240 }
                }
            };

            const stream2 = await navigator.mediaDevices.getUserMedia(constraints2);
            track = stream2.getVideoTracks()[0];

            if (!track) {
                throw new Error('Tidak ada track video');
            }

            imageCapture = new ImageCapture(track);
            const capabilities = track.getCapabilities();

            if (!capabilities || !capabilities.torch) {
                throw new Error('Flashlight tidak didukung');
            }

            isSupported = true;
            footerText.textContent = '✅ Flashlight siap digunakan';
            footerText.className = 'footer-text success';
            btnOn.disabled = false;
            btnOff.disabled = false;

            console.log('✅ Flashlight ready (alternate mode)!');
            return true;

        } catch (error2) {
            console.error('Error init camera (alternate):', error2);
            showError('❌ Flashlight tidak tersedia.');
            return false;
        }
    }
}

// ============================================================
//  FUNGSI FLASHLIGHT
// ============================================================

async function turnFlashOn() {
    if (!isSupported || !imageCapture || !track) {
        showError('Flashlight belum siap.');
        return;
    }

    try {
        await track.applyConstraints({
            advanced: [{ torch: true }]
        });

        isFlashOn = true;
        updateUI(true);
        footerText.textContent = '🔦 Flashlight menyala!';
        footerText.className = 'footer-text';

        console.log('🔥 Flash ON');

    } catch (error) {
        console.error('Error turning ON:', error);
        try {
            await imageCapture.setOptions({ torched: true });
            isFlashOn = true;
            updateUI(true);
            footerText.textContent = '🔦 Flashlight menyala!';
            footerText.className = 'footer-text';
            console.log('🔥 Flash ON (alternate)');
        } catch (e2) {
            console.error('Alternate failed:', e2);
            showError('❌ Gagal menyalakan flashlight');
        }
    }
}

async function turnFlashOff() {
    if (!isSupported || !track) {
        showError('Flashlight belum siap.');
        return;
    }

    try {
        await track.applyConstraints({
            advanced: [{ torch: false }]
        });

        isFlashOn = false;
        updateUI(false);
        footerText.textContent = '⚪ Flashlight mati';
        footerText.className = 'footer-text';

        console.log('💡 Flash OFF');

    } catch (error) {
        console.error('Error turning OFF:', error);
        try {
            if (imageCapture) {
                await imageCapture.setOptions({ torched: false });
            }
            isFlashOn = false;
            updateUI(false);
            footerText.textContent = '⚪ Flashlight mati';
            footerText.className = 'footer-text';
            console.log('💡 Flash OFF (alternate)');
        } catch (e2) {
            console.error('Alternate failed:', e2);
            showError('❌ Gagal mematikan flashlight');
        }
    }
}

// ============================================================
//  UPDATE UI
// ============================================================

function updateUI(state) {
    isFlashOn = state;

    statusText.textContent = state ? 'ON' : 'OFF';
    statusText.className = 'status-text' + (state ? ' on' : '');

    statusIndicator.className = 'status-indicator' + (state ? ' on' : '');

    body.className = state ? 'flash-on' : '';

    btnOn.className = 'btn btn-on' + (state ? ' active' : '');
    btnOff.className = 'btn btn-off' + (!state ? ' active' : '');
}

// ============================================================
//  SHOW/HIDE PAYMENT
// ============================================================

function showPayment() {
    selectedMethod = null;
    selectedMethodName = '';
    methodElements.forEach(el => el.classList.remove('active'));
    selectedMethodEl.innerHTML = '<span>⚠️ Pilih metode pembayaran</span>';
    payBtn.disabled = true;
    payBtn.textContent = '🔒 Pilih Metode Pembayaran Dulu';

    paymentOverlay.classList.add('show');
    isPaymentOpen = true;
    document.body.style.overflow = 'hidden';
}

function hidePayment() {
    paymentOverlay.classList.remove('show');
    isPaymentOpen = false;
    document.body.style.overflow = '';
}

// ============================================================
//  SHOW/HIDE LOADING
// ============================================================

function showLoading(text = 'Memproses...') {
    loadingText.textContent = text;
    loadingOverlay.classList.add('show');
}

function hideLoading() {
    loadingOverlay.classList.remove('show');
}

// ============================================================
//  HANDLE OFF BUTTON
// ============================================================

function handleOffClick() {
    if (isFlashOn) {
        showPayment();
        if (navigator.vibrate) navigator.vibrate(50);
    } else {
        turnFlashOff();
    }
}

// ============================================================
//  SHOW ERROR
// ============================================================

function showError(msg) {
    footerText.textContent = msg;
    footerText.className = 'footer-text error';
    btnOn.disabled = true;
    btnOff.disabled = true;
    console.error('❌', msg);
}

// ============================================================
//  MIDTRANS INTEGRATION
// ============================================================

// Generate Order ID
function generateOrderId() {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    return `SENTER-${timestamp}-${random}`;
}

// Buat transaksi di backend
async function createTransaction(method) {
    try {
        showLoading('Menyiapkan pembayaran...');

        const orderId = generateOrderId();
        const grossAmount = 1000000; // Rp 1.000.000

        const response = await fetch(`${BACKEND_URL}/api/create-transaction`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                orderId: orderId,
                grossAmount: grossAmount,
                customerName: 'Pelanggan SENTER',
                customerEmail: 'customer@example.com',
                customerPhone: '08123456789'
            })
        });

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || 'Gagal membuat transaksi');
        }

        snapToken = data.token;
        currentOrderId = data.order_id;

        console.log('✅ Snap Token created:', snapToken);
        console.log('✅ Order ID:', currentOrderId);

        hideLoading();
        return snapToken;

    } catch (error) {
        console.error('❌ Error creating transaction:', error);
        hideLoading();
        footerText.textContent = '❌ Gagal membuat transaksi: ' + error.message;
        footerText.className = 'footer-text error';
        return null;
    }
}

// Buka Snap Payment
function openSnapPayment(token) {
    try {
        // Gunakan Snap Embed
        window.snap.embed(token, {
            embedId: 'snap-container', // Container untuk Snap
            onSuccess: function(result) {
                console.log('✅ Payment Success:', result);
                // Flashlight MATI setelah pembayaran sukses!
                turnFlashOff();
                footerText.textContent = '✅ Pembayaran berhasil! Flashlight dimatikan.';
                footerText.className = 'footer-text success';
                hidePayment();
                // Bisa juga tampilkan notifikasi sukses
                alert('✅ Pembayaran berhasil! Flashlight telah dimatikan.');
            },
            onPending: function(result) {
                console.log('⏳ Payment Pending:', result);
                footerText.textContent = '⏳ Menunggu pembayaran...';
                footerText.className = 'footer-text';
            },
            onError: function(result) {
                console.log('❌ Payment Error:', result);
                footerText.textContent = '❌ Pembayaran gagal: ' + (result.status_message || '');
                footerText.className = 'footer-text error';
                alert('❌ Pembayaran gagal! Silakan coba lagi.');
            },
            onClose: function() {
                console.log('🔒 Snap closed by user');
                // Jika user menutup Snap tanpa membayar, flashlight tetap menyala
                // Tapi kita cek status transaksi dulu
                checkTransactionStatus(currentOrderId);
            }
        });

        // Tutup payment overlay setelah Snap terbuka
        hidePayment();

    } catch (error) {
        console.error('❌ Error opening Snap:', error);
        hideLoading();
        footerText.textContent = '❌ Gagal membuka pembayaran: ' + error.message;
        footerText.className = 'footer-text error';
    }
}

// Cek status transaksi (jika user menutup Snap tanpa bayar)
async function checkTransactionStatus(orderId) {
    try {
        const response = await fetch(`${BACKEND_URL}/api/check-status`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ orderId: orderId })
        });

        const data = await response.json();

        if (data.success && data.status) {
            const status = data.status.transaction_status;
            if (status === 'settlement' || status === 'capture') {
                // Flashlight mati!
                turnFlashOff();
                footerText.textContent = '✅ Pembayaran berhasil! Flashlight dimatikan.';
                footerText.className = 'footer-text success';
            } else if (status === 'pending') {
                footerText.textContent = '⏳ Pembayaran masih pending...';
                footerText.className = 'footer-text';
            }
        }
    } catch (error) {
        console.error('Error checking status:', error);
    }
}

// ============================================================
//  EVENT: PILIH METODE PEMBAYARAN
// ============================================================

methodElements.forEach(el => {
    el.addEventListener('click', function() {
        methodElements.forEach(m => m.classList.remove('active'));
        this.classList.add('active');

        selectedMethod = this.dataset.method;
        selectedMethodName = this.dataset.method === 'gopay' ? 'GoPay' : 'DANA';

        const icon = selectedMethod === 'gopay' ? '🟢' : '🔵';
        selectedMethodEl.innerHTML = `<span class="active">✅ ${icon} ${selectedMethodName}</span>`;

        payBtn.disabled = false;
        payBtn.textContent = `💳 Bayar Rp 1.000.000 dengan ${selectedMethodName}`;

        if (navigator.vibrate) navigator.vibrate(10);
    });
});

// ============================================================
//  EVENT: BAYAR
// ============================================================

payBtn.addEventListener('click', async function() {
    if (!selectedMethod || isProcessing) return;

    isProcessing = true;
    payBtn.disabled = true;
    payBtn.textContent = '⏳ Memproses...';

    // Tutup payment overlay
    hidePayment();

    // Buat transaksi di backend
    const token = await createTransaction(selectedMethod);

    if (token) {
        // Buka Snap Payment
        openSnapPayment(token);
    }

    isProcessing = false;
    payBtn.disabled = false;
});

// ============================================================
//  EVENT: BATAL
// ============================================================

cancelBtn.addEventListener('click', function() {
    hidePayment();
});

// ============================================================
//  EVENT: TOMBOL ON
// ============================================================

btnOn.addEventListener('click', function(e) {
    e.preventDefault();
    if (!btnOn.disabled) {
        turnFlashOn();
        if (navigator.vibrate) navigator.vibrate(10);
    }
});

// ============================================================
//  EVENT: TOMBOL OFF
// ============================================================

btnOff.addEventListener('click', function(e) {
    e.preventDefault();
    if (!btnOff.disabled) {
        handleOffClick();
    }
});

// ============================================================
//  EVENT: KEYBOARD
// ============================================================

document.addEventListener('keydown', function(e) {
    if (e.key === '1') {
        if (!btnOn.disabled) turnFlashOn();
        e.preventDefault();
    } else if (e.key === '2') {
        if (!btnOff.disabled) handleOffClick();
        e.preventDefault();
    }
    if (e.key === 'Escape') {
        if (isPaymentOpen) hidePayment();
    }
});

// ============================================================
//  INITIALISASI
// ============================================================

if (!checkSupport()) {
    showError('❌ Browser tidak mendukung flashlight.\nGunakan Chrome di Android.');
    btnOn.disabled = true;
    btnOff.disabled = true;
} else {
    initCamera();
}

window.addEventListener('beforeunload', function() {
    if (isFlashOn) turnFlashOff();
});

window.addEventListener('pagehide', function() {
    if (isFlashOn) {
        try {
            if (track) track.applyConstraints({ advanced: [{ torch: false }] });
        } catch (e) {}
    }
});

console.log('========================================');
console.log('🔦 SENTER - Midtrans Integration');
console.log('💰 OFF = Bayar Rp 1.000.000 via Midtrans');
console.log('🟢 GoPay | 🔵 DANA');
console.log('========================================');