const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, delay } = require('@whiskeysockets/baileys');
const pino = require('pino');
const readline = require('readline');
const chalk = require('chalk');

const sessionName = 'auth_session';
let sock;
let rl;

// Data Blaster
let blastData = {
    message: '',
    numbers: []
};

// Fungsi Input yang Stabil
const question = (text) => {
    const rlInterface = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => {
        rlInterface.question(text, (answer) => {
            rlInterface.close();
            resolve(answer);
        });
    });
};

function createInterface() {
    if (rl) { rl.removeAllListeners(); rl.close(); }
    rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: false });
}

const showHeader = () => {
    console.clear();
    console.log(chalk.green.bold('========================================='));
    console.log(chalk.cyan.bold('     ⚡ OMENG BLASTER : ULTRA STABLE ⚡   '));
    console.log(chalk.yellow('     Mode: Pairing Code | Anti-Ghosting   '));
    console.log(chalk.green.bold('========================================='));
};

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState(sessionName);
    
    // Konfigurasi Browser & Timeout paling aman
    sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        auth: state,
        // Gunakan identitas Chrome Windows asli biar gak di-kick server
        browser: ["Windows", "Chrome", "110.0.5481.178"],
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 0,
        keepAliveIntervalMs: 10000,
        syncFullHistory: false
    });

    // --- LOGIC PAIRING CODE (ANTI CONNECTION CLOSED) ---
    if (!sock.authState.creds.me) {
        showHeader();
        console.log(chalk.white('Sesi baru terdeteksi. Menyiapkan pairing...'));
        
        const phoneNumber = await question(chalk.yellow('\nMasukkan Nomor WA (cth: 62812345678): '));
        const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');

        if (cleanNumber) {
            console.log(chalk.gray('\nMenghubungkan ke socket...'));
            // JEDA 10 DETIK: Sangat penting biar socket stabil dulu sebelum minta kode
            console.log(chalk.gray('Menunggu 10 detik agar koneksi stabil (Sabar ya, Meng)...'));
            await delay(10000); 

            try {
                let code = await sock.requestPairingCode(cleanNumber);
                code = code?.match(/.{1,4}/g)?.join("-") || code;
                
                console.log(chalk.green.bold('\n✅ KODE PAIRING KAMU: '));
                console.log(chalk.bgGreen.black.bold(`   ${code}   `));
                console.log(chalk.white('\nCara Pakai: WA > Perangkat Tertaut > Tautkan dengan Nomor.'));
            } catch (err) {
                console.log(chalk.red(`\n❌ Gagal dapet kode: ${err.message}`));
                console.log(chalk.yellow('Saran: Matikan-Nyalakan Mode Pesawat, hapus auth_session, coba lagi.'));
                process.exit(0);
            }
        }
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        
        if (connection === 'close') {
            const reason = (lastDisconnect.error)?.output?.statusCode;
            console.log(chalk.red(`\nKoneksi Terputus (Code: ${reason})`));
            
            if(reason !== DisconnectReason.loggedOut) {
                console.log(chalk.gray('Mencoba menyambungkan ulang...'));
                connectToWhatsApp();
            } else {
                console.log(chalk.red('\nSesi Logout. Hapus folder auth_session dan scan ulang.'));
                process.exit(0);
            }
        } else if (connection === 'open') {
            console.log(chalk.green('\n✅ BERHASIL LOGIN! Selamat nge-blast, Meng.'));
            setTimeout(() => MenuUtama(), 2000);
        }
    });
}

function MenuUtama() {
    createInterface();
    showHeader();
    console.log(chalk.green('✅ Status: ONLINE'));
    console.log('\n[1] Mulai Blast Baru');
    console.log('[2] Keluar');
    process.stdout.write(chalk.cyan('> '));

    rl.on('line', (line) => {
        const input = line.trim();
        if (input === '1') InputPesan();
        else if (input === '2') process.exit(0);
    });
}

function InputPesan() {
    createInterface();
    showHeader();
    console.log(chalk.yellow('Langkah 1/3: MASUKKAN TEXT'));
    process.stdout.write(chalk.cyan('Tulis Pesan: '));

    rl.on('line', (line) => {
        const msg = line.trim();
        if (msg === '0') return MenuUtama();
        if (msg) {
            blastData.message = msg;
            InputNomor();
        }
    });
}

function InputNomor() {
    createInterface();
    blastData.numbers = [];
    showHeader();
    console.log(chalk.yellow('Langkah 2/3: INPUT NOMOR'));
    console.log(chalk.white(`Pesan: "${chalk.cyan(blastData.message)}"`));
    console.log(chalk.bold.white('\nINSTRUKSI:'));
    console.log('1. Paste nomor di bawah.');
    console.log(`2. Ketik "${chalk.red.bold('GAS')}" untuk kirim.`);
    console.log(chalk.yellow('\nSilakan Paste:'));

    rl.on('line', (line) => {
        const input = line.trim();
        if (input.toUpperCase() === 'GAS') {
            EksekusiBlast();
        } else {
            const clean = input.replace(/[^0-9]/g, '');
            if (clean.length > 5) {
                blastData.numbers.push(clean);
                process.stdout.write(chalk.gray('.')); 
            }
        }
    });
}

async function EksekusiBlast() {
    if (rl) rl.removeAllListeners();
    const targets = blastData.numbers;
    
    if (targets.length === 0) {
        console.log(chalk.red('\n❌ Nomor belum diisi!'));
        setTimeout(InputNomor, 2000);
        return;
    }

    console.log(chalk.yellow(`\n\n🔄 Mengirim ke ${targets.length} nomor...`));
    await delay(2000);

    let successCount = 0;
    let failCount = 0;

    for (const rawNumber of targets) {
        const jid = rawNumber + '@s.whatsapp.net';
        try {
            await sock.sendMessage(jid, { text: blastData.message });
            successCount++;
            console.log(chalk.green(`[✅] ${rawNumber} Terkirim`));
        } catch (error) {
            failCount++;
            console.log(chalk.red(`[❌] ${rawNumber} Gagal`));
        }
        // Jeda 1 detik antar pesan biar gak kena ban
        await delay(1000); 
    }

    console.log(chalk.bold('\n=== LAPORAN ==='));
    console.log(chalk.green(`SUKSES: ${successCount}`));
    console.log(chalk.red(`GAGAL  : ${failCount}`));
    
    console.log(chalk.yellow('\nTekan ENTER untuk kembali ke Menu Utama...'));
    createInterface();
    rl.question('', () => MenuUtama());
}

process.on('SIGINT', function() { process.exit(); });
console.clear();
connectToWhatsApp();
