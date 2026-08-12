// ============================================================
//  SENTER - MIDTRANS BACKEND
//  Server untuk membuat Snap Token dan handle notifikasi
// ============================================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const midtransClient = require('midtrans-client');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================
//  MIDDLEWARE
// ============================================================

app.use(cors({
    origin: '*', // Bisa diatur lebih spesifik untuk production
    methods: ['GET', 'POST', 'OPTIONS']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============================================================
//  MIDTRANS CONFIG
// ============================================================

// Buat instance Snap API
const snap = new midtransClient.Snap({
    isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
    serverKey: process.env.MIDTRANS_SERVER_KEY,
    clientKey: process.env.MIDTRANS_CLIENT_KEY
});

// ============================================================
//  ROUTE: CREATE TRANSACTION (Buat Snap Token)
// ============================================================

app.post('/api/create-transaction', async (req, res) => {
    try {
        const { orderId, grossAmount, customerName, customerEmail, customerPhone } = req.body;

        // Validasi input
        if (!orderId || !grossAmount) {
            return res.status(400).json({
                error: 'orderId dan grossAmount wajib diisi'
            });
        }

        // Parameter transaksi Midtrans
        const parameter = {
            transaction_details: {
                order_id: orderId,
                gross_amount: grossAmount
            },
            customer_details: {
                first_name: customerName || 'Pelanggan',
                email: customerEmail || 'customer@example.com',
                phone: customerPhone || '08123456789'
            },
            // Hanya aktifkan GoPay dan DANA
            enabled_payments: [
                'gopay',
                'dana'
            ],
            // Bahasa Indonesia
            language: 'id',
            // Custom field untuk identifikasi dari SENTER
            custom_field1: 'senter-app',
            custom_field2: 'flashlight-control',
            // Expiry 1 hari
            expiry: {
                duration: 1,
                unit: 'day'
            }
        };

        // Buat Snap Token
        const transaction = await snap.createTransaction(parameter);
        
        // Kembalikan token ke frontend
        res.json({
            success: true,
            token: transaction.token,
            redirect_url: transaction.redirect_url,
            order_id: orderId
        });

        console.log(`✅ Transaksi dibuat: ${orderId} - Rp ${grossAmount}`);

    } catch (error) {
        console.error('❌ Error creating transaction:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Gagal membuat transaksi'
        });
    }
});

// ============================================================
//  ROUTE: HANDLE NOTIFICATION (Webhook dari Midtrans)
//  INI YANG PALING PENTING!
//  Jangan pernah andalkan frontend callback saja!
// ============================================================

app.post('/api/notification', async (req, res) => {
    try {
        const notification = req.body;
        console.log('📨 Webhook notification received:', notification);

        // Ambil status transaksi
        const statusResponse = await snap.transaction.notification(notification);
        
        const orderId = statusResponse.order_id;
        const transactionStatus = statusResponse.transaction_status;
        const fraudStatus = statusResponse.fraud_status;

        console.log(`📊 Transaction ID: ${orderId}`);
        console.log(`📊 Status: ${transactionStatus}`);
        console.log(`📊 Fraud Status: ${fraudStatus}`);

        // ============================================================
        //  LOGIKA UPDATE STATUS DI DATABASE
        //  Ini adalah tempat yang AMAN untuk update database!
        //  Jangan update database dari frontend saja!
        // ============================================================

        // Contoh: jika transaksi sukses
        if (transactionStatus === 'capture') {
            // capture = success untuk credit card
            if (fraudStatus === 'accept') {
                console.log(`✅ Pembayaran SUCCESS untuk order: ${orderId}`);
                // 🔦 Di sini kamu bisa update database: status = PAID
                // Dan frontend akan tau bahwa flashlight boleh mati
            }
        } else if (transactionStatus === 'settlement') {
            // settlement = success untuk non-credit card
            console.log(`✅ Pembayaran SUCCESS untuk order: ${orderId}`);
            // 🔦 Di sini kamu bisa update database: status = PAID
        } else if (transactionStatus === 'pending') {
            console.log(`⏳ Pembayaran pending untuk order: ${orderId}`);
        } else if (transactionStatus === 'deny') {
            console.log(`❌ Pembayaran ditolak untuk order: ${orderId}`);
        } else if (transactionStatus === 'cancel') {
            console.log(`❌ Pembayaran dibatalkan untuk order: ${orderId}`);
        } else if (transactionStatus === 'expire') {
            console.log(`⏰ Pembayaran expired untuk order: ${orderId}`);
        }

        // Beri respon OK ke Midtrans
        res.status(200).json({ status: 'OK' });

    } catch (error) {
        console.error('❌ Error handling notification:', error);
        res.status(500).json({
            error: error.message || 'Gagal handle notifikasi'
        });
    }
});

// ============================================================
//  ROUTE: CEK STATUS TRANSAKSI (Optional)
// ============================================================

app.post('/api/check-status', async (req, res) => {
    try {
        const { orderId } = req.body;
        
        if (!orderId) {
            return res.status(400).json({
                error: 'orderId wajib diisi'
            });
        }

        // Ambil status dari Midtrans
        const status = await snap.transaction.status(orderId);
        
        res.json({
            success: true,
            status: status
        });

    } catch (error) {
        console.error('❌ Error checking status:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Gagal cek status'
        });
    }
});

// ============================================================
//  ROUTE: TEST (Cek koneksi)
// ============================================================

app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        message: 'SENTER Backend is running!',
        environment: process.env.MIDTRANS_IS_PRODUCTION === 'true' ? 'Production' : 'Sandbox'
    });
});

// ============================================================
//  START SERVER
// ============================================================

app.listen(PORT, () => {
    console.log(`========================================`);
    console.log(`🔦 SENTER - Midtrans Backend`);
    console.log(`🚀 Running on http://localhost:${PORT}`);
    console.log(`📡 Environment: ${process.env.MIDTRANS_IS_PRODUCTION === 'true' ? 'Production' : 'Sandbox'}`);
    console.log(`========================================`);
});