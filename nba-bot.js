console.log('nba-bot.js: Script started');

try {
  const { TwitterApi } = require('twitter-api-v2');
  const axios = require('axios');
  console.log('nba-bot.js: Dependencies loaded');

  async function postNBATweets() {
    console.log('postNBATweets: Starting...');
    console.log('Environment variables:', {
      TWITTER_APP_KEY: process.env.TWITTER_APP_KEY ? 'Set' : 'Missing',
      RAPIDAPI_KEY: process.env.RAPIDAPI_KEY ? 'Set' : 'Missing',
    });
    // Add your tweet-posting or API logic here
    console.log('postNBATweets: Completed');
  }

  // Run this block only when the script is executed directly
  if (require.main === module) {
    console.log('nba-bot.js: Executing main block');
    postNBATweets()
      .then(() => console.log('nba-bot.js: Script completed successfully'))
      .catch((err) => {
        console.error('nba-bot.js: Error:', err.message);
        process.exit(1); // Exit with failure code
      });
  }
} catch (error) {
  console.error('nba-bot.js: Failed to load script:', error.message);
  process.exit(1); // Exit with failure code
}