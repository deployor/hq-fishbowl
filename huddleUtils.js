const axios = require('axios');

async function joinHuddle(channelId) {
  const form = new FormData();
  form.append('channel_id', channelId);
  form.append('regions', 'us-east-2');
  form.append('token', process.env.SLACK_ROOM_TOKEN);
  const options = {
    method: 'POST',
    url: 'https://hackclub.slack.com/api/rooms.join',
    headers: {
      ...JSON.parse(process.env.HEADERS || '{}'),
      'cookie': process.env.SLACK_COOKIE,
      'Content-Type': 'multipart/form-data',
      'User-Agent': 'insomnia/11.2.0'
    },
    data: form
  };
  const response = await axios(options);
  if (!response.data.ok) {
    throw new Error('Slack API call failed: ' + response.data.error);
  }
  return { meeting: response.data.call.free_willy.meeting, attendee: response.data.call.free_willy.attendee, thread_ts: response.data.huddle.thread_root_ts };
}

module.exports = { joinHuddle };