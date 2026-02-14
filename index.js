const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const readline = require('readline');
const chalk = require('chalk');
const qrcode = require('qrcode-terminal'); 

const sessionName = 'auth_session';
let sock;
let rl;

let blastData = {
    message: '',
    numbers: []
};

function createInterface() {
    if (rl) {
        rl.removeAllListeners();
        rl.close();
    }
    rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: false
    });
}

const showHeader = () => {
    console.clear();
    console.log(chalk.green.bold('========================================='));
    console.log(chalk.cyan.bold('      ⚡ OMENG BLASTER (DEBUG MODE) ⚡   '));
    console.log(chalk.yellow('      Cek log di bawah jika stuck...     '));
    console.log(chalk.green.bold('========================================='));
};

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState(sessionName);
    
    console.log(chalk.gray('Memulai socket...'));

    sock = makeWASocket({
        // Ganti ke 'info' biar error kelihatan
        logger: pino({ level: 'info' }), 
        auth: state,
        // Browser kita samakan dengan Firefox Linux biar server WA tidak curiga
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        connectTimeoutMs: 60000, 
        keepAliveIntervalMs: 10000,
        syncFullHistory: false
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        // --- LOG LOGIC ---
        // Kita print status update biar tau lagi ngapain
        if(update.isNewLogin) {
             console.log(chalk.blue('Status: Menunggu Login Baru...'));
        }
        
        if (qr) {
            console.log(chalk.yellow('\n✅ QR CODE DITERIMA DARI SERVER!'));
            console.log(chalk.yellow('Silakan Scan sekarang (Gunakan WA Business/HP Kedua):'));
            // Generate QR Small
            qrcode.generate(qr, { small: true });
        }
        
        if (connection === 'close') {
            const reason = (lastDisconnect.error)?.output?.statusCode;
            console.log(chalk.red(`❌ Koneksi Terputus. Kode Error: ${reason}`));
            
            const shouldReconnect = reason !== DisconnectReason.loggedOut;
            if(shouldReconnect) {
                console.log('Mencoba menyambungkan ulang...');
                connectToWhatsApp();
            } else {
                console.log('Sesi Logout. Silakan hapus folder auth_session dan scan ulang.');
                process.exit(0);
            }
        } else if (connection === 'open') {
            console.log(chalk.green('\n✅ BERHASIL TERHUBUNG!'));
            setTimeout(() => {
                MenuUtama();
            }, 1000);
        }
    });
}

function MenuUtama() {
    createInterface();
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

    let successCount = 0;
    let failCount = 0;

    const tasks = targets.map(async (rawNumber) => {
        const jid = formatNomor(rawNumber);
        try {
            await sock.sendMessage(jid, { text: blastData.message });
            successCount++;
            return { number: rawNumber, status: '✅ TERKIRIM' };
        } catch (error) {
            failCount++;
            return { number: rawNumber, status: '❌ GAGAL', reason: error.message };
        }
    });

    const results = await Promise.all(tasks);
    
    console.log(chalk.green.bold('\n=== LAPORAN PENGIRIMAN ==='));
    results.forEach((res, index) => {
        const numStr = res.number.padEnd(15, ' ');
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
    console.log(chalk.yellow('\nTekan ENTER untuk kembali ke Menu Utama...'));
    
    createInterface();
    rl.question('', () => {
        MenuUtama();
    });
}

function formatNomor(nomor) {
    let formatted = nomor.replace(/[^0-9]/g, '');
    if (formatted.startsWith('0')) formatted = '62' + formatted.slice(1);
    else if (formatted.startsWith('8')) formatted = '62' + formatted;
    return formatted + '@s.whatsapp.net';
}

process.on('SIGINT', function() {
    console.log(chalk.red('\nMematikan Program...'));
    process.exit();
});

console.clear();
console.log('Menghubungkan ke WhatsApp...');
connectToWhatsApp();
