// --- SUZUKI CAR KNOWLEDGE BASE DATA ---
const DAFTAR_SUZUKI = [
    "Suzuki All New Ertiga", "Suzuki All New Ertiga Hybrid", "Suzuki XL7", "Suzuki New XL7 Hybrid",
    "Suzuki Grand Vitara (Gen 4)", "Suzuki Fronx", "Suzuki Jimny 3-Doors (JB74)", "Suzuki Jimny 5-Doors",
    "Suzuki Baleno Hatchback", "Suzuki S-Presso", "Suzuki Ignis", "Suzuki SX4 S-Cross",
    "Suzuki New Carry Pickup", "Suzuki Carry Futura 1.5", "Suzuki APV Arena", "Suzuki APV Blind Van",
    "Suzuki Ertiga (Gen 1)", "Suzuki Karimun Wagon R", "Suzuki Karimun Estilo", "Suzuki Karimun (Gen 1)",
    "Suzuki Swift", "Suzuki Splash", "Suzuki Celerio", "Suzuki SX4 X-Over", "Suzuki Grand Vitara (Gen 3)",
    "Suzuki Escudo 2.0", "Suzuki Escudo 1.6", "Suzuki Vitara (JLX)", "Suzuki Sidekick", "Suzuki Katana"
];

// --- INITIALIZATION & CONFIGURATION ---
let currentWebhookUrl = "https://perusahaananda.com";
let currentResults = null;
let cachedHistory = []; // Cache for submissions history

document.addEventListener("DOMContentLoaded", () => {
    // Populate Tipe Mobil Dropdown
    const carDropdown = document.getElementById("tipe_mobil");
    
    // 1. Buat opsi default "Pilih Tipe Kendaraan"
    const defaultOption = document.createElement("option");
    defaultOption.value = ""; // Value kosong agar terbaca belum diisi
    defaultOption.textContent = "-- Pilih Tipe Kendaraan --";
    defaultOption.disabled = true; // Tidak bisa dipilih kembali setelah diubah
    defaultOption.selected = true; // Menjadi pilihan pertama saat web dibuka
    carDropdown.appendChild(defaultOption);

    // 2. Masukkan daftar mobil dari DAFTAR_SUZUKI
    DAFTAR_SUZUKI.forEach(car => {
        const option = document.createElement("option");
        option.value = car;
        option.textContent = car;
        carDropdown.appendChild(option);
    });

    // Check SRO authorization from URL query parameters and sessionStorage
    const urlParams = new URLSearchParams(window.location.search);
    const isSROUrl = urlParams.get("role") === "sro";
    const isAuthenticated = sessionStorage.getItem("sro_auth_token") !== null;

    // Fetch settings configuration from Express backend
    fetch('/api/settings')
        .then(res => res.json())
        .then(settings => {
            currentWebhookUrl = settings.webhookUrl;
            document.getElementById("webhook-url-input").value = currentWebhookUrl;
            document.getElementById("settings-username-input").placeholder = settings.adminUsername;
        })
        .catch(err => console.warn('Could not fetch settings from server, using default settings.'));

    if (isSROUrl) {
        if (isAuthenticated) {
            document.body.classList.add("role-sro");
            fetchHistory();
        } else {
            // Reveal SRO Login Modal overlay
            document.getElementById("login-modal").classList.add("active");
        }
    }

    // Theme Initialisation
    const savedTheme = localStorage.getItem("theme") || "dark";
    document.documentElement.setAttribute("data-theme", savedTheme);

    // Attach Event Listeners
    setupEventListeners();
});

// --- HELPER STEP INPUT FUNCTION ---
window.stepInput = (inputId, step) => {
    const input = document.getElementById(inputId);
    let val = parseInt(input.value) || 0;
    val = Math.max(0, val + step);
    input.value = val;
    
    // Trigger input event to clear potential validation error highlighting
    input.dispatchEvent(new Event('input', { bubbles: true }));
};

// --- SETUP EVENT LISTENERS ---
function setupEventListeners() {
    // Form buttons custom stepping (in case manual functions don't work due to scoping)
    document.getElementById("odometer-minus").addEventListener("click", () => stepInput("odometer", -500));
    document.getElementById("odometer-plus").addEventListener("click", () => stepInput("odometer", 500));
    document.getElementById("bulan-minus").addEventListener("click", () => stepInput("bulan", -1));
    document.getElementById("bulan-plus").addEventListener("click", () => stepInput("bulan", 1));

    // Theme Toggle
    const themeBtn = document.getElementById("theme-toggle-btn");
    themeBtn.addEventListener("click", () => {
        const currentTheme = document.documentElement.getAttribute("data-theme");
        const newTheme = currentTheme === "light" ? "dark" : "light";
        document.documentElement.setAttribute("data-theme", newTheme);
        localStorage.setItem("theme", newTheme);
    });

    // Settings Drawer Open/Close
    const settingsBtn = document.getElementById("settings-btn");
    const closeSettingsBtn = document.getElementById("close-settings-btn");
    const settingsDrawer = document.getElementById("settings-drawer");

    settingsBtn.addEventListener("click", () => {
        settingsDrawer.classList.add("active");
    });

    closeSettingsBtn.addEventListener("click", () => {
        settingsDrawer.classList.remove("active");
    });

    // Close settings if clicked outside of content
    settingsDrawer.addEventListener("click", (e) => {
        if (e.target === settingsDrawer) {
            settingsDrawer.classList.remove("active");
        }
    });

    // Save Settings (Webhook & Credentials) to Express backend
    const saveSettingsBtn = document.getElementById("save-settings-btn");
    saveSettingsBtn.addEventListener("click", () => {
        const inputUrl = document.getElementById("webhook-url-input").value.trim();
        const inputUsername = document.getElementById("settings-username-input").value.trim();
        const inputPassword = document.getElementById("settings-password-input").value.trim();
        
        if (!inputUrl) return;

        const payload = { webhookUrl: inputUrl };
        if (inputUsername) payload.adminUsername = inputUsername;
        if (inputPassword) payload.adminPassword = inputPassword;

        fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
        .then(res => res.json())
        .then(data => {
            currentWebhookUrl = data.settings.webhookUrl;
            
            // Clear input credential fields and refresh placeholder
            document.getElementById("settings-password-input").value = "";
            document.getElementById("settings-username-input").value = "";
            document.getElementById("settings-username-input").placeholder = data.settings.adminUsername;

            // Show Success Toast
            const toast = document.getElementById("settings-toast");
            toast.classList.add("show");
            setTimeout(() => {
                toast.classList.remove("show");
                settingsDrawer.classList.remove("active");
            }, 1500);
        })
        .catch(err => {
            console.error('Failed to save settings:', err);
            alert('Gagal menyimpan pengaturan ke server.');
        });
    });

    // Main Form Submit Listener
    const form = document.getElementById("service-form");
    form.addEventListener("submit", handleFormSubmit);

    // Results Actions
    const waShareBtn = document.getElementById("whatsapp-share-btn");
    waShareBtn.addEventListener("click", handleWhatsAppShare);

    const printBtn = document.getElementById("print-btn");
    printBtn.addEventListener("click", () => {
        window.print();
    });

    // SRO Logout button trigger
    const logoutBtn = document.getElementById("logout-btn");
    logoutBtn.addEventListener("click", () => {
        sessionStorage.removeItem("sro_auth_token");
        document.body.classList.remove("role-sro");
        window.location.href = "/";
    });

    // CSV Download trigger dengan Rentang Tanggal
    const downloadCsvBtn = document.getElementById("download-csv-btn");
    if (downloadCsvBtn) {
        downloadCsvBtn.addEventListener("click", () => {
            // Ambil nilai dari kedua input kalender
            const startDate = document.getElementById("filter-start-date")?.value;
            const endDate = document.getElementById("filter-end-date")?.value;
            
            let url = "/api/service-checks/csv";
            let queryParams = [];
            
            // Jika user mengisi tanggal mulai
            if (startDate) {
                queryParams.push(`startDate=${startDate}`);
            }
            // Jika user mengisi tanggal akhir
            if (endDate) {
                queryParams.push(`endDate=${endDate}`);
            }
            
            // Gabungkan parameter ke dalam URL (misal: ?startDate=2026-03-01&endDate=2026-03-31)
            if (queryParams.length > 0) {
                url += `?${queryParams.join("&")}`;
            }
            
            // Arahkan ke URL untuk memicu download
            window.location.href = url;
        });
    } 

    // Login Form Submit Handling
    const loginForm = document.getElementById("login-form");
    if(loginForm) {
        loginForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const usernameInput = document.getElementById("login-username").value.trim();
            const passwordInput = document.getElementById("login-password").value.trim();
            const errorMsgEl = document.getElementById("login-error-msg");

            fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: usernameInput, password: passwordInput })
            })
            .then(res => {
                if (!res.ok) {
                    return res.json().then(data => { throw new Error(data.error); });
                }
                return res.json();
            })
            .then(data => {
                // Authentication successful
                sessionStorage.setItem("sro_auth_token", data.token);
                document.body.classList.add("role-sro");
                document.getElementById("login-modal").classList.remove("active");
                errorMsgEl.style.display = "none";
                loginForm.reset();
                
                // Load and draw logs
                fetchHistory();
            })
            .catch(err => {
                errorMsgEl.innerText = err.message || "Username atau password salah!";
                errorMsgEl.style.display = "block";
            });
        });
    }

    // Login Modal close/cancel redirection
    const closeLoginBtn = document.getElementById("close-login-btn");
    if(closeLoginBtn) {
        closeLoginBtn.addEventListener("click", () => {
            document.getElementById("login-modal").classList.remove("active");
            window.location.href = "/";
        });
    }

    // Clear validation error on type or change
    const requiredInputs = form.querySelectorAll("[required]");
    requiredInputs.forEach(input => {
        // Untuk input teks biasa (Nama, No HP)
        input.addEventListener("input", () => {
            if (input.value.trim() !== "") {
                input.closest(".input-group").classList.remove("error");
            }
        });
        
        // Untuk kotak pilihan / dropdown (Tipe Mobil)
        input.addEventListener("change", () => {
            if (input.value.trim() !== "") {
                input.closest(".input-group").classList.remove("error");
            }
        });

    });
}

// --- CORE RAG LOGIC & CALCULATIONS ---
function calculateServiceSchedule(data) {
    const { odometer, bulan, tipeMobil, kondisiJalan } = data;
    
    let targetKm = 0;
    let targetBulan = 0;
    let statusBiayaCustomer = "";
    let cakupanPengerjaan = "";
    let tipsCustomer = "";
    let rekomendasiSro = "";

    // 1. Evaluasi Aturan Khusus 1.000 KM (Free Service 1)
    if (odometer <= 1000 && bulan <= 1) {
        targetKm = 1000;
        targetBulan = 1;
        statusBiayaCustomer = "🔴 GRATIS BIAYA JASA (Pemeriksaan 23 Bagian Kendaraan)";
        cakupanPengerjaan = "Pemeriksaan Sesuai dengan ketentuan Buku Servis Resmi Suzuki menggunakan Kupon Free Service 1, pada periode 1.000 KM pertama ini <strong>HANYA dilakukan pemeriksaan menyeluruh (Checking Only)</strong> pada komponen vital mobil. Belum ada penggantian oli atau suku cadang.";
        tipsCustomer = "Segera jadwalkan kunjungan ke bengkel resmi Suzuki terdekat agar garansi utama mobil Anda tetap aktif!";
        rekomendasiSro = "Free Service 1 (Checking Only). Wajib arahkan ke bengkel resmi agar garansi aman.";
    } 
    // 2. Evaluasi Aturan Kelipatan 10.000 KM hingga 50.000 KM (Free Service 2 - 6)
    else if (odometer <= 50000 && bulan <= 30) {
        let namaKupon = ""; // Variabel baru untuk menyimpan nama kupon

        if (odometer <= 10000 && bulan <= 6) {
            targetKm = 10000;
            targetBulan = 6;
            namaKupon = "Kupon Free Service 2";
        } else if (odometer <= 20000 && Math.max(0, bulan) <= 12) {
            targetKm = 20000;
            targetBulan = 12;
            namaKupon = "Kupon Free Service 3";
        } else if (odometer <= 30000 && bulan <= 18) {
            targetKm = 30000;
            targetBulan = 18;
            namaKupon = "Kupon Free Service 4";
        } else if (odometer <= 40000 && bulan <= 24) {
            targetKm = 40000;
            targetBulan = 24;
            namaKupon = "Kupon Free Service 5";
        } else {
            targetKm = 50000;
            targetBulan = 30;
            namaKupon = "Kupon Free Service 6";
        }

        // Filter Keuntungan Khusus Tipe Mobil
        if (tipeMobil.includes("New Carry Pickup")) {
            statusBiayaCustomer = "🔴 GRATIS TOTAL (Jasa Servis, Oli Mesin, & Filter Oli)";
            cakupanPengerjaan = `Menggunakan <strong>${namaKupon}</strong> untuk Target ${targetKm.toLocaleString('id-ID')} KM. Anda dibebaskan dari biaya Jasa Mekanik, penggantian Oli Mesin resmi, beserta Filter Oli baru.`;
        } else if (tipeMobil.includes("All New Ertiga") || tipeMobil.includes("XL7")) {
            statusBiayaCustomer = "🔴 GRATIS TOTAL (Jasa Servis, Oli Mesin, & Seluruh Suku Cadang Berkala)";
            cakupanPengerjaan = `Menggunakan <strong>${namaKupon}</strong> untuk Target ${targetKm.toLocaleString('id-ID')} KM. Khusus tipe mobil Anda, Anda mendapatkan gratis biaya Jasa Mekanik, Oli Mesin, dan seluruh Suku Cadang (Part) berkala resmi sesuai ketentuan kupon.`;
        } else {
            statusBiayaCustomer = "🟡 GRATIS BIAYA JASA SAJA (Oli & Part Berbayar)";
            cakupanPengerjaan = `Menggunakan <strong>${namaKupon}</strong> untuk Target ${targetKm.toLocaleString('id-ID')} KM. Fasilitas yang gratis hanya Jasa Servis berkala saja. Untuk biaya Oli Mesin dan penggantian suku cadang lainnya ditanggung oleh pemilik kendaraan.`;
        }

        // Tips Interval berdasarkan kondisi jalan
        if (kondisiJalan === "Normal") {
            tipsCustomer = `Kondisi mobil Anda terpantau sangat baik. Silakan lakukan servis berkala secara rutin setiap kelipatan <strong>10.000 KM atau 6 Bulan sekali</strong> (mana yang tercapai lebih dulu).`;
            rekomendasiSro = "Kondisi jalan normal. Follow-up standar per 10.000 KM / 6 Bulan.";
        } else {
            tipsCustomer = `⚠️ <strong>Rekomendasi Khusus</strong>: Karena mobil Anda sering melewati rute padat/macet/beban berat, oli mesin akan lebih cepat encer dan kotor. Demi menjaga performa mesin tetap awet, kami sangat menyarankan Anda melakukan servis lebih awal di kelipatan <strong>5.000 KM atau per 3 Bulan sekali</strong> tanpa harus menunggu angka 10.000 KM penuh.`;
            rekomendasiSro = "KONDISI BERAT! SRO wajib follow-up lebih cepat per kelipatan 5.000 KM demi kesehatan mesin.";
        }
    } 
    // 3. Evaluasi Aturan Servis Lanjutan (> 50.000 KM)
    else {
        let intervalKm, intervalBulan;
        
        if (kondisiJalan === "Normal") {
            intervalKm = 10000;
            intervalBulan = 6;
            rekomendasiSro = "Servis Lanjutan (Berbayar). Follow-up standar per 10.000 KM / 6 Bulan.";
            tipsCustomer = "Kupon Free Service Anda telah selesai. Disarankan melakukan servis rutin berkala setiap kelipatan <strong>10.000 KM atau 6 Bulan sekali</strong> untuk mempertahankan nilai jual kembali mobil Anda.";
        } else {
            intervalKm = 5000;
            intervalBulan = 3;
            rekomendasiSro = "Servis Lanjutan (Berbayar). KONDISI BERAT! Wajib follow-up per kelipatan 5.000 KM / 3 Bulan.";
            tipsCustomer = "⚠️ <strong>Rekomendasi Khusus</strong>: Kupon Free Service Anda telah selesai dan kendaraan Anda bekerja di rute yang berat harian. Kami sangat menyarankan servis berkala mandiri setiap kelipatan <strong>5.000 KM atau 3 Bulan sekali</strong> agar komponen mesin tidak mengalami aus dini.";
        }

        targetKm = Math.ceil((odometer + 1) / intervalKm) * intervalKm;
        targetBulan = Math.ceil((bulan + 1) / intervalBulan) * intervalBulan;
        statusBiayaCustomer = "⚫ SERVIS BERKALA REGULER (Berbayar Penuh)";
        cakupanPengerjaan = `Servis Lanjutan Reguler Target ${targetKm.toLocaleString('id-ID')} KM. Seluruh komponen biaya Jasa Pengecekan, Oli Mesin, dan penggantian Suku Cadang sepenuhnya ditanggung secara mandiri oleh pemilik kendaraan.`;
    }

    // Hitung Mundur Sisa Batas Aman (Countdown)
    const sisaKm = targetKm - odometer;
    const sisaBulan = targetBulan - bulan;

    // --- TAMBAHAN LOGIKA STATUS SERVIS ---
    let statusServis = "";
    let alasanServis = "";

    // 1. KONDISI LEWAT BATAS / WAJIB SERVIS
    if (sisaKm <= 0 || sisaBulan <= 0) {
        statusServis = "🔴 Wajib Servis Sekarang";
        if (sisaKm <= 0 && sisaBulan > 0) {
            alasanServis = "Batas Jarak Tempuh (KM) telah tercapai/terlewat.";
        } else if (sisaBulan <= 0 && sisaKm > 0) {
            alasanServis = "Batas Waktu (Bulan) telah tercapai/terlewat.";
        } else {
            alasanServis = "Batas Jarak Tempuh dan Waktu keduanya telah tercapai/terlewat.";
        }
    } 
    // 2. KONDISI MENDEKATI BATAS (Warning / Pengingat)
    else if (sisaKm <= 1000 || sisaBulan <= 1) {
        statusServis = "🟡 Mendekati Batas Servis";
        alasanServis = "Segera jadwalkan booking servis Anda dalam waktu dekat.";
    } 
    // 3. KONDISI AMAN
    else {
        statusServis = "🟢 Aman";
        alasanServis = "Kondisi jarak dan waktu masih dalam batas aman.";
    }

    return {
        targetKm,
        targetBulan,
        statusBiayaCustomer,
        cakupanPengerjaan,
        tipsCustomer,
        rekomendasiSro,
        sisaKm,
        sisaBulan,
        statusServis, 
        alasanServis
    };
}

// --- FORM SUBMIT HANDLER ---
async function handleFormSubmit(e) {
    e.preventDefault();
    
    const form = e.target;
    const namaInput = document.getElementById("nama_pelanggan");
    const nopolInput = document.getElementById("nopol");
    const noHpInput = document.getElementById("no_hp");
    const carDropdown = document.getElementById("tipe_mobil");
    const odometerInput = document.getElementById("odometer");
    const bulanInput = document.getElementById("bulan");
    const submitBtn = document.getElementById("submit-btn");

    // Reset validations
