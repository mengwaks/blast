/**
 * OMENG BLASTER
 * FIXED STARTUP BUG + QR FIRST + NO RECONNECT LOOP
 */

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  delay
} = require('@whiskeysockets/baileys')

const pino = require('pino')
const readline = require('readline')
const chalk = require('chalk')
const qrcode = require('qrcode-terminal')

/* ================= CONFIG ================= */
const SESSION_NAME = 'auth_session'
const QR_TIMEOUT_MS = 60_000
/* ========================================= */

let sock
let rl

// ===== STATE FLAGS =====
let state = 'INIT' // INIT | QR | PAIRING | READY
let hasShownQR = false
let canReconnect = false
let qrTimer = null

/* ================= READLINE ================= */
function initRL() {
  if (rl) {
    rl.removeAllListeners()
    rl.close()
  }
  rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true
  })
}
const ask = q => new Promise(r => rl.question(q, r))

/* ================= UI ================= */
function header() {
  console.clear()
  console.log(chalk.green.bold('========================================='))
  console.log(chalk.cyan.bold('     ⚡ OMENG BLASTER : STABLE ⚡        '))
  console.log(chalk.yellow(`     STATE: ${state}                    `))
  console.log(chalk.green.bold('========================================='))
}

/* ================= CONNECT ================= */
async function connectToWhatsApp() {
  const { state: auth, saveCreds } = await useMultiFileAuthState(SESSION_NAME)

  sock = makeWASocket({
    logger: pino({ level: 'silent' }),
    auth,
    browser: ['Windows', 'Chrome', '120'],
    connectTimeoutMs: 60000,
    keepAliveIntervalMs: 15000,
    defaultQueryTimeoutMs: 0
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', async (u) => {
    const { connection, qr, lastDisconnect } = u

    /* ===== QR HANDLER ===== */
    if (qr && !hasShownQR) {
      hasShownQR = true
      state = 'QR'
      header()
      console.log(chalk.cyan.bold('SCAN QR WHATSAPP'))
      qrcode.generate(qr, { small: true })

      qrTimer = setTimeout(async () => {
        if (state !== 'READY') {
          await startPairing()
        }
      }, QR_TIMEOUT_MS)
    }

    /* ===== OPEN ===== */
    if (connection === 'open') {
      if (qrTimer) clearTimeout(qrTimer)
      state = 'READY'
      canReconnect = true
      header()
      console.log(chalk.green('LOGIN BERHASIL'))
      MenuUtama()
    }

    /* ===== CLOSE ===== */
    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode

      // ⛔ STOP TOTAL sebelum login
      if (!canReconnect) return

      if (code !== DisconnectReason.loggedOut) {
        console.log(chalk.yellow('Reconnect...'))
        await delay(2000)
        connectToWhatsApp()
      } else {
        console.log(chalk.red('Logout. Hapus auth_session'))
        process.exit(0)
      }
    }
  })
}

/* ================= PAIRING ================= */
async function startPairing() {
  state = 'PAIRING'
  initRL()
  header()

  console.log(chalk.cyan.bold('QR GAGAL → PAIRING MANUAL'))

  const num = await ask('Masukkan Nomor WA (628xxxx): ')
  const clean = num.replace(/\D/g, '')

  try {
    const raw = await sock.requestPairingCode(clean)
    const code = raw.match(/.{1,4}/g).join('-')
    console.log(chalk.green.bold('\nKODE PAIRING:'))
    console.log(chalk.bgGreen.black.bold(` ${code} `))
  } catch (e) {
    console.log('Pairing gagal:', e.message)
    process.exit(0)
  }
}

/* ================= MENU ================= */
function MenuUtama() {
  initRL()
  header()
  console.log('[1] Test Kirim')
  console.log('[2] Keluar')
  process.stdout.write('> ')

  rl.on('line', async (l) => {
    if (l === '1') {
      await sock.sendMessage(sock.user.id, { text: 'TEST OK' })
      console.log('Terkirim ke diri sendiri')
    }
    if (l === '2') process.exit(0)
  })
}

/* ================= START ================= */
process.on('SIGINT', () => process.exit(0))
header()
connectToWhatsApp()
