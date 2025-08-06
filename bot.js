require('dotenv').config();
const { App } = require('@slack/bolt');
const express = require('express');
const fs = require('fs');
const path = require('path');

const { launchAndJoin, shutdown, toggleMute, toggleAudioOutput, toggleStream, setStates } = require('./audioManager');
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const SLACK_APP_TOKEN = process.env.SLACK_APP_TOKEN;
const PORT = process.env.PORT || 3001;
const CHANNEL_ID = process.env.SLACK_CHANNEL_ID;

let isMuted = true;
let isStreamActive = false;
let isAudioOutputEnabled = false;

const app = new App({
  token: SLACK_BOT_TOKEN,
  socketMode: true,
  appToken: SLACK_APP_TOKEN
});
const serverApp = express();
serverApp.use(express.json());

serverApp.get('/', (req, res) => {
  res.send(`
    <html>
      <head>
        <title>Huddle Camera Stream</title>
      </head>
      <body>
        <h1>Huddle Camera Stream Ready O_O </h1>
        <a href="https://deployor.dev">Made by deployor.dev</a>
      </body>
    </html>
  `);
});

serverApp.get('/amazon-chime-sdk.min.js', (req, res) => {
  const sdkPath = path.join(__dirname, 'amazon-chime-sdk/utils/singlejs/build/amazon-chime-sdk.min.js');
  fs.readFile(sdkPath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/javascript' });
    res.end(data);
  });
});

serverApp.get('/oop.png', (req, res) => {
  const imgPath = path.join(__dirname, 'oop.png');
  fs.readFile(imgPath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'image/png' });
    res.end(data);
  });
});

serverApp.post('/toggle-mute', async (req, res) => {
  const { muted } = req.body;
  isMuted = muted;
  await toggleMute(muted);
  res.sendStatus(200);
});

serverApp.post('/toggle-stream', async (req, res) => {
  const { active } = req.body;
  isStreamActive = active;
  await toggleStream(active);
  res.sendStatus(200);
});

serverApp.post('/toggle-audio-output', async (req, res) => {
  const { enabled } = req.body;
  isAudioOutputEnabled = enabled;
  await toggleAudioOutput(enabled);
  res.sendStatus(200);
});

serverApp.post('/restart', async (req, res) => {
  await initStream();
  res.sendStatus(200);
});

serverApp.get('/get-states', (req, res) => {
  res.json({ muted: isMuted, streamActive: isStreamActive, audioOutputEnabled: isAudioOutputEnabled });
});

serverApp.get('/messages', (req, res) => {
  res.json(recentMessages);
});

serverApp.get('/chat', (req, res) => {
  res.send(`
    <html>
      <head>
        <title>Huddle Chat</title>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
        <style>
          body { background: black; color: white; font-family: Arial; margin: 0; padding: 0; font-size: 12px; }
          #chat { height: calc(100vh - 120px); overflow-y: auto; border: 1px solid white; padding: 5px; box-sizing: border-box; }
          .message { margin-bottom: 5px; }
          .user { font-weight: bold; }
          .button { cursor: pointer; margin-left: 5px; font-size: 16px; }
          #bottom-bar { position: fixed; bottom: 0; left: 0; width: 100%; background: #333; padding: 20px; display: flex; justify-content: space-evenly; box-sizing: border-box; }
          .icon-button { font-size: 36px; margin: 0 2px; padding: 20px; cursor: pointer; }
        </style>
      </head>
      <body>
        <div id="chat"></div>
        <div id="bottom-bar">
          <i id="mute-btn" class="fas fa-microphone-slash icon-button" onclick="toggleMute()"></i>
          <i id="stream-btn" class="fas fa-video-slash icon-button" onclick="toggleStream()"></i>
          <i id="audio-btn" class="fas fa-volume-off icon-button" onclick="toggleAudioOutput()"></i>
          <i id="restart-btn" class="fas fa-sync-alt icon-button" onclick="restart()" style="color: white;"></i>
        </div>
        <div id="loading" style="display: none; position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 50px; color: white;">
          <i class="fas fa-spinner fa-spin"></i>
        </div>
        <script>
          const pastelColors = [
            '#EC3750', // Red
            '#FF8C37', // Orange
            '#F1C40F', // Yellow
            '#33D6A6', // Green
            '#5BC0DE', // Cyan
            '#338EDA', // Blue
            '#A633D6', // Purple
          ];
          const userColors = {};

          function getUserColor(username) {
            if (!userColors[username]) {
              userColors[username] = pastelColors[Math.floor(Math.random() * pastelColors.length)];
            }
            return userColors[username];
          }

          let lastTs = 0;
          function fetchMessages() {
            fetch('/messages')
              .then(res => res.json())
              .then(messages => {
                const chat = document.getElementById('chat');
                messages.forEach(msg => {
                  if (parseFloat(msg.ts) > lastTs) {
                    const div = document.createElement('div');
                    div.className = 'message';
                    const userSpan = document.createElement('span');
                    userSpan.className = 'user';
                    userSpan.textContent = msg.user + ':';
                    userSpan.style.color = getUserColor(msg.user);
                    div.appendChild(userSpan);
                    div.appendChild(document.createTextNode(' ' + msg.text));
                    chat.appendChild(div);
                    lastTs = parseFloat(msg.ts);
                  }
                });
                chat.scrollTo({ top: chat.scrollHeight, behavior: 'smooth' });
              });
          }
          setInterval(fetchMessages, 1000);
          fetchMessages();

          let isMuted = localStorage.getItem('muted') === 'true';
          let isStreamActive = localStorage.getItem('streamActive') === 'true';
          let isAudioOutputEnabled = localStorage.getItem('audioOutput') === 'true';

          let isLoading = false;

          function disableButtons() {
            isLoading = true;
            document.getElementById('loading').style.display = 'block';
            const buttons = document.querySelectorAll('.icon-button');
            buttons.forEach(btn => {
              btn.style.opacity = '0.5';
              btn.style.pointerEvents = 'none';
            });
            setTimeout(() => {
              isLoading = false;
              document.getElementById('loading').style.display = 'none';
              buttons.forEach(btn => {
                btn.style.opacity = '1';
                btn.style.pointerEvents = 'auto';
              });
              updateButtons();
            }, 2000);
          }

          async function loadStates() {
            const res = await fetch('/get-states');
            const states = await res.json();
            isMuted = states.muted;
            isStreamActive = states.streamActive;
            isAudioOutputEnabled = states.audioOutputEnabled;
            localStorage.setItem('muted', isMuted);
            localStorage.setItem('streamActive', isStreamActive);
            localStorage.setItem('audioOutput', isAudioOutputEnabled);
            updateButtons();
          }
          loadStates();

          function updateButtons() {
            const muteBtn = document.getElementById('mute-btn');
            const streamBtn = document.getElementById('stream-btn');
            const audioBtn = document.getElementById('audio-btn');

            if (isMuted) {
              muteBtn.className = 'fas fa-microphone-slash icon-button';
              muteBtn.style.color = 'red';
            } else {
              muteBtn.className = 'fas fa-microphone icon-button';
              muteBtn.style.color = 'green';
            }

            if (isStreamActive) {
              streamBtn.className = 'fas fa-video icon-button';
              streamBtn.style.color = 'green';
            } else {
              streamBtn.className = 'fas fa-video-slash icon-button';
              streamBtn.style.color = 'red';
            }

            if (isAudioOutputEnabled) {
              audioBtn.className = 'fas fa-volume-up icon-button';
              audioBtn.style.color = 'green';
            } else {
              audioBtn.className = 'fas fa-volume-off icon-button';
              audioBtn.style.color = 'red';
            }
          }

          async function toggleMute() {
            if (isLoading) return;
            disableButtons();
            isMuted = !isMuted;
            localStorage.setItem('muted', isMuted);
            await fetch('/toggle-mute', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ muted: isMuted }) });
          }

          async function toggleStream() {
            if (isLoading) return;
            disableButtons();
            isStreamActive = !isStreamActive;
            localStorage.setItem('streamActive', isStreamActive);
            await fetch('/toggle-stream', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: isStreamActive }) });
          }

          async function toggleAudioOutput() {
            if (isLoading) return;
            disableButtons();
            isAudioOutputEnabled = !isAudioOutputEnabled;
            localStorage.setItem('audioOutput', isAudioOutputEnabled);
            await fetch('/toggle-audio-output', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: isAudioOutputEnabled }) });
          }

          async function restart() {
            if (isLoading) return;
            disableButtons();
            await fetch('/restart', { method: 'POST' });
          }
        </script>
      </body>
    </html>
  `);
});


async function initStream() {
  try {
    const { joinHuddle } = require('./huddleUtils');
    await shutdown();
    currentThreadTs = null;
    const { meeting, attendee, thread_ts } = await joinHuddle(CHANNEL_ID);
    currentThreadTs = thread_ts;
    await launchAndJoin(meeting, attendee, initStream);
    await setStates({ muted: isMuted, streamActive: isStreamActive, audioOutputEnabled: isAudioOutputEnabled });
  } catch (error) {
    console.error('Error in initStream:', error);
    setTimeout(initStream, 5000);
  }
}

initStream();



app.event('app_mention', async ({ ack }) => {
  ack();
});

const recentMessages = [];
let currentThreadTs;

app.event('message', async ({ event, client }) => {
  if (event.subtype === 'message_changed') {
    return;
  }
  if (event.channel === CHANNEL_ID && event.thread_ts === currentThreadTs) {
    try {
      const user = await client.users.info({ user: event.user });
      const message = {
        user: user.user.profile.real_name || user.user.name,
        text: event.text,
        ts: event.ts
      };
      recentMessages.push(message);
      if (recentMessages.length > 10) recentMessages.shift();
    } catch (error) {
      console.error('Error fetching user info:', error);
    }
  }
});

(async () => {
  await app.start();
  app.start();

serverApp.listen(PORT);

const { firefox } = require('playwright');
(async () => {
  await new Promise(resolve => setTimeout(resolve, 3000));

  const browser = await firefox.launch({
    headless: false
  });

  const context = await browser.newContext({
    viewport: { width: 480, height: 320 }
  });
  const page = await context.newPage();

  await page.goto(`http://localhost:${PORT}/chat`);

  await new Promise(resolve => setTimeout(resolve, 7000));

  await page.evaluate(() => document.documentElement.requestFullscreen());
})();
})();