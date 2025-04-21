console.log('nba-bot.js: Script loaded');

try {
  const { TwitterApi } = require('twitter-api-v2');
  const axios = require('axios');

  console.log('nba-bot.js: Dependencies loaded');

  async function postNBATweets() {
    console.log('postNBATweets: Starting...');
    console.log('postNBATweets: Environment variables:', {
      TWITTER_APP_KEY: process.env.TWITTER_APP_KEY ? 'Set' : 'Missing',
      TWITTER_APP_SECRET: process.env.TWITTER_APP_SECRET ? 'Set' : 'Missing',
      TWITTER_ACCESS_TOKEN: process.env.TWITTER_ACCESS_TOKEN ? 'Set' : 'Missing',
      TWITTER_ACCESS_SECRET: process.env.TWITTER_ACCESS_SECRET ? 'Set' : 'Missing',
      RAPIDAPI_KEY: process.env.RAPIDAPI_KEY ? 'Set' : 'Missing',
    });

    try {
      const client = new TwitterApi({
        appKey: process.env.TWITTER_APP_KEY,
        appSecret: process.env.TWITTER_APP_SECRET,
        accessToken: process.env.TWITTER_ACCESS_TOKEN,
        accessSecret: process.env.TWITTER_ACCESS_SECRET,
      });
      console.log('postNBATweets: Twitter client initialized');

      // Test API call
      console.log('postNBATweets: Fetching NBA results...');
      const response = await axios.get('https://api-nba-v1.p.rapidapi.com/games', {
        headers: {
          'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
          'X-RapidAPI-Host': 'api-nba-v1.p.rapidapi.com',
        },
        params: { date: '2025-04-20' },
      });
      const games = response.data.response || [];
      console.log('postNBATweets: Games retrieved:', games.length);

      const timestamp = new Date().toISOString();
      if (games.length === 0) {
        console.log('postNBATweets: No games, posting fallback tweet');
        await client.v2.tweet({ text: `No NBA games on ${timestamp}` });
      } else {
        for (const game of games) {
          console.log('postNBATweets: Posting tweet for game:', game);
          await client.v2.tweet({
            text: `Game on ${timestamp}: ${game.teams?.home?.name || 'Unknown'} vs ${game.teams?.visitors?.name || 'Unknown'}`,
          });
        }
      }
      console.log('postNBATweets: Completed');
    } catch (error) {
      console.error('postNBATweets: Error:', error.message, error.stack);
      throw error;
    }
  }

  if (require.main === module) {
    console.log('nba-bot.js: Main block executing');
    postNBATweets()
      .then(() => {
        console.log('nba-bot.js: Script completed successfully');
        process.exit(0);
      })
      .catch((err) => {
        console.error('nba-bot.js: Script failed:', err.message, err.stack);
        process.exit(1);
      });
  }

  module.exports = { postNBATweets };
} catch (error) {
  console.error('nba-bot.js: Failed to load script:', error.message, error.stack);
  process.exit(1);
}