
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require('@whiskeysockets/baileys');

const readline = require('readline');
const pino = require('pino');

const emojis = [
  '❤️','😂','😍','🔥','👍','🥰','😘','😭',
  '🤣','😎','💯','👏','🙏','🤩','💚','💙',
  '💜','✨','🌹','🥳','😅','😁','🤝','⭐',
  '😢','😮','🙌','💪','🫶','😇'
];

let emojiIndex = 0;
let reconnecting = false;

async function startBot() {
  const { state, saveCreds } =
    await useMultiFileAuthState('./session');

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' })
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue;
      if (msg.key.remoteJid === 'status@broadcast') continue;

      const emoji = emojis[emojiIndex];
      emojiIndex = (emojiIndex + 1) % emojis.length;

      try {
        await sock.sendMessage(msg.key.remoteJid, {
          react: { text: emoji, key: msg.key }
        });
        console.log('Reaction:', emoji);
      } catch (e) {
        console.log('Error:', e.message);
      }
    }
  });

  sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
    if (connection === 'open') {
      reconnecting = false;
      console.log('HOSSAM PRO BOT ONLINE ❤️');
    }

    if (connection === 'close' && !reconnecting) {
      const code = lastDisconnect?.error?.output?.statusCode;

      if (code === DisconnectReason.loggedOut) {
        console.log('Session logged out. Pair again.');
        return;
      }

      reconnecting = true;
      console.log('Reconnecting...');

      setTimeout(() => {
        reconnecting = false;
        startBot().catch(console.error);
      }, 5000);
    }
  });

  if (!state.creds.registered) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const phone = await new Promise(resolve => {
      rl.question('Enter WhatsApp number with country code (967...): ', resolve);
    });

    rl.close();

    const number = phone.replace(/\D/g, '');
    const code = await sock.requestPairingCode(number);

    console.log('YOUR PAIRING CODE:', code);
    console.log('Enter it in WhatsApp Linked Devices.');
  }
}

startBot().catch(console.error);
