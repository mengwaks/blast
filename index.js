const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, delay, Browsers } = require('@whiskeysockets/baileys');
const pino = require('pino');
const readline = require('readline');
const chalk = require('chalk');

const sessionName = 'auth_session';
let sock;
let isConnected = false;

// GLOBAL READLINE
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
    console.log(chalk.cyan.bold('     ⚡ OMENG BLASTER V3 (STABLE) ⚡     '));
    console.log(chalk.yellow('      Proses Pairing Lebih Sabar...      '));
    console.log(chalk.green.bold('========================================='));
};

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState(sessionName);
    
    // Pake identitas Chrome MacOS (Lebih di-trust WA)
    sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        auth: state,
        browser: ["Mac OS", "Chrome", "110.0.5481.178"],
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 0,
        keepAliveIntervalMs: 10000,
        generateHighQualityLinkPreview: false,
        syncFullHistory: false
    });

    // --- LOGIC PAIRING (LOCK MODE) ---
    if (!sock.authState.creds.me) {
        showHeader();
        console.log(chalk.white('Sesi Baru Terdeteksi.'));
        
        const num = await ask(chalk.yellow('\nMasukkan Nomor WA (628xxx): '));
        const cleanNum = num.replace(/[^0-9]/g, '');

        if (cleanNum) {
            console.log(chalk.gray('\n[!] Menghubungkan ke server (Sabar, jangan di-close)...'));
            
            // Trik Inti: Tunggu socket bener-bener 'ngobrol' sama server WA
            await delay(10000); 

            try {
                console.log(chalk.gray('[!] Meminta kode pairing...'));
                let code = await sock.requestPairingCode(cleanNum);
                code = code?.match(/.{1,4}/g)?.join("-") || code;
                
                console.log(chalk.green.bold('\n✅ KODE PAIRING ANDA: '));
                console.log(chalk.bgGreen.black.bold(`   ${code}   `));
                console.log(chalk.white('\nInput di: WA > Perangkat Tertaut > Tautkan dg Nomor.'));
            } catch (err) {
                console.log(chalk.red(`\n❌ Gagal: ${err.message}`));
                console.log(chalk.yellow('Saran: Matikan & Nyalakan Data HP, lalu coba lagi.'));
                process.exit(0);
            }
        }
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            isConnected = false;
            const reason = (lastDisconnect.error)?.output?.statusCode;
            if (reason !== DisconnectReason.loggedOut) connectToWhatsApp();
        } else if (connection === 'open') {
            isConnected = true;
            console.log(chalk.green('\n✅ TERHUBUNG!'));
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
        await delay(1500); // Jeda aman
    }

    console.log(chalk.bold('\nSELESAI. Tekan Enter balik ke menu.'));
    rl.once('line', () => MenuUtama());
}

connectToWhatsApp();
