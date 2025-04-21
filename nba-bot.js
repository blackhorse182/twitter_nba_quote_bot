const { TwitterApi } = require('twitter-api-v2');
const axios = require('axios');

console.log('Script started'); // Confirm script runs

async function postNBATweets() {
  console.log('Starting postNBATweets...');
  console.log('Environment variables:', {
    TWITTER_APP_KEY: process.env.TWITTER_APP_KEY ? 'Set' : 'Missing',
    RAPIDAPI_KEY: process.env.RAPIDAPI_KEY ? 'Set' : 'Missing',
  });

  try {
    const client = new TwitterApi({
      appKey: process.env.TWITTER_APP_KEY,
      appSecret: process.env.TWITTER_APP_SECRET,
      accessToken: process.env.TWITTER_ACCESS_TOKEN,
      accessSecret: process.env.TWITTER_ACCESS_SECRET,
    });

    // Placeholder API call
    console.log('Fetching NBA results...');
    const response = await axios.get('https://api-nba-v1.p.rapidapi.com/games', {
      headers: {
        'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
        'X-RapidAPI-Host': 'api-nba-v1.p.rapidapi.com',
      },
      params: { date: '2025-04-20' },
    });
    const games = response.data.response || [];
    console.log('Games:', games);

    const timestamp = new Date().toISOString();
    for (const game of games) {
      console.log('Posting tweet for game:', game);
      await client.v2.tweet({
        text: `Game on ${timestamp}: ${game.teams?.home?.name} vs ${game.teams?.visitors?.name}`,
      });
    }
    console.log('Tweets posted');
  } catch (error) {
    console.error('Error in postNBATweets:', error.message, error.stack);
    throw error;
  }
}

if (require.main === module) {
  console.log('Executing main block');
  postNBATweets()
    .then(() => {
      console.log('Script completed successfully');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Script failed:', err.message, err.stack);
      process.exit(1);
    });
}

module.exports = { postNBATweets };