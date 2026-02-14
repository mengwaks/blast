const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, delay, Browsers } = require('@whiskeysockets/baileys');
const pino = require('pino');
const readline = require('readline');
const chalk = require('chalk');
const qrcode = require('qrcode-terminal');

const sessionName = 'auth_session';
let sock;
let isConnected = false;

// SATU READLINE GLOBAL (Sesuai arahan GPT biar gak ghosting)
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true
});

let blastData = { message: '', numbers: [] };

const ask = (query) => new Promise((resolve) => rl.question(query, resolve));

const showHeader = () => {
    console.clear();
    console.log(chalk.green.bold('========================================='));
    console.log(chalk.cyan.bold('     ⚡ OMENG BLASTER V4 : DUAL MODE ⚡   '));
    console.log(chalk.yellow('      QR Code & Pairing Manual Ready     '));
    console.log(chalk.green.bold('========================================='));
};

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState(sessionName);
    
    // Setup Socket Dasar
    sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        auth: state,
        browser: Browsers.ubuntu('Chrome'),
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 0,
        keepAliveIntervalMs: 10000
    });

    // --- LOGIC AUTHENTICATION ---
    if (!sock.authState.creds.me) {
        showHeader();
        console.log(chalk.white('Pilih Metode Login:'));
        console.log('[1] Scan QR Code');
        console.log('[2] Pairing Code (Nomor HP)');
        const choice = await ask(chalk.yellow('\nPilih (1/2) > '));

        if (choice === '1') {
            console.log(chalk.gray('\nMenunggu QR Code dari server...'));
            sock.ev.on('connection.update', (update) => {
                const { qr } = update;
                if (qr) {
                    console.clear();
                    console.log(chalk.yellow('SCAN QR INI DENGAN WA KAMU:\n'));
                    qrcode.generate(qr, { small: true });
                    console.log(chalk.gray('\nQR akan kadaluarsa dlm 30 detik.'));
                }
            });
        } else if (choice === '2') {
            const num = await ask(chalk.yellow('\nMasukkan Nomor WA (628xxx): '));
            const cleanNum = num.replace(/[^0-9]/g, '');
            if (cleanNum) {
                console.log(chalk.gray('\nSabar, menghubungkan socket... (10 detik)'));
                await delay(10000); 
                try {
                    let code = await sock.requestPairingCode(cleanNum);
                    code = code?.match(/.{1,4}/g)?.join("-") || code;
                    console.log(chalk.green.bold('\n✅ KODE PAIRING: ') + chalk.bgGreen.black.bold(` ${code} `));
                    console.log(chalk.white('\nInput di: WA > Perangkat Tertaut > Tautkan dg Nomor.'));
                } catch (e) {
                    console.log(chalk.red(`\n❌ Error: ${e.message}. Re-run script!`));
                    process.exit(0);
                }
            }
        }
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            isConnected = false;
            const reason = lastDisconnect?.error?.output?.statusCode;
            // Jika ditutup paksa (Connection Closed), coba sambung lagi
            if (reason !== DisconnectReason.loggedOut) {
                console.log(chalk.red(`\nKoneksi Terputus (${reason}). Reconnecting...`));
                connectToWhatsApp();
            } else {
                console.log(chalk.red('\nSesi Logout. Hapus folder auth_session!'));
                process.exit(0);
            }
        } else if (connection === 'open') {
            isConnected = true;
            console.log(chalk.green('\n✅ TERHUBUNG! Mantap, Meng.'));
            setTimeout(() => MenuUtama(), 2000);
        }
    });
}

function MenuUtama() {
    if (!isConnected) return;
    rl.removeAllListeners('line'); 
    showHeader();
    console.log(chalk.green('✅ Status: ONLINE'));
    console.log('\n[1] Mulai Blast Baru');
    console.log('[2] Keluar');
    process.stdout.write(chalk.cyan('\nPilih > '));

    rl.on('line', (line) => {
        if (line.trim() === '1') InputPesan();
        else if (line.trim() === '2') process.exit(0);
    });
}

function InputPesan() {
    rl.removeAllListeners('line');
    showHeader();
    process.stdout.write(chalk.yellow('\nLangkah 1: Tulis Pesan\n> '));
    rl.on('line', (line) => {
        const msg = line.trim();
        if (msg) {
            blastData.message = msg;
            InputNomor();
        }
    });
}

function InputNomor() {
    rl.removeAllListeners('line');
    blastData.numbers = [];
    showHeader();
    console.log(chalk.white(`Pesan: "${chalk.cyan(blastData.message)}"`));
    console.log(chalk.yellow('\nLangkah 2: Paste Nomor. Ketik "GAS" untuk kirim.'));
    
    rl.on('line', (line) => {
        const input = line.trim();
        if (input.toUpperCase() === 'GAS') {
            Eksekusi();
        } else {
            const n = input.replace(/[^0-9]/g, '');
            if (n.length > 5) {
                blastData.numbers.push(n);
                process.stdout.write(chalk.gray('.'));
            }
        }
    });
}

async function Eksekusi() {
    rl.removeAllListeners('line');
    if (blastData.numbers.length === 0) return MenuUtama();
    console.log(chalk.yellow(`\n\n🔄 Mengirim ke ${blastData.numbers.length} nomor...`));
    
    for (const num of blastData.numbers) {
        try {
            await sock.sendMessage(num + '@s.whatsapp.net', { text: blastData.message });
            console.log(chalk.green(`✅ ${num} Terkirim`));
        } catch (e) {
            console.log(chalk.red(`❌ ${num} Gagal`));
        }
        await delay(2000); // Jeda 2 detik (lebih aman)
    }

    console.log(chalk.bold('\nSELESAI. Tekan Enter balik ke menu.'));
    rl.once('line', () => MenuUtama());
}

connectToWhatsApp();
