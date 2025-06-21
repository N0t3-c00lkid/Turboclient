const express = require('express');
const cors = require('cors');
const { Client, GatewayIntentBits } = require('discord.js');

const app = express();
app.use(cors());
app.use(express.json());

let messageCache = []; // Use let for re-assignment
let activeChannelId = null;

// Declare client outside to be able to re-assign it
let client = null; 

// Function to initialize the Discord client
function initializeDiscordClient() {
  client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  // Bot login status log
  client.once('ready', () => {
    console.log(`Bot ready as ${client.user.tag}`);
  });

  // Save messages from selected channel
  client.on('messageCreate', (message) => {
    // if (message.author.bot) return;
    if (!activeChannelId || message.channel.id !== activeChannelId) return;

    messageCache.push({
      author: message.author.username,
      content: message.content,
      timestamp: message.createdTimestamp,
    });

    if (messageCache.length > 50) messageCache.shift();
  });
}

// Initialize client on startup
initializeDiscordClient();

// ✅ NEW: Set token from client
app.post('/set-token', (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'No token provided' });

  // If client is already logged in, destroy it first to clear previous session
  if (client && client.isReady()) {
    client.destroy();
    console.log('Previous Discord client destroyed.');
    initializeDiscordClient(); // Re-initialize client for new token
  }

  client.login(token)
    .then(() => res.json({ status: 'logged in' }))
    .catch(err => res.status(500).json({ error: err.message }));
});

// ✅ NEW: Clear token (log out the bot)
app.post('/clear-token', (req, res) => {
  if (client && client.isReady()) {
    client.destroy(); // This will log out the bot
    console.log('Discord bot logged out and client destroyed.');
    
    // Optionally re-initialize the client so it's ready for a new token
    // without requiring a server restart.
    initializeDiscordClient(); 
    
    res.json({ status: 'token cleared', message: 'Discord bot logged out.' });
  } else {
    res.json({ status: 'no active token', message: 'Bot is not currently logged in.' });
  }
});

// Set the active channel
app.post('/set-channel', (req, res) => {
  const { channelId } = req.body;
  if (!channelId) return res.status(400).json({ error: 'Missing channelId' });

  if (!client || !client.isReady()) {
    return res.status(400).json({ error: 'Bot is not logged in. Please set a token first.' });
  }

  activeChannelId = channelId;
  console.log(`Now listening to channel: ${channelId}`);
  res.json({ status: 'ok', activeChannelId });
});

// Send a message
app.post('/send-message', async (req, res) => {
  const { channelId, message } = req.body;
  if (!client || !client.isReady()) {
    return res.status(400).json({ error: 'Bot is not logged in. Cannot send message.' });
  }
  try {
    const channel = await client.channels.fetch(channelId);
    await channel.send(message);
    res.json({ status: 'sent' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get all messages (||| split)
// message from creator: i changed it to <not a character> lolz
app.get('/get-messages', (req, res) => {
  const lines = messageCache.map(msg => `${msg.author}: ${msg.content}`);
  res.send(lines.join('􏿿'));
});

// ✅ Reset cached messages
app.post('/reset-messages', (req, res) => {
  messageCache.length = 0;
  res.json({ status: 'message cache cleared' });
});

// ✅ New: Get bot info (whoami)
app.get('/whoami', (req, res) => {
  if (!client || !client.user) {
    return res.json({
      status: 'offline',
      bot: null,
      activeChannelId,
    });
  }

  res.json({
    status: 'online',
    bot: client.user.username,
    activeChannelId,
  });
});

app.listen(3000, () => {
  console.log('Server listening on http://localhost:3000');
  console.log('Wait for token...');
});


