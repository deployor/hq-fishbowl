const { firefox } = require('playwright');
const { join } = require('path');

let browser;
let page;
let meetingSession;
let onRestart;

async function launchAndJoin(meeting, attendee, restartCallback) {
  onRestart = restartCallback;
  if (browser) await browser.close();
  console.log('Waiting 1 sec before launching main browser...');
  await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 sec just in case
  browser = await firefox.launch({
    headless: true,
    firefoxUserPrefs: {
      'permissions.default.microphone': 1,
      'permissions.default.camera': 1
    },
    args: [
      '--no-sandbox',
      '--disable-web-security',
      '--autoplay-policy=no-user-gesture-required',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--single-process',
      '--no-zygote',
      '--disable-infobars',
      '--no-default-browser-check',
      '--no-first-run',
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream'
    ]
  });
  const context = await browser.newContext();
  await new Promise(resolve => setTimeout(resolve, 3000));
  page = await context.newPage();
  await page.setViewportSize({ width: 480, height: 320 });
  await page.goto('http://localhost:3001/');
  await new Promise(resolve => setTimeout(resolve, 2000));
  await page.addStyleTag({ url: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css' });
  await page.addScriptTag({ path: join(__dirname, 'amazon-chime-sdk.min.js') });
  await page.waitForFunction(() => typeof window.ChimeSDK !== 'undefined', { timeout: 10000 });
  await page.evaluate(({ m, a }) => {
    window.meeting = m;
    window.attendee = a;
  }, { m: meeting, a: attendee });
  await page.evaluate(async () => {
    const { MeetingSessionConfiguration, DefaultDeviceController, DefaultMeetingSession, ConsoleLogger, LogLevel, AudioProfile } = window.ChimeSDK;
    const logger = new ConsoleLogger('Logger', LogLevel.INFO);
    const deviceController = new DefaultDeviceController(logger, { enableWebAudio: true });
    const config = new MeetingSessionConfiguration(window.meeting, window.attendee);
    config.audioProfile = AudioProfile.fullbandMusicStereo();
    window.meetingSession = new DefaultMeetingSession(config, logger, deviceController);
    window.audioElement = document.createElement('audio');
    window.audioElement.autoplay = true;
    window.audioElement.muted = false;
    document.body.appendChild(window.audioElement);
    window.meetingSession.audioVideo.bindAudioElement(window.audioElement);
    window.deviceController = deviceController;
    window.isMuted = true;
    window.isStreamOn = true;
    window.showCamera = true;
    window.isAudioOutputEnabled = true;
    window.audioContext = new AudioContext();
    await window.audioContext.resume();
    window.audioDestination = window.audioContext.createMediaStreamDestination();
    await window.meetingSession.audioVideo.start();

    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioDevices = devices.filter(device => device.kind === 'audioinput');
    const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: { noiseSuppression: false, echoCancellation: false, autoGainControl: false, sampleRate: 48000, channelCount: 2 } });
    const initialAudioTrack = mediaStream.getAudioTracks()[0];
    window.videoElement = document.createElement('video');
    window.videoElement.srcObject = mediaStream;
    await window.videoElement.play();
    const initialVideoTrack = mediaStream.getVideoTracks()[0];
    window.audioSource = window.audioContext.createMediaStreamSource(mediaStream);
    window.gainNode = window.audioContext.createGain();
    window.gainNode.gain.value = 0;
    window.audioSource.connect(window.gainNode);
    window.isConnected = initialVideoTrack.enabled && !initialVideoTrack.muted && initialVideoTrack.readyState === 'live';
    window.gainNode.connect(window.audioDestination);

    window.canvas = document.createElement('canvas');
    window.canvas.width = 1920;
    window.canvas.height = 1080;
    window.ctx = window.canvas.getContext('2d');

    window.timeCanvas = document.createElement('canvas');
    window.timeCanvas.width = window.canvas.width;
    window.timeCanvas.height = window.canvas.height;
    window.timeCtx = window.timeCanvas.getContext('2d');

    window.iconCanvas = document.createElement('canvas');
    window.iconCanvas.width = window.canvas.width;
    window.iconCanvas.height = window.canvas.height;
    window.iconCtx = window.iconCanvas.getContext('2d');

    window.updateTime = () => {
      window.timeCtx.clearRect(0, 0, window.timeCanvas.width, window.timeCanvas.height);
      const now = new Date();
      const time24 = now.toLocaleTimeString('en-US', { hour12: false });
      const time12 = now.toLocaleTimeString('en-US', { hour12: true });
      window.timeCtx.fillStyle = 'white';
      window.timeCtx.font = '48px serif';
      window.timeCtx.fillText(`24h: ${time24}`, 50, 50);
      window.timeCtx.fillText(`12h: ${time12}`, 50, 100);
    };

    window.updateIcons = () => {
      window.iconCtx.clearRect(0, 0, window.iconCanvas.width, window.iconCanvas.height);
      const iconSize = 40;
      window.iconCtx.font = `900 ${iconSize}px "Font Awesome 6 Free"`;
      const rightX = window.canvas.width - 60;
      const iconYStart = 40;
      const iconSpacing = 50;
      let currentY = iconYStart;
      window.iconCtx.fillStyle = window.isMuted ? 'red' : 'green';
      window.iconCtx.fillText(window.isMuted ? '\uf131' : '\uf130', rightX, currentY);
      currentY += iconSpacing;
      window.iconCtx.fillStyle = (window.showCamera && window.isConnected) ? 'green' : 'red';
      window.iconCtx.fillText(window.showCamera ? '\uf03d' : '\uf4e2', rightX, currentY);
      currentY += iconSpacing;
      window.iconCtx.fillStyle = window.isAudioOutputEnabled ? 'green' : 'red';
      window.iconCtx.fillText(window.isAudioOutputEnabled ? '\uf028' : '\uf026', rightX, currentY);
    };

    window.updateTime();
    window.updateIcons();
    setInterval(window.updateTime, 1000);

    window.fallbackImage = new Image();
    window.fallbackImage.src = 'http://localhost:3001/oop.png';
    window.fallbackImage.onload = () => {};
    window.isStreamOn = true;

    window.attemptRecovery = async function() {
      if (!window.showCamera) return;
      if (window.isConnected) return;
      try {
        const devicesRecovery = await navigator.mediaDevices.enumerateDevices();
        const audioDevicesRecovery = devicesRecovery.filter(device => device.kind === 'audioinput');
        const newStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: { noiseSuppression: false, echoCancellation: false, autoGainControl: false, sampleRate: 48000, channelCount: 2 } });
        if (window.audioSource) window.audioSource.disconnect();
        const audioTrackRecovery = newStream.getAudioTracks()[0];
        window.videoElement.srcObject = newStream;
        await window.videoElement.play();
        const recoveredTrack = newStream.getVideoTracks()[0];
        window.audioSource = window.audioContext.createMediaStreamSource(newStream);
        window.audioSource.connect(window.gainNode);
        window.gainNode.gain.value = window.isMuted ? 0 : 1;
        window.isConnected = recoveredTrack.enabled && !recoveredTrack.muted && recoveredTrack.readyState === 'live';
        
      } catch (err) {
        setTimeout(window.attemptRecovery, 5000);
      }
    };

    const videoTrack = mediaStream.getVideoTracks()[0];
    videoTrack.onended = () => {
      window.isConnected = false;
      if (window.showCamera) window.attemptRecovery();
    };
    videoTrack.onmute = () => {
      window.isConnected = false;
      if (window.showCamera) window.attemptRecovery();
    };

    let lastDrawTime = 0;
    const frameInterval = 1000 / 15;
    window.drawToCanvas = () => {
      const currentTime = performance.now();
      if (currentTime - lastDrawTime < frameInterval) {
        requestAnimationFrame(window.drawToCanvas);
        return;
      }
      lastDrawTime = currentTime;

      window.ctx.fillStyle = 'black';
      window.ctx.fillRect(0, 0, window.canvas.width, window.canvas.height);

      if (window.showCamera && window.isConnected) {
        window.ctx.drawImage(window.videoElement, 0, 0, window.canvas.width, window.canvas.height);
      } else {
        let text = window.showCamera ? 'woops connection lost to camera' : 'Video Turned Off';
        if (window.fallbackImage.complete) {
          const imgWidth = window.fallbackImage.width;
          const imgHeight = window.fallbackImage.height;
          const x = (window.canvas.width - imgWidth) / 2;
          const y = (window.canvas.height - imgHeight) / 2;
          window.ctx.drawImage(window.fallbackImage, x, y, imgWidth, imgHeight);
        }
        window.ctx.fillStyle = 'white';
        window.ctx.font = '48px serif';
        window.ctx.fillText(text, 50, 150);
      }

      window.ctx.drawImage(window.timeCanvas, 0, 0);
      window.ctx.drawImage(window.iconCanvas, 0, 0);

      requestAnimationFrame(window.drawToCanvas);
    };
    window.drawToCanvas();
    await window.attemptRecovery();

    const videoStream = window.canvas.captureStream(15);
    const contentAudioTrack = window.audioDestination.stream.getAudioTracks()[0];
    const contentStream = new MediaStream([videoStream.getVideoTracks()[0], contentAudioTrack]);
    window.meetingSession.audioVideo.enableSVCForContentShare(true);
    window.meetingSession.audioVideo.chooseVideoInputQuality(1920, 1080, 15, 2000);
    window.meetingSession.audioVideo.setVideoMaxBandwidthKbps(2000);
    window.meetingSession.audioVideo.setContentShareVideoCodecPreferences([
      window.ChimeSDK.VideoCodecCapability.vp9()
    ]);
    await window.meetingSession.audioVideo.startContentShare(contentStream);

    window.meetingSession.audioVideo.addObserver({
      audioVideoDidStop: (sessionStatus) => {
        window.restart();
      }
    });

  });
  await page.exposeFunction('restart', () => {
    onRestart();
  });
  meetingSession = page;
}

async function stopShare() {
  if (page) {
    await page.evaluate(() => {
      try { window.meetingSession.audioVideo.stopContentShare(); } catch (e) {}
      if (window.videoElement) window.videoElement.pause();
      window.meetingSession.audioVideo.realtimeMuteLocalAudio();
    });
  }
}

async function shutdown() {
  if (browser) await browser.close();
  browser = null;
  page = null;
  meetingSession = null;
}

async function toggleMute(muted) {
  if (!page) return;
  await page.evaluate((m) => {
    window.isMuted = m;
    window.gainNode.gain.value = m ? 0 : 1;
    window.updateIcons();
  }, muted);
}

async function toggleAudioOutput(enabled) {
  if (!page) return;
  await page.evaluate((e) => {
    window.isAudioOutputEnabled = e;
    window.audioElement.muted = !e;
    window.updateIcons();
  }, enabled);
}

async function toggleStream(active) {
  if (!page) return;
  await page.evaluate(async (a) => {
    window.showCamera = a;
    if (a) {
      await window.attemptRecovery();
    } else {
      if (window.videoElement.srcObject) {
        window.videoElement.srcObject.getTracks().forEach(track => track.stop());
      }
      window.isConnected = false;
    }
    window.updateIcons();
  }, active);
}

async function getStates() {
  if (!page) return { muted: false, streamActive: true, audioOutputEnabled: true };
  return await page.evaluate(() => ({
    muted: window.isMuted,
    streamActive: window.showCamera,
    audioOutputEnabled: window.isAudioOutputEnabled
  }));
}

async function setStates(states) {
  await toggleMute(states.muted);
  await toggleAudioOutput(states.audioOutputEnabled);
  await toggleStream(states.streamActive);
}

module.exports = { launchAndJoin, stopShare, shutdown, toggleMute, toggleAudioOutput, toggleStream, getStates, setStates };