console.log('nba-bot.js: Script loaded');

try {
  console.log('nba-bot.js: Attempting to load dependencies');
  const { TwitterApi } = require('twitter-api-v2');
  const axios = require('axios');
  console.log('nba-bot.js: Dependencies loaded successfully');

  async function postNBATweets() {
    console.log('postNBATweets: Starting...');
    console.log('postNBATweets: Environment variables:', {
      TWITTER_APP_KEY: process.env.TWITTER_APP_KEY ? 'Set' : 'Missing',
      TWITTER_APP_SECRET: process.env.TWITTER_APP_SECRET ? 'Set' : 'Missing',
      TWITTER_ACCESS_TOKEN: process.env.TWITTER_ACCESS_TOKEN ? 'Set' : 'Missing',
      TWITTER_ACCESS_SECRET: process.env.TWITTER_ACCESS_SECRET ? 'Set' : 'Missing',
      RAPIDAPI_KEY: process.env.RAPIDAPI_KEY ? 'Set' : 'Missing',
    });
    console.log('postNBATweets: Function defined, but not executing complex logic');
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
  console.error('nba-bot.js: Failed to load script:', error.message, err.stack);
  process.exit(1);
}