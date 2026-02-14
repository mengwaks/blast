/**
 * OMENG BLASTER - QR FIRST, FALLBACK PAIRING
 * SAFE EXTREME (queue + limited parallel)
 * Node.js + @whiskeysockets/baileys
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
// ⚠️ Jangan set ekstrem berlebihan
const SESSION_NAME = 'auth_session'
const QR_TIMEOUT_MS = 60_000          // 60 detik nunggu scan QR
const PARALLEL_SEND = 3               // paralel ringan (aman)
const BASE_DELAY_MS = 900              // jeda dasar
const JITTER_MS = 400                  // variasi acak
/* ========================================= */

let sock
let rl = null
let isPairing = false
let isConnected = false
let pairingRequested = false
let qrTimer = null

let blastData = { message: '', numbers: [] }

/* ================= READLINE ================= */
function initRL() {
  if (rl) { rl.removeAllListeners(); rl.close() }
  rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true
  })
}
const ask = q => new Promise(res => rl.question(q, res))

/* ================= UI ================= */
function header() {
  if (isPairing) return
  console.clear()
  console.log(chalk.green.bold('========================================='))
  console.log(chalk.cyan.bold('   ⚡ OMENG BLASTER : QR ➜ PAIRING ⚡    '))
  console.log(chalk.yellow('   Safe Extreme | Queue + Parallel       '))
  console.log(chalk.green.bold('========================================='))
}

/* ================= CONNECT ================= */
async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState(SESSION_NAME)

  sock = makeWASocket({
    logger: pino({ level: 'silent' }),
    auth: state,
    browser: ['Windows', 'Chrome', '120'],
    keepAliveIntervalMs: 15000,
    connectTimeoutMs: 60000,
    defaultQueryTimeoutMs: 0
  })

  sock.ev.on('creds.update', saveCreds)

  // ===== QR HANDLER =====
  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (qr && !isConnected && !pairingRequested) {
      // tampilkan QR dulu
      console.clear()
      console.log(chalk.cyan.bold('=== SCAN QR WHATSAPP ==='))
      qrcode.generate(qr, { small: true })
      console.log(chalk.gray(`Menunggu scan QR (${QR_TIMEOUT_MS/1000}s)...`))

      if (qrTimer) clearTimeout(qrTimer)
      qrTimer = setTimeout(async () => {
        // QR timeout → fallback pairing
        if (!isConnected && !pairingRequested) {
          pairingRequested = true
          await startPairingFallback()
        }
      }, QR_TIMEOUT_MS)
    }

    if (connection === 'open') {
      if (qrTimer) clearTimeout(qrTimer)
      isConnected = true
      isPairing = false
      MenuUtama()
    }

    if (connection === 'close') {
      if (isPairing) return
      const reason = lastDisconnect?.error?.output?.statusCode
      if (reason !== DisconnectReason.loggedOut) {
        console.log(chalk.yellow('Reconnect...'))
        connectToWhatsApp()
      } else {
        console.log(chalk.red('Logout. Hapus auth_session.'))
        process.exit(0)
      }
    }
  })
}

async function startPairingFallback() {
  isPairing = true
  initRL()
  console.clear()
  console.log(chalk.cyan.bold('=== FALLBACK PAIRING MANUAL ==='))

  const num = await ask('Masukkan Nomor WA (628xxxx): ')
  const clean = num.replace(/\D/g, '')

  try {
    const raw = await sock.requestPairingCode(clean)
    const code = raw.match(/.{1,4}/g).join('-')
    console.log(chalk.green.bold('\nKODE PAIRING:'))
    console.log(chalk.bgGreen.black.bold(` ${code} `))
    console.log('\nWA > Perangkat Tertaut > Tautkan dg Nomor')
  } catch (e) {
    console.log(chalk.red('Gagal pairing:'), e.message)
    process.exit(0)
  }
}

/* ================= MENU ================= */
function MenuUtama() {
  initRL()
  header()
  console.log(chalk.green('Status: ONLINE'))
  console.log('[1] Mulai Blast')
  console.log('[2] Keluar')
  process.stdout.write('> ')
  rl.on('line', l => {
    if (l.trim() === '1') InputPesan()
    if (l.trim() === '2') process.exit(0)
  })
}

function InputPesan() {
  initRL()
  header()
  console.log('Masukkan Pesan (1 baris):')
  process.stdout.write('> ')
  rl.on('line', l => {
    const msg = l.trim()
    if (!msg) return
    blastData.message = msg
    InputNomor()
  })
}

function InputNomor() {
  initRL()
  blastData.numbers = []
  header()
  console.log(`Pesan: ${chalk.cyan(blastData.message)}`)
  console.log('Paste nomor. Ketik GAS untuk kirim.\n')
  rl.on('line', l => {
    const t = l.trim()
    if (t.toUpperCase() === 'GAS') return EksekusiBlast()
    const n = t.replace(/\D/g, '')
    if (n.length >= 7) {
      blastData.numbers.push(n)
      process.stdout.write('.')
    }
  })
}

/* ================= BLAST (SAFE EXTREME) ================= */
async function EksekusiBlast() {
  initRL()
  if (!blastData.numbers.length) {
    console.log('Nomor kosong.')
    await delay(1000)
    return MenuUtama()
  }

  console.log(`\nMengirim ke ${blastData.numbers.length} nomor...\n`)

  let ok = 0, fail = 0
  const queue = [...blastData.numbers]

  async function worker() {
    while (queue.length) {
      const num = queue.shift()
      try {
        await sock.sendMessage(num + '@s.whatsapp.net', { text: blastData.message })
        ok++
        console.log(chalk.green('✓'), num)
      } catch {
        fail++
        console.log(chalk.red('✗'), num)
      }
      const jitter = Math.floor(Math.random() * JITTER_MS)
      await delay(BASE_DELAY_MS + jitter)
    }
  }

  const workers = Array.from({ length: PARALLEL_SEND }, worker)
  await Promise.all(workers)

  console.log('\n=== LAPORAN ===')
  console.log('SUKSES:', ok)
  console.log('GAGAL :', fail)
  console.log('\nTekan ENTER untuk kembali')
  rl.once('line', MenuUtama)
}

/* ================= START ================= */
process.on('SIGINT', () => process.exit(0))
console.clear()
connectToWhatsApp()
