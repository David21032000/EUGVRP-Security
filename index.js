require('dotenv').config();
const { 
    Client, GatewayIntentBits, Partials, EmbedBuilder, PermissionsBitField, 
    REST, Routes, Events, ActivityType 
} = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ]
});

// ==========================================
// ⚙️ CONFIGURAȚIE ȘI ID-URI
// ==========================================
const LOGS_CHANNEL_ID = '1391846238454026341';
const ROLES = {
    SUPPORT: '1391845825654554654',
    OWNER: '1392039780149362779',
    SHADOWBANNED: '1483358761090289695',
    CITIZEN: '1392137321846935712' // Rolul pe care îl primește înapoi
};
const COLORS = { RED: 0xFF0000, YELLOW: 0xFFFF00, GREEN: 0x00FF00, BLUE: 0x0099FF };

// Memorie temporară pentru sisteme de protecție
const memoryDb = {
    joinTracker: [],
    spamTracker: new Map(),
    actionLogs: [] // Ultimele 10 actiuni pentru /logs
};

// ==========================================
// 📊 SISTEM DE LOG-URI PROFESIONAL
// ==========================================
async function sendLog(guild, action, color, user, moderator, reason) {
    const channel = guild.channels.cache.get(LOGS_CHANNEL_ID);
    if (!channel) return;
    
    const embed = new EmbedBuilder()
        .setTitle(`🛡️ EUGVRP Security | ${action}`)
        .setColor(color)
        .setThumbnail(user.displayAvatarURL?.({ dynamic: true }) || null)
        .addFields(
            { name: '👤 Utilizator', value: `${user} (\`${user.id}\`)`, inline: true },
            { name: '👮 Moderator', value: moderator ? `${moderator.tag}` : 'Sistem Automat', inline: true },
            { name: '📝 Motiv', value: reason || 'Nespecificat', inline: false }
        )
        .setTimestamp()
        .setFooter({ text: 'EUGVRP Security System', iconURL: guild.iconURL() });
        
    // Salvează în memorie pentru comanda /logs
    memoryDb.actionLogs.unshift(`\`[${new Date().toLocaleTimeString()}]\` **${action}** -> ${user.tag} (Motiv: ${reason})`);
    if (memoryDb.actionLogs.length > 15) memoryDb.actionLogs.pop();

    await channel.send({ embeds: [embed] }).catch(() => {});
}

// ==========================================
// 🚀 DEFINIRE COMENZI SLASH
// ==========================================
const commands = [
    { 
        name: 'kick', description: 'Scoate un utilizator (Doar Owner)', 
        options: [
            { name: 'user', type: 6, description: 'Utilizatorul vizat', required: true }, 
            { name: 'motiv', type: 3, description: 'Motivul', required: false }
        ] 
    },
    { 
        name: 'ban', description: 'Fake Ban - Izolare totală (Timeout 28 zile)', 
        options: [
            { name: 'user', type: 6, description: 'Utilizatorul vizat', required: true }, 
            { name: 'motiv', type: 3, description: 'Motivul', required: false }
        ] 
    },
    { 
        name: 'shadowban', description: 'Trimite pe cineva în shadowban pentru un anumit timp', 
        options: [
            { name: 'user', type: 6, description: 'Utilizatorul vizat', required: true }, 
            { name: 'minute', type: 4, description: 'Timpul în minute (ex: 60)', required: true },
            { name: 'motiv', type: 3, description: 'Motivul', required: false }
        ] 
    },
    { name: 'lockdown', description: 'Blochează chat-ul pe tot serverul' },
    { name: 'unlock', description: 'Deblochează chat-ul pe server' },
    { 
        name: 'clear', description: 'Șterge mesaje dintr-un canal', 
        options: [{ name: 'numar', type: 4, description: 'Număr mesaje (1-100)', required: true }] 
    },
    { 
        name: 'slowmode', description: 'Setează delay pe chat-ul curent', 
        options: [{ name: 'secunde', type: 4, description: 'Timp în secunde (0 pt dezactivare)', required: true }] 
    },
    { 
        name: 'userinfo', description: 'Vezi informații detaliate despre un jucător',
        options: [{ name: 'user', type: 6, description: 'Utilizatorul', required: false }]
    },
    { name: 'serverinfo', description: 'Statistici despre serverul EUGVRP' },
    { name: 'logs', description: 'Vezi istoricul recent de securitate' }
];

client.once(Events.ClientReady, async () => {
    console.log(`✅ Logat ca ${client.user.tag}`);
    client.user.setActivity('EUGVRP Roleplay', { type: ActivityType.Watching });

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
        console.log('✅ Comenzi încărcate și optimizate!');
    } catch (e) { console.error('Eroare la comenzi:', e); }
});

// ==========================================
// 🛠️ EXECUTAREA COMENZILOR
// ==========================================
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;
    const { commandName, options, member, guild } = interaction;
    
    // Verificări permisiuni
    const isOwner = member.roles.cache.has(ROLES.OWNER) || guild.ownerId === member.id;
    const isSupport = member.roles.cache.has(ROLES.SUPPORT) || isOwner;

    try {
        // --- SHADOWBAN (Timp + DM) ---
        if (commandName === 'shadowban') {
            if (!isSupport) return interaction.reply({ content: '❌ Permisiuni insuficiente!', ephemeral: true });
            
            const target = options.getMember('user');
            const minutes = options.getInteger('minute');
            const reason = options.getString('motiv') || 'Încălcarea regulamentului';

            if (!target) return interaction.reply({ content: '❌ User invalid!', ephemeral: true });

            // Setăm DOAR rolul de shadowban (restul dispar)
            await target.roles.set([ROLES.SHADOWBANNED]);
            
            // Trimite DM că a primit shadowban
            const dmEmbedBan = new EmbedBuilder()
                .setTitle('🌑 Ai primit Shadowban pe EUGVRP')
                .setColor(COLORS.RED)
                .setDescription(`Ai fost sancționat cu Shadowban pentru **${minutes} minute**.\n**Motiv:** ${reason}`);
            await target.send({ embeds: [dmEmbedBan] }).catch(() => {}); // catch pt cand are DM oprite

            await sendLog(guild, `Shadowban (${minutes}m)`, COLORS.RED, target.user, member.user, reason);
            await interaction.reply(`🌑 **${target.user.tag}** a fost trimis în Shadowban pentru ${minutes} minute.`);

            // Timer pentru expirare
            setTimeout(async () => {
                try {
                    // Când expiră, îi dăm DOAR cetățean
                    const currentMember = await guild.members.fetch(target.id);
                    if (currentMember.roles.cache.has(ROLES.SHADOWBANNED)) {
                        await currentMember.roles.set([ROLES.CITIZEN]);
                        
                        // Trimite DM de eliberare
                        const dmEmbedUnban = new EmbedBuilder()
                            .setTitle('🟢 Shadowban Expirat')
                            .setColor(COLORS.GREEN)
                            .setDescription('Shadowban-ul tău a expirat. Ai primit înapoi rolul de **Cetățean** și te poți întoarce pe chat!');
                        await currentMember.send({ embeds: [dmEmbedUnban] }).catch(() => {});
                        
                        await sendLog(guild, 'Shadowban Expirat', COLORS.GREEN, currentMember.user, client.user, 'Timpul a expirat (Rol Cetățean acordat)');
                    }
                } catch (err) {
                    console.error("Eroare la expirare shadowban:", err);
                }
            }, minutes * 60 * 1000);
            return;
        }

        // --- COMENZI DE MODERARE CLASICE ---
        if (commandName === 'kick') {
            if (!isOwner) return interaction.reply({ content: '❌ Doar Owner-ul poate da kick!', ephemeral: true });
            const target = options.getMember('user');
            const reason = options.getString('motiv') || 'Comandă manuală';
            await target.kick(reason);
            await sendLog(guild, 'Kick', COLORS.RED, target.user, member.user, reason);
            return interaction.reply(`✅ Kick executat pe ${target.user.tag}.`);
        }

        if (commandName === 'ban') {
            if (!isOwner) return interaction.reply({ content: '❌ Doar Owner-ul poate folosi asta!', ephemeral: true });
            const target = options.getMember('user');
            const reason = options.getString('motiv') || 'Fake Ban (Izolare)';
            await target.timeout(28 * 24 * 60 * 60 * 1000, reason); // Max timeout Discord (28 zile)
            await sendLog(guild, 'Fake Ban (28 Zile)', COLORS.RED, target.user, member.user, reason);
            return interaction.reply(`✅ ${target.user.tag} a fost izolat total (Timeout 28 zile).`);
        }

        if (commandName === 'clear') {
            if (!isSupport) return interaction.reply({ content: '❌ Permisiuni insuficiente!', ephemeral: true });
            const num = options.getInteger('numar');
            await interaction.channel.bulkDelete(num, true);
            return interaction.reply({ content: `🧹 Au fost șterse ${num} mesaje.`, ephemeral: true });
        }

        if (commandName === 'slowmode') {
            if (!isSupport) return interaction.reply({ content: '❌ Permisiuni insuficiente!', ephemeral: true });
            const sec = options.getInteger('secunde');
            await interaction.channel.setRateLimitPerUser(sec);
            return interaction.reply(`⏳ Slowmode setat la **${sec} secunde**.`);
        }

        // --- LOCKDOWN SERVER ---
        if (commandName === 'lockdown') {
            if (!isOwner) return interaction.reply({ content: '❌ Doar Owner!', ephemeral: true });
            await guild.roles.everyone.setPermissions([PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory]);
            return interaction.reply('🔒 **SERVER LOCKDOWN** - Nimeni nu mai poate trimite mesaje pe server.');
        }

        if (commandName === 'unlock') {
            if (!isOwner) return interaction.reply({ content: '❌ Doar Owner!', ephemeral: true });
            await guild.roles.everyone.setPermissions([PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory]);
            return interaction.reply('🔓 **SERVER UNLOCKED** - Chat-ul este din nou disponibil.');
        }

        // --- INFORMAȚII & UTILITĂȚI (Comenzi Noi Misto) ---
        if (commandName === 'userinfo') {
            const target = options.getMember('user') || member;
            const embed = new EmbedBuilder()
                .setColor(COLORS.BLUE)
                .setAuthor({ name: target.user.tag, iconURL: target.user.displayAvatarURL() })
                .setThumbnail(target.user.displayAvatarURL({ dynamic: true, size: 512 }))
                .addFields(
                    { name: '🆔 ID Cont', value: target.id, inline: true },
                    { name: '📅 Cont Creat', value: `<t:${Math.floor(target.user.createdTimestamp / 1000)}:R>`, inline: true },
                    { name: '📥 Membru Din', value: `<t:${Math.floor(target.joinedTimestamp / 1000)}:R>`, inline: true },
                    { name: `🎭 Roluri [${target.roles.cache.size - 1}]`, value: target.roles.cache.filter(r => r.id !== guild.id).map(r => r).join(', ') || 'Fără roluri', inline: false }
                )
                .setFooter({ text: 'EUGVRP Database' });
            return interaction.reply({ embeds: [embed] });
        }

        if (commandName === 'serverinfo') {
            const embed = new EmbedBuilder()
                .setColor(COLORS.BLUE)
                .setTitle(`📊 Informații Server: ${guild.name}`)
                .setThumbnail(guild.iconURL({ dynamic: true }))
                .addFields(
                    { name: '👑 Owner', value: `<@${guild.ownerId}>`, inline: true },
                    { name: '👥 Membrii Total', value: `${guild.memberCount}`, inline: true },
                    { name: '📅 Creat La', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true },
                    { name: '🛡️ Nivel Securitate', value: 'Maxim (Protejat de EUGVRP Bot)', inline: false }
                );
            return interaction.reply({ embeds: [embed] });
        }

        if (commandName === 'logs') {
            if (!isSupport) return interaction.reply({ content: '❌ Acces Respins!', ephemeral: true });
            const logText = memoryDb.actionLogs.length ? memoryDb.actionLogs.join('\n') : 'Nicio acțiune recentă.';
            const embed = new EmbedBuilder().setTitle('🧾 Ultimele Acțiuni de Securitate').setDescription(logText).setColor(COLORS.YELLOW);
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

    } catch (error) {
        console.error("Eroare executie comanda:", error);
        interaction.reply({ content: 'A apărut o eroare la executarea comenzii!', ephemeral: true }).catch(()=>{});
    }
});

// ==========================================
// 🛡️ SISTEME AUTOMATE (Mereu Active)
// ==========================================

// ANTI-BOT & ANTI-RAID
client.on(Events.GuildMemberAdd, async member => {
    // 1. Anti-Bot
    if (member.user.bot) {
        await member.kick('Sistem Anti-Bot Activ');
        return sendLog(member.guild, 'Tentativă Bot Adăugat', COLORS.RED, member.user, null, 'Un bot neautorizat a fost respins automat.');
    }

    // 2. Anti-Raid (Peste 10 join-uri în 10 secunde)
    const now = Date.now();
    memoryDb.joinTracker.push(now);
    memoryDb.joinTracker = memoryDb.joinTracker.filter(t => now - t < 10000);

    if (memoryDb.joinTracker.length > 10) {
        await member.kick('Protecție Anti-Raid');
        sendLog(member.guild, '🚨 RAID DETECTAT', COLORS.RED, member.user, null, 'Prea mulți utilizatori s-au conectat simultan. S-a dat kick de siguranță.');
    }
});

// ANTI-SPAM, ANTI-LINK & ANTI-MASS-MENTION
client.on(Events.MessageCreate, async message => {
    if (message.author.bot || !message.guild) return;
    const isStaff = message.member.roles.cache.has(ROLES.SUPPORT) || message.member.roles.cache.has(ROLES.OWNER) || message.guild.ownerId === message.author.id;

    if (!isStaff) {
        // 1. Anti-Link (discord.gg, http, https)
        if (/(https?:\/\/|discord\.gg\/)/ig.test(message.content)) {
            await message.delete().catch(() => {});
            return message.channel.send(`⚠️ ${message.author}, reclamă și link-urile sunt interzise pe server!`).then(m => setTimeout(() => m.delete(), 4000));
        }

        // 2. Anti-Mass-Mention (Dacă menționează mai mult de 4 persoane deodată)
        if (message.mentions.users.size > 4) {
            await message.delete().catch(() => {});
            await message.member.timeout(5 * 60 * 1000, 'Mass Mention (Anti-Spam)'); // Timeout 5 min
            sendLog(message.guild, 'Mass Mention Spam', COLORS.YELLOW, message.author, null, `A menționat ${message.mentions.users.size} persoane.`);
            return message.channel.send(`🔇 ${message.author} a primit timeout 5 minute pentru abuz de mențiuni.`);
        }

        // 3. Anti-Spam (Flood de mesaje - 6 mesaje în 5 secunde)
        const authorId = message.author.id;
        const now = Date.now();
        if (!memoryDb.spamTracker.has(authorId)) memoryDb.spamTracker.set(authorId, []);
        
        const timestamps = memoryDb.spamTracker.get(authorId);
        timestamps.push(now);
        const recentMessages = timestamps.filter(t => now - t < 5000);
        memoryDb.spamTracker.set(authorId, recentMessages);

        if (recentMessages.length > 5) {
            await message.member.timeout(60 * 1000, 'Spam în chat'); // Mute 1 min
            await sendLog(message.guild, 'Spam Chat', COLORS.YELLOW, message.author, null, 'Flood de mesaje blocat.');
            message.channel.send(`🔇 ${message.author} a primit Mute 1 minut pentru Spam.`).then(m => setTimeout(() => m.delete(), 5000));
            memoryDb.spamTracker.set(authorId, []); // Curăță trackerul pentru el ca să nu primească în loop
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
