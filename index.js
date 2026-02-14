const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const readline = require('readline');
const chalk = require('chalk');

// --- KONFIGURASI SYSTEM ---
const sessionName = 'auth_session';
let sock;
let rl;

// State Data
let blastData = {
    message: '',
    numbers: []
};

// --- INISIALISASI INPUT READER ---
// Kita buat fungsi ini agar bisa reset total setiap ganti menu
// Ini solusi ampuh membasmi "Ghost Enter"
function createInterface() {
    if (rl) {
        rl.removeAllListeners();
        rl.close();
    }
    rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: false // Trick agar paste tidak bikin lag UI
    });
}

// --- TAMPILAN HEADER ---
const showHeader = () => {
    console.clear();
    console.log(chalk.green.bold('========================================='));
    console.log(chalk.cyan.bold('      ⚡ OMENG ULTIMATE BLASTER ⚡       '));
    console.log(chalk.yellow('      Speed: Instant | Report: Active    '));
    console.log(chalk.green.bold('========================================='));
};

// --- KONEKSI WHATSAPP ---
async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState(sessionName);
    
    sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: true,
        auth: state,
        browser: ["Omeng Panel", "Chrome", "1.0.0"],
        // Optimasi Socket agar tidak gampang putus saat heavy load
        connectTimeoutMs: 60000, 
        keepAliveIntervalMs: 10000,
        syncFullHistory: false
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            if(shouldReconnect) connectToWhatsApp();
        } else if (connection === 'open') {
            setTimeout(() => {
                MenuUtama();
            }, 1000);
        }
    });
}

// --- MENU UTAMA ---
function MenuUtama() {
    createInterface(); // Reset Input
    showHeader();
    console.log(chalk.green('✅ Status: TERHUBUNG'));
    console.log('\n[1] Mulai Blast Baru');
    console.log('[2] Keluar');
    console.log(chalk.gray('\n(Ketik angka lalu Enter)'));

    process.stdout.write(chalk.cyan('> '));

    rl.on('line', (line) => {
        const input = line.trim();
        if (input === '1') {
            InputPesan();
        } else if (input === '2') {
            console.log('Bye!');
            process.exit(0);
        }
    });
}

// --- LANGKAH 1: INPUT PESAN ---
function InputPesan() {
    createInterface();
    showHeader();
    console.log(chalk.yellow('Langkah 1/3: MASUKKAN TEXT'));
    console.log(chalk.gray('(Ketik "0" untuk kembali)'));
    console.log(chalk.white('-----------------------------------------'));
    
    process.stdout.write(chalk.cyan('Tulis Pesan: '));

    rl.on('line', (line) => {
        const msg = line.trim();
        if (msg === '0') return MenuUtama();
        if (!msg) return; // Abaikan enter kosong

        blastData.message = msg; // Simpan pesan
        InputNomor(); // Lanjut
    });
}

// --- LANGKAH 2: INPUT NOMOR (PASTE MODE) ---
function InputNomor() {
    createInterface();
    blastData.numbers = []; // Reset nomor

    showHeader();
    console.log(chalk.yellow('Langkah 2/3: INPUT NOMOR'));
    console.log(chalk.white(`Pesan: "${chalk.cyan(blastData.message)}"`));
    console.log(chalk.white('-----------------------------------------'));
    console.log(chalk.bold.white('INSTRUKSI:'));
    console.log('1. Paste (Tempel) 70 nomor sekaligus di bawah.');
    console.log('2. Tekan Enter.');
    console.log(`3. Ketik kata "${chalk.red.bold('GAS')}" untuk eksekusi.`);
    console.log(chalk.gray('(Ketik "0" untuk Batal/Kembali)'));
    console.log(chalk.green('-----------------------------------------'));
    console.log(chalk.yellow('Silakan Paste Sekarang:'));

    rl.on('line', (line) => {
        const input = line.trim();

        // Fitur Back
        if (input === '0') return MenuUtama();

        // Trigger Eksekusi
        if (input.toUpperCase() === 'GAS') {
            EksekusiBlast();
        } else {
            // Logic Filter Nomor (Hanya ambil angka, minimal 5 digit)
            const clean = input.replace(/[^0-9]/g, '');
            if (clean.length > 5) {
                blastData.numbers.push(clean);
                // Feedback visual kecil agar tau nomor masuk
                process.stdout.write(chalk.gray('.')); 
            }
        }
    });
}

// --- LANGKAH 3: EKSEKUSI & LAPORAN ---
async function EksekusiBlast() {
    // Matikan input listener biar gak keganggu
    if (rl) rl.removeAllListeners();

    const targets = blastData.numbers;
    const total = targets.length;

    if (total === 0) {
        console.log(chalk.red('\n❌ Belum ada nomor yang diinput!'));
        setTimeout(InputNomor, 2000);
        return;
    }

    console.log(chalk.yellow(`\n\n🔄 Memproses ${total} nomor...`));
    console.log(chalk.cyan.bold(`🚀 MELUNCUR DALAM 3 DETIK...`));
    await new Promise(r => setTimeout(r, 1000));
    console.log('3...');
    await new Promise(r => setTimeout(r, 1000));
    console.log('2...');
    await new Promise(r => setTimeout(r, 1000));
    console.log('1... DUAR! 💥\n');

    // Array untuk menampung hasil laporan
    let report = [];
    let successCount = 0;
    let failCount = 0;

    // --- CORE LOGIC: PROMISE ALL (INSTANT) ---
    // Kita map setiap nomor menjadi sebuah "Promise" pengiriman
    const tasks = targets.map(async (rawNumber) => {
        const jid = formatNomor(rawNumber);
        
        try {
            // Tembak pesan!
            await sock.sendMessage(jid, { text: blastData.message });
            
            // Jika tidak error, catat sukses
            successCount++;
            return { number: rawNumber, status: '✅ TERKIRIM' };

        } catch (error) {
            // Jika error, catat gagal
            failCount++;
            return { number: rawNumber, status: '❌ GAGAL', reason: error.message };
        }
    });

    // Tunggu semua proses selesai (walaupun mereka jalannya barengan)
    const results = await Promise.all(tasks);
    
    // --- TAMPILKAN LAPORAN ---
    console.log(chalk.green.bold('\n=== LAPORAN PENGIRIMAN ==='));
    
    results.forEach((res, index) => {
        const numStr = res.number.padEnd(15, ' '); // Rapiin spasi
        if (res.status.includes('TERKIRIM')) {
            console.log(`${index+1}. ${numStr} : ${chalk.green(res.status)}`);
        } else {
            console.log(`${index+1}. ${numStr} : ${chalk.red(res.status)}`);
        }
    });

    console.log(chalk.white('-----------------------------------------'));
    console.log(chalk.green(`SUKSES: ${successCount}`));
    console.log(chalk.red(`GAGAL : ${failCount}`));
    console.log(chalk.white('-----------------------------------------'));

    // Jeda sebelum balik ke menu agar user bisa baca laporan
    console.log(chalk.yellow('\nTekan ENTER untuk kembali ke Menu Utama...'));
    
    createInterface(); // Aktifkan input lagi khusus buat konfirmasi
    rl.question('', () => {
        MenuUtama();
    });
}

// --- HELPER FORMAT NOMOR ---
function formatNomor(nomor) {
    let formatted = nomor.replace(/[^0-9]/g, '');
    if (formatted.startsWith('0')) formatted = '62' + formatted.slice(1);
    else if (formatted.startsWith('8')) formatted = '62' + formatted;
    return formatted + '@s.whatsapp.net';
}

// --- START PROGRAM ---
// Handle CTRL+C agar keluar bersih
process.on('SIGINT', function() {
    console.log(chalk.red('\nMematikan Program...'));
    process.exit();
});

console.clear();
console.log('Menghubungkan ke WhatsApp...');
connectToWhatsApp();
