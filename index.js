const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  delay
} = require('@whiskeysockets/baileys')

const pino = require('pino')
const readline = require('readline')
const chalk = require('chalk')

const sessionName = 'auth_session'
let sock
let rl
let isPairing = false
let isConnected = false

let blastData = {
  message: '',
  numbers: []
}

/* ================== READLINE CORE ================== */
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

function ask(q) {
  return new Promise(res => rl.question(q, ans => res(ans)))
}

/* ================== UI ================== */
function header() {
  if (isPairing) return
  console.clear()
  console.log(chalk.green.bold('========================================='))
  console.log(chalk.cyan.bold('     ⚡ OMENG BLASTER : STABLE MODE ⚡    '))
  console.log(chalk.yellow('     Status: Fixed | No Ghost Enter      '))
  console.log(chalk.green.bold('========================================='))
}

/* ================== CONNECT ================== */
async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState(sessionName)

  sock = makeWASocket({
    logger: pino({ level: 'silent' }),
    auth: state,
    browser: ['Windows', 'Chrome', '120'],
    keepAliveIntervalMs: 15000,
    connectTimeoutMs: 60000
  })

  sock.ev.on('creds.update', saveCreds)

  if (!state.creds.me) {
    isPairing = true
    initRL()
    console.clear()
    console.log(chalk.cyan.bold('=== WA PAIRING MODE ==='))

    const num = await ask(chalk.yellow('Masukkan Nomor WA (628xxxx): '))
    const clean = num.replace(/\D/g, '')

    console.log(chalk.gray('Mengambil kode pairing...'))
    await delay(3000)

    try {
      let code = await sock.requestPairingCode(clean)
      code = code.match(/.{1,4}/g).join('-')

      console.log(chalk.green.bold('\nKODE PAIRING:'))
      console.log(chalk.bgGreen.black.bold(` ${code} `))
      console.log(chalk.white('\nWA > Perangkat Tertaut > Tautkan dg Nomor'))
    } catch (e) {
      console.log(chalk.red('Gagal pairing:', e.message))
      process.exit(0)
    }
  }

  sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
    if (connection === 'open') {
      isPairing = false
      isConnected = true
      MenuUtama()
    }

    if (connection === 'close') {
      const reason = lastDisconnect?.error?.output?.statusCode
      if (reason !== DisconnectReason.loggedOut) {
        connectToWhatsApp()
      } else {
        console.log('Logout. Hapus session.')
        process.exit(0)
      }
    }
  })
}

/* ================== MENU ================== */
function MenuUtama() {
  if (!isConnected) return
  initRL()
  header()
  console.log(chalk.green('Status: ONLINE'))
  console.log('[1] Mulai Blast')
  console.log('[2] Keluar')
  rl.on('line', l => {
    if (l === '1') InputPesan()
    if (l === '2') process.exit(0)
  })
}

function InputPesan() {
  initRL()
  header()
  console.log('Masukkan Pesan:')
  rl.on('line', l => {
    blastData.message = l.trim()
    if (blastData.message) InputNomor()
  })
}

function InputNomor() {
  initRL()
  blastData.numbers = []
  header()
  console.log(`Pesan: ${blastData.message}`)
  console.log('Paste nomor | ketik GAS untuk kirim')

  rl.on('line', l => {
    if (l.toUpperCase() === 'GAS') return EksekusiBlast()
    const n = l.replace(/\D/g, '')
    if (n.length > 6) {
      blastData.numbers.push(n)
      process.stdout.write('.')
    }
  })
}

async function EksekusiBlast() {
  initRL()
  console.log(`\nMengirim ${blastData.numbers.length} nomor...\n`)

  for (const n of blastData.numbers) {
    try {
      await sock.sendMessage(n + '@s.whatsapp.net', { text: blastData.message })
      console.log('✓', n)
      await delay(1500) // safety
    } catch {
      console.log('✗', n)
    }
  }

  console.log('\nSelesai. Enter kembali.')
  rl.once('line', MenuUtama)
}

/* ================== START ================== */
console.clear()
connectToWhatsApp()
