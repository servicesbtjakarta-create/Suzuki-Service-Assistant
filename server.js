const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// File paths for local persistence
const DB_PATH = path.join(__dirname, 'database.json');
const SETTINGS_PATH = path.join(__dirname, 'settings.json');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Ensure JSON database files exist
function initDb() {
    if (!fs.existsSync(DB_PATH)) {
        fs.writeFileSync(DB_PATH, JSON.stringify([], null, 2), 'utf8');
    }
    if (!fs.existsSync(SETTINGS_PATH)) {
        const defaultSettings = { 
            webhookUrl: 'https://perusahaananda.com',
            adminUsername: 'admin',
            adminPassword: 'suzuki123'
        };
        fs.writeFileSync(SETTINGS_PATH, JSON.stringify(defaultSettings, null, 2), 'utf8');
    } else {
        const settings = readJsonFile(SETTINGS_PATH);
        if (!settings.adminUsername || !settings.adminPassword) {
            settings.adminUsername = settings.adminUsername || 'admin';
            settings.adminPassword = settings.adminPassword || 'suzuki123';
            writeJsonFile(SETTINGS_PATH, settings);
        }
    }
}

initDb();

// Helper functions for file I/O
function readJsonFile(filePath) {
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error(`Error reading file ${filePath}:`, err);
        return filePath === DB_PATH ? [] : {};
    }
}

function writeJsonFile(filePath, data) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (err) {
        console.error(`Error writing file ${filePath}:`, err);
        return false;
    }
}

// --- API ENDPOINTS ---

// 1. Get Settings (N8N Webhook URL)
app.get('/api/settings', (req, res) => {
    const settings = readJsonFile(SETTINGS_PATH);
    res.json(settings);
});

// 2. Save Settings (N8N Webhook URL & Admin Credentials)
app.post('/api/settings', (req, res) => {
    const { webhookUrl, adminUsername, adminPassword } = req.body;
    if (!webhookUrl) {
        return res.status(400).json({ error: 'Webhook URL wajib diisi' });
    }
    
    const settings = readJsonFile(SETTINGS_PATH);
    settings.webhookUrl = webhookUrl.trim();
    if (adminUsername) settings.adminUsername = adminUsername.trim();
    if (adminPassword) settings.adminPassword = adminPassword.trim();
    
    const success = writeJsonFile(SETTINGS_PATH, settings);
    
    if (success) {
        res.json({ message: 'Settings saved successfully', settings });
    } else {
        res.status(500).json({ error: 'Failed to write settings to disk' });
    }
});

// 2b. Admin Authentication Login
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    const settings = readJsonFile(SETTINGS_PATH);
    
    if (username === settings.adminUsername && password === settings.adminPassword) {
        res.json({ success: true, token: 'sro_session_' + Math.random().toString(36).substring(2) });
    } else {
        res.status(401).json({ success: false, error: 'Username atau password salah!' });
    }
});

// 3. Get Service Checks History Logs
app.get('/api/service-checks', (req, res) => {
    const checks = readJsonFile(DB_PATH);
    // Return sorted from newest to oldest
    const sorted = [...checks].reverse();
    res.json(sorted);
});

// 3b. Export History Logs as CSV
app.get('/api/service-checks/csv', (req, res) => {
    // 1. Ubah const menjadi let agar datanya bisa difilter
    let checks = readJsonFile(DB_PATH);
    
    // 2. TAMBAHKAN LOGIKA FILTER RENTANG TANGGAL DI SINI
    const { startDate, endDate } = req.query;
    if (startDate || endDate) {
        checks = checks.filter(r => {
            const recordDate = new Date(r.createdAt);
            
            // Cek jika tanggal record kurang dari startDate
            if (startDate) {
                const start = new Date(startDate + 'T00:00:00');
                if (recordDate < start) return false;
            }
            
            // Cek jika tanggal record lebih dari endDate
            if (endDate) {
                const end = new Date(endDate + 'T23:59:59');
                if (recordDate > end) return false;
            }
            
            return true;
        });
    }
    
    // Define CSV columns
    const headers = [
        'ID',
        'Tanggal & Waktu',
        'Nama Pelanggan',
        'Nomor Polisi',
        'Nomor WhatsApp',
        'Tipe Mobil',
        'Transmisi',
        'Kupon Free Service?',
        'Odometer Saat Ini',
        'Usia Mobil (Bulan)',
        'Kondisi Rute',
        'Target Servis KM',
        'Target Servis Bulan',
        'Status Biaya',
        'Rekomendasi Perawatan',
        'Rekomendasi SRO'
    ];

    // Helper to escape double quotes and wrap in quotes if necessary
    const formatCsvCell = (val) => {
        if (val === undefined || val === null) return '';
        let cellStr = val.toString().replace(/<\/?[^>]+(>|$)/g, ""); // Strip any HTML tags
        cellStr = cellStr.replace(/"/g, '""'); // Escape double quotes
        if (cellStr.includes(',') || cellStr.includes('\n') || cellStr.includes('"')) {
            return `"${cellStr}"`;
        }
        return cellStr;
    };

    let csvContent = headers.join(',') + '\n';
    
    checks.forEach(r => {
        const dateObj = new Date(r.createdAt);
        const formattedDate = dateObj.toLocaleString('id-ID');
        
        const row = [
            r.id,
            formattedDate,
            r.namaPelanggan,
            r.nopol,
            r.noHpFormatted || r.noHp,
            r.tipeMobil,
            r.transmisi || 'Manual',
            (r.kuponTersedia === undefined || r.kuponTersedia === true || r.kuponTersedia === 'Ya') ? 'Ya' : 'Tidak',
            r.odometer,
            r.bulan,
            r.kondisiJalan,
            r.targetKm,
            r.targetBulan,
            r.statusBiayaCustomer,
            r.tipsCustomer,
            r.rekomendasiSro
        ];

        csvContent += row.map(formatCsvCell).join(',') + '\n';
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=log_service_suzuki.csv');
    res.status(200).send(csvContent);
});

// 4. Save a new Service Check & Proxy to N8N Webhook
app.post('/api/service-checks', async (req, res) => {
    const checkData = req.body;
    
    // Server-side validation
    if (!checkData.namaPelanggan || !checkData.nopol || !checkData.noHp) {
        return res.status(400).json({ error: 'Nama, Nomor Polisi, dan WhatsApp wajib diisi.' });
    }

    // Add metadata
    const record = {
        id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
        createdAt: new Date().toISOString(),
        ...checkData
    };

    // Save record to local JSON file
    const checks = readJsonFile(DB_PATH);
    checks.push(record);
    const writeSuccess = writeJsonFile(DB_PATH, checks);

    if (!writeSuccess) {
        console.error('Failed to save service check record to JSON database.');
    }

    // Send payload to N8N Webhook asynchronously (Proxy)
    const settings = readJsonFile(SETTINGS_PATH);
    const webhookUrl = settings.webhookUrl;
    
    if (webhookUrl && webhookUrl !== 'https://perusahaananda.com') {
        // Run fetch asynchronously in background to not block user response
        fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(record)
        })
        .then(response => {
            console.log(`Relayed to N8N webhook. Status: ${response.status}`);
        })
        .catch(err => {
            console.warn(`Failed to relay payload to N8N webhook (${webhookUrl}):`, err.message);
        });
    } else {
        console.log('N8N webhook is default placeholder. Skipping backend trigger.');
    }

    // Respond to frontend immediately
    res.status(201).json({
        success: true,
        message: 'Data berhasil diproses dan disimpan di server.',
        record
    });
});

// Wildcard fallback to serve index.html for single-page routing
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start listening
app.listen(PORT, () => {
    console.log(`==================================================`);
    console.log(`   SUZUKI SERVICE PORTAL IS RUNNING ON PORT ${PORT}`);
    console.log(`   URL: http://localhost:${PORT}`);
    console.log(`==================================================`);
});
