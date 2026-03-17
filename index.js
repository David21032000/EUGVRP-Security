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

// Configurații fixe din promptul tău
const LOGS_CHANNEL_ID = '1391846238454026341';
const ROLES = {
    SUPPORT: '1391845825654554654',
    OWNER: '1392039780149362779',
    SHADOWBANNED: '1483358761090289695'
};
const COLORS = { RED: 0xFF0000, YELLOW: 0xFFFF00, GREEN: 0x00FF00 };

// Memorie temporară
const memoryDb = {
    antiLink: true,
    joinTracker: [],
    spamTracker: new Map()
};

// Functie Loguri
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
        .setFooter({ text: 'EUGVRP Security' });
    await channel.send({ embeds: [embed] }).catch(() => {});
}

// Comenzi Slash
const commands = [
    { name: 'kick', description: 'Scoate un user (Owner)', options: [{ name: 'user', type: 6, required: true }, { name: 'motiv', type: 3 }] },
    { name: 'ban', description: 'Fake ban (Restrictie acces)', options: [{ name: 'user', type: 6, required: true }, { name: 'motiv', type: 3 }] },
    { name: 'shadowban', description: 'Elimină roluri + Rol Banat', options: [{ name: 'user', type: 6, required: true }, { name: 'motiv', type: 3 }] },
    { name: 'lockdown', description: 'Blochează serverul' },
    { name: 'unlock', description: 'Deblochează serverul' },
    { name: 'clear', description: 'Șterge mesaje', options: [{ name: 'numar', type: 4, required: true }] },
    { name: 'antilink', description: 'ON/OFF Anti-Link', options: [{ name: 'status', type: 5, required: true }] }
];

client.once(Events.ClientReady, async () => {
    console.log(`✅ Logat ca ${client.user.tag}`);
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
        console.log('✅ Comenzi înregistrate!');
    } catch (e) { console.error(e); }
});

client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;
    const { commandName, options, member, guild } = interaction;
    const isOwner = member.roles.cache.has(ROLES.OWNER) || guild.ownerId === member.id;
    const isSupport = member.roles.cache.has(ROLES.SUPPORT) || isOwner;

    if (commandName === 'shadowban') {
        if (!isSupport) return interaction.reply({ content: '❌ Permisiuni insuficiente!', ephemeral: true });
        const target = options.getMember('user');
        const reason = options.getString('motiv') || 'Shadowban aplicat';
        try {
            await target.roles.set([ROLES.SHADOWBANNED]);
            await sendLog(guild, 'Shadowban', COLORS.RED, target.user, member.user, reason);
            interaction.reply(`🌑 **${target.user.tag}** a fost shadowbanned.`);
        } catch (e) { interaction.reply('Eroare la modificarea rolurilor!'); }
    }
    
    if (commandName === 'kick') {
        if (!isOwner) return interaction.reply('❌ Doar Owner-ul poate da kick!');
        const target = options.getMember('user');
        await target.kick();
        await sendLog(guild, 'Kick', COLORS.RED, target.user, member.user, 'Comandă manuală');
        interaction.reply(`✅ Kick executat pe ${target.user.tag}.`);
    }

    if (commandName === 'lockdown') {
        if (!isOwner) return interaction.reply('❌ Doar Owner!');
        await guild.roles.everyone.setPermissions([PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory]);
        interaction.reply('🔒 Server blocat!');
    }

    if (commandName === 'unlock') {
        if (!isOwner) return interaction.reply('❌ Doar Owner!');
        await guild.roles.everyone.setPermissions([PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory]);
        interaction.reply('🔓 Server deblocat!');
    }
});

// Anti-Link & Anti-Spam
client.on(Events.MessageCreate, async msg => {
    if (msg.author.bot || !msg.guild) return;
    if (memoryDb.antiLink && /(https?:\/\/|discord\.gg\/)/g.test(msg.content) && !msg.member.roles.cache.has(ROLES.SUPPORT)) {
        await msg.delete().catch(() => {});
        return msg.channel.send(`⚠️ ${msg.author}, link-urile interzise!`).then(m => setTimeout(() => m.delete(), 2000));
    }
});

// Anti-Bot & Anti-Raid
client.on(Events.GuildMemberAdd, async member => {
    if (member.user.bot) return member.kick('Anti-Bot System');
    const now = Date.now();
    memoryDb.joinTracker.push(now);
    memoryDb.joinTracker = memoryDb.joinTracker.filter(t => now - t < 10000);
    if (memoryDb.joinTracker.length > 10) {
        await member.kick('Anti-Raid Protection');
        sendLog(member.guild, '🚨 RAID DETECTAT', COLORS.RED, member.user, null, 'Join masiv!');
    }
});

client.login(process.env.DISCORD_TOKEN);
