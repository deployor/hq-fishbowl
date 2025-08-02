<div align="center">
  <a href="https://hackclub.com/"><img src="https://assets.hackclub.com/flag-standalone.svg" width="100" alt="Hack Club flag"></a>
  <h1>HQ Fishbowl 🐟</h1>
  <a href="https://app.slack.com/client/T0266FRGM/C08NKJZSMQD">
     <img alt="Slack Channel" src="https://img.shields.io/badge/slack-%23hqfishbowl-blue.svg?style=flat&logo=slack">
   </a>
</div>

<div align="center">
  <img src="https://hc-cdn.hel1.your-objectstorage.com/s/v3/fd6c868a62a77a2ba8864c92b30d00ebee637808_hq_fishbowl__8_.png" width="100%" alt="HQ Fishbowl Banner">
  <i>Far on the ocean there's a... a 24/7 portal to HQ.</i>
</div>

---

## What is this?

> I wish I could set up a livestream of hq’s main meetup space in a huddle on slack that runs 24/7. Wanna talk to someone at hq? Just open the huddle. Call it hq-fishbowl and have a warning that you’ll spook the staff if you tap the glass! 
-msw

This project is a bot that creates a 24/7 huddle, acting as a live camera or portal to Hack Club HQ. It's a virtual window into the space, allowing anyone to pop in and see what's happening.

## How It Works

Normally, you'd automate a browser to join Slack huddles. But that can trigger captchas and other security checks. This project skips that by interacting directly with AWS services as soon as possible using undocumented API. You get to send pretty much any video/audio feed you want without any hassle. It's cool and reliable. The control panel and SDK runs on firefox for webrtc etc.

## Screenshots

Here's the control panel with chat and controls:
![Control Panel](https://files.catbox.moe/7ljrhn.png)

And the bot in action during a huddle:
![Bot in Huddle](https://files.catbox.moe/c2uzsg.png)

## Setup Instructions

1.  **Clone the repo** and install dependencies: `npm install`.
2.  **Get your Slack cookies**: You need some cookies to authenticate. Check out this quick video on how to grab them: [Video](https://peertube.dk/w/rMnQ3mLc9spr2EWVgcsxLX). Basically, log into Slack in your browser, open dev tools, and snag the relevant cookies for your .env file.
3.  **Manifest for the Bot**: Use the `manifest.json` to configure the bot's scopes and settings for your Slack workspace.
4.  **Configure .env**: Add your cookies, bot token, and other required variables from `.env.example`.
5.  **Run it**: Fire up the server with `node bot.js`. The bot will join the channel's huddle and start streaming.

Currently things are configured for a Pi, some things need to be adjusted!

## Controls

Use the bottom bar icons on the control panel to toggle mute, camera, and audio output. Red means off, green means on. Simple!

## License Notes

`amazon-chime-sdk.min.js` is the minified AWS Chime SDK, licensed under the Apache License 2.0. For more details, see the [AWS Chime SDK repository](https://github.com/aws/amazon-chime-sdk-js).

This repo is MIT licensed.
---

<div align="center">
   <br>
   <p>Made with sharktastic 💙 for Hack Club</p>
</div>