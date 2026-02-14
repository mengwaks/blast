const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers, delay } = require('@whiskeysockets/baileys');
const pino = require('pino');
const readline = require('readline');
const chalk = require('chalk');

const sessionName = 'auth_session';
let sock;
let rl;

// --- CONFIG USER ---
// Ganti ke 'true' kalau mau mode Pairing Code (Rekomendasi Termux)
const usePairingCode = true; 

let blastData = {
    message: '',
    numbers: []
};

// Interface Baca Input
const question = (text) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => {
        rl.question(text, (answer) => {
            rl.close();
            resolve(answer);
        });
    });
};

// Interface Panel Menu
function createInterface() {
    if (rl) { rl.removeAllListeners(); rl.close(); }
    rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: false });
}

const showHeader = () => {
    console.clear();
    console.log(chalk.green.bold('========================================='));
    console.log(chalk.cyan.bold('     ⚡ OMENG BLASTER : PAIRING MODE ⚡   '));
    console.log(chalk.yellow('     Tanpa Scan QR | Anti Error 405      '));
    console.log(chalk.green.bold('========================================='));
};

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState(sessionName);
    
    sock = makeWASocket({
        logger: pino({ level: 'silent' }), // Silent biar rapi
        printQRInTerminal: !usePairingCode, // Matikan QR kalau pakai Pairing
        auth: state,
        browser: Browsers.macOS('Chrome'), // Gunakan browser Mac biar Trust Score tinggi
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 10000,
        syncFullHistory: false
    });

    // --- LOGIC PAIRING CODE (ANTI RIBET) ---
    if (usePairingCode && !sock.authState.creds.me) {
        console.clear();
        const phoneNumber = await question(chalk.yellow('Masukkan Nomor WhatsApp Kamu (Awali 62/1, cth: 62812345678): '));
        
        // Request Kode
        setTimeout(async () => {
            let code = await sock.requestPairingCode(phoneNumber);
            code = code?.match(/.{1,4}/g)?.join("-") || code;
            console.log(chalk.green.bold('\n✅ KODE PAIRING KAMU: '));
            console.log(chalk.bgGreen.black.bold(`   ${code}   `));
            console.log(chalk.white('\nBuka WA > Perangkat Tertaut > Tautkan dengan Nomor > Masukkan Kode di atas.'));
        }, 3000);
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        
        if (connection === 'close') {
            const reason = (lastDisconnect.error)?.output?.statusCode;
            console.log(chalk.red(`❌ Koneksi Terputus: ${reason}`));
            // Auto Reconnect kecuali Logout/Banned
            if(reason !== DisconnectReason.loggedOut && reason !== 401) {
                connectToWhatsApp();
            } else {
                console.log(chalk.red('Sesi Mati. Silakan hapus auth_session dan login ulang.'));
                process.exit(0);
            }
        } else if (connection === 'open') {
            console.log(chalk.green('\n✅ BERHASIL LOGIN!'));
            setTimeout(() => {
                MenuUtama();
            }, 2000);
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
    console.log(chalk.gray('(Ketik "0" kembali)'));
    process.stdout.write(chalk.cyan('Tulis Pesan: '));

    rl.on('line', (line) => {
        const msg = line.trim();
        if (msg === '0') return MenuUtama();
        if (!msg) return;
        blastData.message = msg;
        InputNomor();
    });
}

function InputNomor() {
    createInterface();
    blastData.numbers = [];
    showHeader();
    console.log(chalk.yellow('Langkah 2/3: INPUT NOMOR'));
    console.log(chalk.white(`Pesan: "${chalk.cyan(blastData.message)}"`));
    console.log(chalk.bold.white('\nINSTRUKSI:'));
    console.log('1. Paste 70 nomor di bawah.');
    console.log('2. Tekan Enter.');
    console.log(`3. Ketik "${chalk.red.bold('GAS')}" untuk kirim.`);
    console.log(chalk.yellow('Silakan Paste:'));

    rl.on('line', (line) => {
        const input = line.trim();
        if (input === '0') return MenuUtama();
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
        console.log(chalk.red('\n❌ Nomor kosong!'));
        setTimeout(InputNomor, 2000);
        return;
    }

    console.log(chalk.yellow(`\n\n🔄 Mengirim ke ${targets.length} nomor...`));
    console.log(chalk.cyan.bold(`🚀 MELUNCUR DALAM 3 DETIK...`));
    await delay(3000);

    let successCount = 0;
    let failCount = 0;

    const tasks = targets.map(async (rawNumber) => {
        const jid = rawNumber + '@s.whatsapp.net';
        try {
            await sock.sendMessage(jid, { text: blastData.message });
            successCount++;
            return { number: rawNumber, status: '✅ OK' };
        } catch (error) {
            failCount++;
            return { number: rawNumber, status: '❌ FAIL' };
        }
    });

    const results = await Promise.all(tasks);
    
    console.log(chalk.bold('\n=== LAPORAN ==='));
    results.forEach((res, i) => {
        console.log(`${i+1}. ${res.number} : ${res.status === '✅ OK' ? chalk.green(res.status) : chalk.red(res.status)}`);
    });
    console.log(chalk.white(`\nSUKSES: ${successCount} | GAGAL: ${failCount}`));
    
    console.log(chalk.yellow('\nTekan ENTER untuk kembali...'));
    createInterface();
    rl.question('', () => MenuUtama());
}

process.on('SIGINT', function() { console.log(chalk.red('\nKeluar...')); process.exit(); });
console.clear();
connectToWhatsApp();
