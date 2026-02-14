/**
 * OMENG BLASTER
 * QR FIRST → PAIRING MANUAL
 * NO STUCK | NO AUTO EXIT | NO RECONNECT LOOP
 */

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
} = require('@whiskeysockets/baileys')

const pino = require('pino')
const readline = require('readline')
const chalk = require('chalk')
const qrcode = require('qrcode-terminal')

/* ================= CONFIG ================= */
const SESSION = 'auth_session'
/* ========================================= */

let sock
let rl
let loggedIn = false
let pairingMode = false

/* ================= READLINE (KEEP ALIVE) ================= */
rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: true
})

// ⛔ penting: ini bikin process TIDAK exit
rl.on('SIGINT', () => process.exit(0))

/* ================= UI ================= */
function header(text = '') {
  console.clear()
  console.log(chalk.green.bold('========================================='))
  console.log(chalk.cyan.bold('     ⚡ OMENG BLASTER : STABLE ⚡        '))
  if (text) console.log(chalk.yellow(text))
  console.log(chalk.green.bold('========================================='))
}

/* ================= CONNECT ================= */
async function start() {
  header('Starting WhatsApp Socket...')

  const { state, saveCreds } = await useMultiFileAuthState(SESSION)

  sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
    browser: ['Windows', 'Chrome', '120']
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', async ({ connection, qr, lastDisconnect }) => {

    /* ===== QR MODE ===== */
    if (qr && !loggedIn && !pairingMode) {
      header('SCAN QR WHATSAPP')
      qrcode.generate(qr, { small: true })
      console.log('\nTunggu scan QR...')
      console.log('Jika QR tidak discan, tekan ENTER untuk pairing manual.')

      rl.once('line', async () => {
        pairingMode = true
        await pairingManual()
      })
    }

    /* ===== LOGIN SUCCESS ===== */
    if (connection === 'open') {
      loggedIn = true
      pairingMode = false
      header('LOGIN BERHASIL')
      mainMenu()
    }

    /* ===== CLOSE ===== */
    if (connection === 'close') {
      if (!loggedIn) return
      const code = lastDisconnect?.error?.output?.statusCode
      if (code !== DisconnectReason.loggedOut) {
        header('Reconnect...')
        start()
      } else {
        header('Logout. Hapus auth_session.')
        process.exit(0)
      }
    }
  })
}

/* ================= PAIRING ================= */
async function pairingManual() {
  header('PAIRING MANUAL')

  rl.question('Masukkan Nomor WA (628xxxx): ', async (num) => {
    const clean = num.replace(/\D/g, '')

    try {
      const raw = await sock.requestPairingCode(clean)
      const code = raw.match(/.{1,4}/g).join('-')
      console.log('\nKODE PAIRING:')
      console.log(chalk.bgGreen.black.bold(` ${code} `))
      console.log('\nMasukkan di WhatsApp')
    } catch (e) {
      console.log('Pairing gagal:', e.message)
      process.exit(0)
    }
  })
}

/* ================= MENU ================= */
function mainMenu() {
  header('Status: ONLINE')
  console.log('[1] Test Kirim ke Diri Sendiri')
  console.log('[2] Keluar')

  rl.on('line', async (l) => {
    if (l === '1') {
      await sock.sendMessage(sock.user.id, { text: 'TEST OK' })
      console.log('Pesan terkirim')
    }
    if (l === '2') process.exit(0)
  })
}

/* ================= START ================= */
start()
