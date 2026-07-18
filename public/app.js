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

    // TAMBAHAN: Tombol plus/minus untuk Servis Terakhir
    document.getElementById("odometer_terakhir-minus").addEventListener("click", () => stepInput("odometer_terakhir", -500));
    document.getElementById("odometer_terakhir-plus").addEventListener("click", () => stepInput("odometer_terakhir", 500));
    document.getElementById("bulan_terakhir-minus").addEventListener("click", () => stepInput("bulan_terakhir", -1));
    document.getElementById("bulan_terakhir-plus").addEventListener("click", () => stepInput("bulan_terakhir", 1));

    // Theme Toggle
    const themeBtn = document.getElementById("theme-toggle-btn");
    themeBtn.addEventListener("click", () => {
        const currentTheme = document.documentElement.getAttribute("data-theme");
        const newTheme = currentTheme === "light" ? "dark" : "light";
        document.documentElement.setAttribute("data-theme", newTheme);
        localStorage.setItem("theme", newTheme);
    });

    // Kupon switch toggle change listener
    const kuponToggle = document.getElementById("kupon_tersedia");
    const labelKuponTidak = document.getElementById("label-kupon-tidak");
    const labelKuponYa = document.getElementById("label-kupon-ya");
    if (kuponToggle && labelKuponTidak && labelKuponYa) {
        kuponToggle.addEventListener("change", function () {
            if (this.checked) {
                labelKuponYa.style.color = "var(--text-title)";
                labelKuponTidak.style.color = "var(--text-muted)";
            } else {
                labelKuponYa.style.color = "var(--text-muted)";
                labelKuponTidak.style.color = "var(--text-title)";
            }
        });
    }

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
    if (loginForm) {
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
    if (closeLoginBtn) {
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
    const { odometer, bulan, tipeMobil, kondisiJalan, odometerTerakhir, bulanTerakhir, transmisi, kuponTersedia } = data;
    const vehicleTransmisi = transmisi || "Manual";

    let targetKm = 0;
    let targetBulan = 0;
    let statusBiayaCustomer = "";
    let cakupanPengerjaan = "";
    let tipsCustomer = "";
    let rekomendasiSro = "";

    // 1. Tentukan Interval Standar Berdasarkan Kondisi Jalan
    let intervalKm = (kondisiJalan === "Normal") ? 10000 : 5000;
    let intervalBulan = (kondisiJalan === "Normal") ? 6 : 3;

    // 2. HITUNG TARGET DINAMIS (Berdasarkan Servis Terakhir)
    if (odometerTerakhir === 0 && bulanTerakhir === 0) {
        // Jika belum pernah direkam servis sama sekali, target PERTAMA mutlak 1.000 KM
        targetKm = 1000;
        targetBulan = 1;
    } else {
        // Target dihitung progresif dari jejak servis terakhir
        targetKm = odometerTerakhir + intervalKm;
        targetBulan = bulanTerakhir + intervalBulan;

        // Khusus transisi dari Free Service 1 (≤ 2.000 KM) ke Free Service 2 / Paket A
        if (odometerTerakhir > 0 && odometerTerakhir <= 2000) {
            targetKm = intervalKm;
            targetBulan = (kondisiJalan === "Normal") ? 6 : 3;
        }
    }

    // 3. EVALUASI TOLERANSI KUPON & KUPON HANGUS
    let targetKuponKm = targetKm;
    let isHangus = false;
    let useFreeService = true;

    // Cek apakah kupon dinonaktifkan secara manual
    if (kuponTersedia === false || kuponTersedia === "Tidak") {
        useFreeService = false;
    }

    // Khusus masa free service, jika pemakaian berat, target di kelipatan 5.000 KM (yang bukan kelipatan 10.000 KM dan bukan 1.000 KM) menggunakan Paket A reguler
    if (useFreeService && kondisiJalan === "Padat" && targetKm <= 50000 && (targetKm % 10000 === 5000 || targetKm === 6000)) {
        useFreeService = false;
    }

    if (useFreeService) {
        // A. Toleransi khusus Free Service 1 (Target 1.000 KM, batas maksimal klaim 2.000 KM)
        if (targetKuponKm === 1000 && odometer > 2000) {
            isHangus = true;
            targetKuponKm = 10000; // Lompat ke FS 2
        }

        // B. Looping toleransi untuk kupon FS 2 s/d FS 6 (Kelipatan 10.000 KM)
        // Jika Odometer aktual - Target Kupon > 1000 KM, kupon hangus, geser ke kupon berikutnya
        while (odometer - targetKuponKm > 1000 && targetKuponKm <= 50000) {
            isHangus = true;
            targetKuponKm += 10000;
        }
    }

    // 4. PENENTUAN STATUS BIAYA & BENEFIT KUPON BERDASARKAN KUPON YANG TERSEDIA
    if (useFreeService && targetKuponKm <= 1000) {
        // Pelanggan tepat waktu untuk Kupon 1 (Odometer <= 2000 KM)
        statusBiayaCustomer = "🔴 GRATIS BIAYA JASA (Pemeriksaan 23 Bagian Kendaraan)";
        cakupanPengerjaan = "Pemeriksaan menggunakan Kupon Free Service 1.<br><strong>Service yang dilakukan:</strong> Pemeriksaan 23 Bagian Kendaraan.";
        tipsCustomer = "Segera jadwalkan kunjungan agar garansi utama mobil tetap aktif!";
        rekomendasiSro = "Free Service 1. Wajib arahkan ke bengkel resmi.";

    } else if (useFreeService && targetKuponKm <= 50000) {
        // Pelanggan masuk di rentang Kupon 2 s/d 6
        let namaKupon = "";
        let kuponNumber = (Math.ceil(targetKuponKm / 10000)) + 1;

        if (kuponNumber > 6) kuponNumber = 6;
        namaKupon = "Kupon Free Service " + kuponNumber;

        // Detail service berdasarkan kupon
        let servicesList = [];
        if (targetKuponKm === 10000) {
            servicesList = ["Ganti Oli Mesin & Filter Oli", "Pemeriksaan 23 Bagian Kendaraan"];
        } else if (targetKuponKm === 20000) {
            servicesList = ["Ganti Oli Mesin & Filter Oli", "Tune Up", "Pemeriksaan 23 Bagian Kendaraan"];
        } else if (targetKuponKm === 30000) {
            servicesList = ["Ganti Oli Mesin & Filter Oli", "Pemeriksaan 23 Bagian Kendaraan"];
        } else if (targetKuponKm === 40000) {
            servicesList = ["Ganti Oli Mesin & Filter Oli", "Ganti Oli Transmisi", "Tune Up", "Service Rem 4 Roda", "Kuras Radiator", "Pemeriksaan 23 Bagian Kendaraan"];
        } else if (targetKuponKm === 50000) {
            servicesList = ["Ganti Oli Mesin & Filter Oli", "Pemeriksaan 23 Bagian Kendaraan"];
        }

        // Khusus transmisi Matic kelipatan 50.000 KM
        if (vehicleTransmisi === "Matic" && targetKuponKm % 50000 === 0) {
            servicesList.push("Kuras Oli Matic");
        }

        let detailService = servicesList.join(", ");

        // Pesan Hukuman jika ada kupon yang terlewat/hangus
        let hangusWarning = isHangus ? `<br><br><span style="color: #ef4444; font-weight: bold; padding: 4px 0; display: block;">⚠️ KUPON SEBELUMNYA HANGUS (Terlewat > 1.000 KM).</span> Anda terpaksa menggunakan fasilitas <strong>${namaKupon}</strong> untuk servis kali ini.` : "";

        if (tipeMobil.includes("New Carry Pickup")) {
            statusBiayaCustomer = isHangus ? `🔴 MENGGUNAKAN KUPON FREE SERVICE ${kuponNumber}` : "🔴 GRATIS TOTAL (Jasa Servis, Oli Mesin, & Filter Oli)";
            cakupanPengerjaan = `Menggunakan <strong>${namaKupon}</strong>. Bebas biaya Jasa, Oli, dan Filter.`;
        } else if (tipeMobil.includes("All New Ertiga") || tipeMobil.includes("XL7")) {
            statusBiayaCustomer = isHangus ? `🔴 MENGGUNAKAN KUPON FREE SERVICE ${kuponNumber}` : "🔴 GRATIS TOTAL (Jasa Servis, Oli Mesin, & Seluruh Suku Cadang Berkala)";
            cakupanPengerjaan = `Menggunakan <strong>${namaKupon}</strong>. Gratis biaya Jasa, Oli, dan Suku Cadang berkala resmi.`;
        } else {
            statusBiayaCustomer = isHangus ? `🟡 MENGGUNAKAN KUPON FREE SERVICE ${kuponNumber}` : "🟡 GRATIS BIAYA JASA SAJA (Oli & Part Berbayar)";
            cakupanPengerjaan = `Menggunakan <strong>${namaKupon}</strong>. Gratis Jasa Servis berkala. Oli & Suku cadang berbayar mandiri.`;
        }

        cakupanPengerjaan += `<br><strong>Service yang dilakukan:</strong> ${detailService}.${hangusWarning}`;

        tipsCustomer = kondisiJalan === "Normal"
            ? `Berdasarkan histori pemakaian Anda, jadwal servis rutin direkomendasikan setiap penambahan <strong>10.000 KM atau 6 Bulan</strong>.`
            : `⚠️ Karena rute berat, direkomendasikan servis setiap penambahan <strong>5.000 KM atau 3 Bulan</strong> dari waktu terakhir servis.`;

        rekomendasiSro = `Kondisi: ${kondisiJalan}. Target baca awal: ${targetKm} KM. Kupon yg diklaim: FS ${kuponNumber}.`;

    } else {
        // targetKuponKm > 50000 (Masa Free Service habis, atau pelanggan telat luar biasa sehingga Hangus semua)
        let checkKm = Math.round(targetKm / 5000) * 5000;
        if (checkKm < 5000) checkKm = 5000;

        let packageName = "";
        let servicesList = [];

        if (checkKm % 40000 === 0) {
            packageName = "Paket D (Kelipatan 40.000 Km)";
            servicesList = ["Ganti Oli Mesin & Filter Oli", "Ganti Oli Transmisi", "Tune Up", "Service Rem 4 Roda", "Kuras Radiator", "Pemeriksaan 23 Bagian Kendaraan"];
        } else if (checkKm % 20000 === 0) {
            packageName = "Paket C (Kelipatan 20.000 Km)";
            servicesList = ["Ganti Oli Mesin & Filter Oli", "Tune Up", "Pemeriksaan 23 Bagian Kendaraan"];
        } else {
            if (kondisiJalan === "Normal") {
                packageName = "Paket B (Kelipatan 10.000 Km)";
                servicesList = ["Ganti Oli Mesin & Filter Oli", "Pemeriksaan 23 Bagian Kendaraan"];
            } else {
                packageName = "Paket A (Kelipatan 5.000 Km)";
                servicesList = ["Ganti Oli Mesin & Filter Oli", "Pemeriksaan 23 Bagian Kendaraan"];
            }
        }

        // Khusus transmisi Matic kelipatan 50.000 KM
        if (vehicleTransmisi === "Matic" && checkKm % 50000 === 0) {
            servicesList.push("Kuras Oli Matic");
        }

        let regularServiceDetail = servicesList.join(", ");
        if (packageName.includes("Paket B") || packageName.includes("Paket A")) {
            if (kondisiJalan === "Normal") {
                regularServiceDetail += " (Untuk kendaraan kondisi rute Normal & Lancar)";
            } else {
                regularServiceDetail += " (Untuk kendaraan kondisi rute Padat & Berat)";
            }
        }

        let hangusWarning = (targetKm <= 50000 && isHangus)
            ? `<br><br><span style="color: #ef4444; font-weight: bold; padding: 4px 0; display: block;">⚠️ KUPON TERAKHIR HANGUS (Terlewat > 1.000 KM).</span> Hak kupon gratis Anda telah habis seluruhnya.`
            : "";

        statusBiayaCustomer = "⚫ SERVIS BERKALA REGULER (Berbayar Penuh)";
        cakupanPengerjaan = `Servis Lanjutan Reguler - <strong>${packageName}</strong> Target ${targetKm.toLocaleString('id-ID')} KM.<br><strong>Service yang dilakukan:</strong> ${regularServiceDetail}.<br>Seluruh komponen Jasa, Oli, dan Part ditanggung pelanggan.${hangusWarning}`;
        if (targetKm <= 50000) {
            if (kuponTersedia === false || kuponTersedia === "Tidak") {
                const recoJalan = kondisiJalan === "Normal"
                    ? "Berdasarkan histori pemakaian Anda, jadwal servis rutin direkomendasikan setiap penambahan 10.000 KM atau 6 Bulan."
                    : "⚠️ Karena rute berat, direkomendasikan servis setiap penambahan 5.000 KM atau 3 Bulan dari waktu terakhir servis.";
                tipsCustomer = `Servis berkala menggunakan biaya reguler mandiri dari pelanggan. ${recoJalan}`;
                rekomendasiSro = `Servis Lanjutan Reguler (Kupon Dinonaktifkan). Paket: ${packageName}. Target interval berikutnya: +${intervalKm} KM.`;
            } else {
                tipsCustomer = "⚠️ Karena rute berat, disarankan servis setiap penambahan 5.000 KM. Servis kali ini berbayar mandiri (Paket A) di antara jadwal Free Service gratis Anda.";
                rekomendasiSro = `Servis Lanjutan Berbayar (Selang-Seling Free Service). Paket: ${packageName}. Target interval berikutnya: +${intervalKm} KM.`;
            }
        } else {
            tipsCustomer = "Masa Kupon Free Service Anda telah selesai. Lakukan perawatan rutin dari hitungan servis terakhir agar mesin awet.";
            rekomendasiSro = `Servis Lanjutan (Berbayar). Paket: ${packageName}. Target interval berikutnya: +${intervalKm} KM.`;
        }
    }

    // 5. HITUNG SELISIH AKTUAL (Sisa Waktu/Jarak dari Target Asli, bukan Kupon)
    const sisaKm = targetKm - odometer;
    const sisaBulan = targetBulan - bulan;

    // 6. EVALUASI STATUS KEPATUHAN (Whichever Comes First)
    let statusServis = "";
    let alasanServis = "";

    if (sisaKm <= 0 || sisaBulan <= 0) {
        statusServis = "🔴 Wajib Servis Sekarang";
        if (sisaKm <= 0 && sisaBulan > 0) {
            alasanServis = `Batas Jarak Tempuh (${targetKm.toLocaleString('id-ID')} KM) telah tercapai/terlewat.`;
        } else if (sisaBulan <= 0 && sisaKm > 0) {
            alasanServis = `Batas Waktu (Bulan ke-${targetBulan}) telah tercapai/terlewat.`;
        } else {
            alasanServis = "Batas Jarak Tempuh dan Waktu keduanya telah tercapai/terlewat.";
        }
    } else if (sisaKm <= 1000 || sisaBulan <= 1) {
        statusServis = "🟡 Mendekati Batas Servis";
        alasanServis = "Segera jadwalkan booking servis Anda sebelum melewati target.";
    } else {
        statusServis = "🟢 Aman";
        alasanServis = "Kondisi kendaraan Anda saat ini masih dalam batas aman berkendara.";
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
        alasanServis,
        odometerTerakhir,
        bulanTerakhir
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
    let isValid = true;
    form.querySelectorAll(".input-group").forEach(el => el.classList.remove("error"));

    // Validation checks
    if (!namaInput.value.trim()) {
        namaInput.closest(".input-group").classList.add("error");
        isValid = false;
    }
    if (!nopolInput.value.trim()) {
        nopolInput.closest(".input-group").classList.add("error");
        isValid = false;
    }
    if (!noHpInput.value.trim()) {
        noHpInput.closest(".input-group").classList.add("error");
        isValid = false;
    }
    if (!odometerInput.value.trim()) {
        odometerInput.closest(".input-group").classList.add("error");
        isValid = false;
    }
    if (!carDropdown.value) {
        carDropdown.closest(".input-group").classList.add("error");
        isValid = false;
    }
    if (!isValid) return;

    // Show Loading state
    submitBtn.classList.add("loading");
    submitBtn.disabled = true;

    // Compile inputs (TERMASUK SERVIS TERAKHIR)
    const inputData = {
        namaPelanggan: namaInput.value.trim(),
        nopol: nopolInput.value.trim().toUpperCase(),
        noHp: noHpInput.value.trim(),
        tipeMobil: carDropdown.value,
        odometer: parseInt(odometerInput.value) || 0,
        bulan: parseInt(bulanInput.value) || 0,
        odometerTerakhir: parseInt(document.getElementById("odometer_terakhir").value) || 0, // TAMBAHAN
        bulanTerakhir: parseInt(document.getElementById("bulan_terakhir").value) || 0,       // TAMBAHAN
        kondisiJalan: form.querySelector('input[name="kondisi_jalan"]:checked').value,
        transmisi: form.querySelector('input[name="transmisi"]:checked')?.value || "Manual",
        kuponTersedia: document.getElementById("kupon_tersedia") ? (document.getElementById("kupon_tersedia").checked ? "Ya" : "Tidak") : "Ya"
    };

    // Calculate results
    const calculatedResults = calculateServiceSchedule(inputData);
    currentResults = { ...inputData, ...calculatedResults };

    // Format WhatsApp phone number (must start with 62)
    let formattedPhone = currentResults.noHp;
    if (formattedPhone.startsWith("0")) {
        formattedPhone = formattedPhone.substring(1);
    }
    if (!formattedPhone.startsWith("62")) {
        formattedPhone = "62" + formattedPhone;
    }
    currentResults.noHpFormatted = formattedPhone;

    // Render results to the dashboard UI
    updateResultsUI(currentResults);

    // Send payload to local Express backend server
    try {
        const response = await fetch('/api/service-checks', {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(currentResults)
        });

        const data = await response.json();
        console.log("Data saved and webhook relayed successfully:", data);

        // Reload history logs if in SRO mode
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get("role") === "sro") {
            fetchHistory();
        }
    } catch (err) {
        console.warn("Could not reach local Express backend API server:", err);
    } finally {
        // Reset loading status
        submitBtn.classList.remove("loading");
        submitBtn.disabled = false;
    }
}

// --- UPDATE RESULTS UI ---
function updateResultsUI(res) {
    const resultsPanel = document.getElementById("results-panel");
    const emptyView = document.getElementById("results-empty-view");
    const contentView = document.getElementById("results-content-view");

    // Shift dashboard classes
    resultsPanel.classList.remove("empty-state");
    emptyView.classList.add("hidden");
    contentView.classList.remove("hidden");
    contentView.classList.add("animate-in");

    // Remove anim class after running to allow re-trigger animation
    setTimeout(() => contentView.classList.remove("animate-in"), 500);

    // Update Basic text fields
    document.getElementById("res-car-title").innerText = res.tipeMobil;
    document.getElementById("res-cust-name").innerText = res.namaPelanggan;
    document.getElementById("res-nopol").innerText = res.nopol;
    document.getElementById("res-odometer").innerText = res.odometer.toLocaleString('id-ID');

    document.getElementById("target-header-badge").innerText = `Target: ${res.targetKm.toLocaleString('id-ID')} KM / Bln ${res.targetBulan}`;

    // Target summary text card
    document.getElementById("target-summary-text").innerHTML = `
        <strong style="font-size: 1.05rem; display: block; margin-bottom: 4px;">${res.statusServis}</strong>
        ${res.alasanServis}<br>
        <span style="font-size: 0.85rem; color: #666; margin-top: 6px; display: inline-block;">(Target Servis: ${res.targetKm.toLocaleString('id-ID')} KM atau Bulan ke-${res.targetBulan})</span>
    `;

    // Visual counts for KM
    const kmValueEl = document.getElementById("gauge-km-value");
    const kmStatusEl = document.getElementById("gauge-km-status");
    const kmCardEl = document.getElementById("gauge-km-card");

    // Reset gauge card classes
    kmCardEl.className = "gauge-card";

    if (res.sisaKm >= 0) {
        kmValueEl.innerText = `${res.sisaKm.toLocaleString('id-ID')} KM`;
        kmStatusEl.innerText = "Aman";

        if (res.sisaKm <= 1000) {
            kmCardEl.classList.add("status-alert");
            kmStatusEl.innerText = "Mendekati Batas";
        } else {
            kmCardEl.classList.add("status-safe");
        }
    } else {
        kmValueEl.innerText = `${Math.abs(res.sisaKm).toLocaleString('id-ID')} KM`;
        kmStatusEl.innerText = "Terlewat!";
        kmCardEl.classList.add("status-danger");
    }

    // Visual counts for Months
    const timeValueEl = document.getElementById("gauge-time-value");
    const timeStatusEl = document.getElementById("gauge-time-status");
    const timeCardEl = document.getElementById("gauge-time-card");

    // Reset gauge card classes
    timeCardEl.className = "gauge-card";

    if (res.sisaBulan >= 0) {
        timeValueEl.innerText = `${res.sisaBulan} Bulan`;
        timeStatusEl.innerText = "Aman";

        if (res.sisaBulan <= 1) {
            timeCardEl.classList.add("status-alert");
            timeStatusEl.innerText = "Mendekati Batas";
        } else {
            timeCardEl.classList.add("status-safe");
        }
    } else {
        timeValueEl.innerText = `${Math.abs(res.sisaBulan)} Bulan`;
        timeStatusEl.innerText = "Terlewat!";
        timeCardEl.classList.add("status-danger");
    }

    // Meredupkan kartu indikator jika yang lainnya sudah terlewat atau bernilai 0 (Whichever comes first)
    if (res.sisaKm <= 0 && res.sisaBulan > 0) {
        timeCardEl.classList.add("status-dimmed");
    } else if (res.sisaBulan <= 0 && res.sisaKm > 0) {
        kmCardEl.classList.add("status-dimmed");
    }

    // Cost status card content & styling
    document.getElementById("res-cost-status-badge").innerHTML = res.statusBiayaCustomer;
    document.getElementById("res-coverage-text").innerHTML = res.cakupanPengerjaan;

    // Tips maintenance card
    document.getElementById("res-tips-text").innerHTML = res.tipsCustomer;

    // SRO recommendation card
    document.getElementById("res-sro-text").innerHTML = res.rekomendasiSro;

    // Trigger sound alerts (terlewat/tercapai vs aman)
    if (res.sisaKm <= 0 || res.sisaBulan <= 0) {
        playWarningSound();
    } else {
        playSafeSound();
    }

    // Efek berkedip (blink) saat hasil perhitungan muncul untuk menarik perhatian
    const summaryCardEl = document.getElementById("target-summary-card");
    kmCardEl.classList.remove("blink-effect");
    timeCardEl.classList.remove("blink-effect");
    if (summaryCardEl) summaryCardEl.classList.remove("blink-effect");

    // Force reflow untuk me-restart animasi CSS
    void kmCardEl.offsetWidth;
    void timeCardEl.offsetWidth;
    if (summaryCardEl) void summaryCardEl.offsetWidth;

    if (!kmCardEl.classList.contains("status-dimmed")) {
        kmCardEl.classList.add("blink-effect");
    }
    if (!timeCardEl.classList.contains("status-dimmed")) {
        timeCardEl.classList.add("blink-effect");
    }
    if (summaryCardEl) {
        summaryCardEl.classList.add("blink-effect");
    }

    // Smooth Scroll to Results on Mobile
    if (window.innerWidth <= 868) {
        resultsPanel.scrollIntoView({ behavior: "smooth" });
    }
}

// --- WHATSAPP MESSAGE REDIRECT COMPILER ---
function handleWhatsAppShare() {
    if (!currentResults) return;

    const r = currentResults;

    // Strip HTML tag markings from status / details for text output
    const cleanCostStatus = r.statusBiayaCustomer.replace(/<\/?[^>]+(>|$)/g, "");
    const cleanCoverage = r.cakupanPengerjaan.replace(/<\/?[^>]+(>|$)/g, "");
    const cleanTips = r.tipsCustomer.replace(/<\/?[^>]+(>|$)/g, "");

    // Format Pesan WhatsApp
    const msg = `Halo Kak *${r.namaPelanggan}*,\n\n` +
        `Berikut adalah hasil analisis jadwal servis berkala mobil *${r.tipeMobil}* Anda (No. Polisi: *${r.nopol}*):\n\n` +
        `*Status Kendaraan:* ${r.statusServis}\n` +
        `*Keterangan:* ${r.alasanServis}\n\n` +
        `📍 *Detail Target Servis:*\n` +
        `- Target KM: ${r.targetKm.toLocaleString('id-ID')} KM (Sisa: ${r.sisaKm.toLocaleString('id-ID')} KM)\n` +
        `- Target Waktu: Bulan ke-${r.targetBulan} (Sisa: ${r.sisaBulan} Bulan)\n\n` +
        `💰 *Status Biaya & Benefit:*\n${cleanCostStatus}\n${cleanCoverage}\n\n` +
        `💡 *Rekomendasi Perawatan:*\n${cleanTips}\n\n` +
        `Silakan tunjukkan pesan ini ke Service Advisor kami saat tiba di bengkel resmi Suzuki. Sampai jumpa!`;

    const encoded = encodeURIComponent(msg);
    const waUrl = `https://wa.me/${r.noHpFormatted}?text=${encoded}`;

    window.open(waUrl, "_blank");
}

// --- SRO LOG SUBMISSIONS HISTORY API & RENDER ---
function fetchHistory() {
    const tableBody = document.getElementById("history-table-body");
    fetch('/api/service-checks')
        .then(res => res.json())
        .then(data => {
            cachedHistory = data;

            if (data.length === 0) {
                tableBody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--text-muted); padding: 2rem;">Belum ada log data masuk.</td></tr>`;
                return;
            }

            tableBody.innerHTML = "";
            data.forEach(record => {
                const tr = document.createElement("tr");

                // Format date cleanly
                const dateObj = new Date(record.createdAt);
                const formattedDate = dateObj.toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });

                // Strip HTML tag markings from cost description
                const cleanCost = record.statusBiayaCustomer ? record.statusBiayaCustomer.replace(/<\/?[^>]+(>|$)/g, "") : "-";

                tr.innerHTML = `
                    <td><strong>${formattedDate}</strong></td>
                    <td>${record.namaPelanggan}</td>
                    <td><code style="text-transform: uppercase;">${record.nopol}</code></td>
                    <td>+${record.noHpFormatted}</td>
                    <td>${record.tipeMobil}</td>
                    <td>${record.odometer.toLocaleString('id-ID')} KM</td>
                    <td><strong>${record.targetKm.toLocaleString('id-ID')} KM</strong><br><span style="font-size: 0.75rem; color: var(--text-muted);">Bln ${record.targetBulan}</span></td>
                    <td><span style="font-size: 0.8rem; font-weight: 500;">${cleanCost.substring(0, 30)}${cleanCost.length > 30 ? '...' : ''}</span></td>
                    <td>
                        <button class="history-action-btn" onclick="loadHistoryRecord('${record.id}')">👁️ Lihat</button>
                    </td>
                `;
                tableBody.appendChild(tr);
            });
        })
        .catch(err => {
            console.error("Gagal memuat riwayat log:", err);
            tableBody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--color-danger); padding: 2rem;">Gagal memuat log riwayat dari server.</td></tr>`;
        });
}

// Load historical entry values back to form and trigger analysis display
window.loadHistoryRecord = (id) => {
    const record = cachedHistory.find(r => r.id === id);
    if (!record) return;

    // Populate input controls
    document.getElementById("nama_pelanggan").value = record.namaPelanggan;
    document.getElementById("nopol").value = record.nopol;
    document.getElementById("no_hp").value = record.noHp;
    document.getElementById("tipe_mobil").value = record.tipeMobil;
    document.getElementById("odometer").value = record.odometer;
    document.getElementById("bulan").value = record.bulan;

    // TAMBAHAN: Isi juga form Histori Servis Terakhir jika datanya ada
    document.getElementById("odometer_terakhir").value = record.odometerTerakhir || 0;
    document.getElementById("bulan_terakhir").value = record.bulanTerakhir || 0;

    // Toggle road condition radio selection
    const radios = document.getElementsByName("kondisi_jalan");
    for (let radio of radios) {
        if (radio.value === record.kondisiJalan) {
            radio.checked = true;
        }
    }

    // Toggle transmission radio selection
    const transmisiRadios = document.getElementsByName("transmisi");
    for (let radio of transmisiRadios) {
        if (radio.value === (record.transmisi || "Manual")) {
            radio.checked = true;
        }
    }

    // Toggle free coupon switch selection
    const recordKuponToggle = document.getElementById("kupon_tersedia");
    const recordLabelKuponTidak = document.getElementById("label-kupon-tidak");
    const recordLabelKuponYa = document.getElementById("label-kupon-ya");
    if (recordKuponToggle && recordLabelKuponTidak && recordLabelKuponYa) {
        const hasCoupon = (record.kuponTersedia === undefined || record.kuponTersedia === true || record.kuponTersedia === "Ya");
        recordKuponToggle.checked = hasCoupon;
        if (hasCoupon) {
            recordLabelKuponYa.style.color = "var(--text-title)";
            recordLabelKuponTidak.style.color = "var(--text-muted)";
        } else {
            recordLabelKuponYa.style.color = "var(--text-muted)";
            recordLabelKuponTidak.style.color = "var(--text-title)";
        }
    }

    // Clear previous error styles
    document.querySelectorAll(".input-group").forEach(el => el.classList.remove("error"));

    // Recalculate parameters
    const results = calculateServiceSchedule(record);
    currentResults = { ...record, ...results };

    // Format WhatsApp phone number (must start with 62)
    let formattedPhone = currentResults.noHp;
    if (formattedPhone.startsWith("0")) {
        formattedPhone = formattedPhone.substring(1);
    }
    if (!formattedPhone.startsWith("62")) {
        formattedPhone = "62" + formattedPhone;
    }
    currentResults.noHpFormatted = formattedPhone;

    // Force UI refresh
    updateResultsUI(currentResults);

    // Smooth scroll to results
    document.getElementById("results-panel").scrollIntoView({ behavior: "smooth" });

};

// --- WEB AUDIO API SOUND ALERTS ---
function playWarningSound() {
    try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;
        const ctx = new AudioContextClass();

        // Bip 1
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = "sine";
        osc1.frequency.setValueAtTime(800, ctx.currentTime);
        gain1.gain.setValueAtTime(0.12, ctx.currentTime);
        gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start();
        osc1.stop(ctx.currentTime + 0.15);

        // Bip 2 (setelah delay)
        setTimeout(() => {
            if (ctx.state === 'closed') return;
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.type = "sine";
            osc2.frequency.setValueAtTime(800, ctx.currentTime);
            gain2.gain.setValueAtTime(0.12, ctx.currentTime);
            gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.start();
            osc2.stop(ctx.currentTime + 0.2);
        }, 180);
    } catch (e) {
        console.warn("AudioContext warning:", e);
    }
}

function playSafeSound() {
    try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;
        const ctx = new AudioContextClass();

        // Nada pertama (rendah)
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = "sine";
        osc1.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
        gain1.gain.setValueAtTime(0.08, ctx.currentTime);
        gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start();
        osc1.stop(ctx.currentTime + 0.2);

        // Nada kedua (tinggi, memberikan kesan melodi aman/sukses)
        setTimeout(() => {
            if (ctx.state === 'closed') return;
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.type = "sine";
            osc2.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
            gain2.gain.setValueAtTime(0.08, ctx.currentTime);
            gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.start();
            osc2.stop(ctx.currentTime + 0.25);
        }, 100);
    } catch (e) {
        console.warn("AudioContext warning:", e);
    }
}
