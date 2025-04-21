const { TwitterApi } = require('twitter-api-v2');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');


const baseHashtags = "#NBA #Basketball #Stats";

async function uploadMedia(filePath, client) {
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`Media file not found: ${filePath}`);
      return null;
    }
    const resizedImageBuffer = await sharp(filePath)
      .resize({ width: 300, height: 300, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toBuffer();
    const mediaId = await client.v1.uploadMedia(resizedImageBuffer, { type: 'png' });
    console.log(`Uploaded media ID: ${mediaId}`);
    return mediaId;
  } catch (error) {
    console.error(`Error uploading media ${filePath}:`, error.message);
    return null;
  }
}

async function getNBAResults() {
  try {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];
    console.log(`Fetching games for date: ${dateStr}`);
    console.log(`RapidAPI key status: ${process.env.RAPIDAPI_KEY ? 'Set' : 'Missing'}`);
    const response = await axios.get('https://api-nba-v1.p.rapidapi.com/games', {
      headers: {
        'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
        'X-RapidAPI-Host': 'api-nba-v1.p.rapidapi.com',
      },
      params: { date: dateStr },
    });
    const games = response.data.response || [];
    console.log(`API response: ${games.length} games found for ${dateStr}`);
    if (!games || games.length === 0) {
      console.log('No games found for', dateStr);
      return [];
    }
    const results = games.map((game) => ({
      gameId: game.id,
      date: new Date(game.date.start).toDateString(),
      homeTeam: game.teams.home.name,
      awayTeam: game.teams.visitors.name,
      score: `${game.scores.home.points}-${game.scores.visitors.points}`,
    }));
    console.log('Games retrieved:', JSON.stringify(results, null, 2));
    return results;
  } catch (error) {
    console.error(
      'API Error in getNBAResults:',
      error.message,
      'Status:',
      error.response?.status,
      'Data:',
      JSON.stringify(error.response?.data, null, 2)
    );
    throw error;
  }
}

async function getNBAResultsWithRetry(retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await getNBAResults();
    } catch (error) {
      if (error.response?.status === 429 && i < retries - 1) {
        console.log(`Rate limit hit in getNBAResults, retrying in 15s (${retries - i - 1} retries left)`);
        await new Promise(resolve => setTimeout(resolve, 15000));
      } else {
        console.error('Failed to fetch game results after retries:', error.message);
        return [];
      }
    }
  }
}

async function getTopPlayerStats(gameId, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`Fetching stats for game ${gameId}, RapidAPI key status: ${process.env.RAPIDAPI_KEY ? 'Set' : 'Missing'}`);
      const response = await axios.get('https://api-nba-v1.p.rapidapi.com/players/statistics', {
        headers: {
          'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
          'X-RapidAPI-Host': 'api-nba-v1.p.rapidapi.com',
        },
        params: { game: gameId },
      });
      const players = response.data.response || [];
      if (!players || players.length === 0) {
        console.log(`No player stats available for game ${gameId}`);
        return null;
      }
      const topPlayer = players.reduce((prev, curr) =>
        (parseInt(curr.points) || 0) > (parseInt(prev.points) || 0) ? curr : prev
      );
      const topPlayerData = {
        name: `${topPlayer.player.firstname} ${topPlayer.player.lastname}`,
        points: topPlayer.points || '0',
        rebounds: topPlayer.totReb || '0',
        assists: topPlayer.assists || '0',
      };
      console.log(`Top player for game ${gameId} (${topPlayer.team.name}): ${topPlayerData.name} - ${topPlayerData.points} pts, ${topPlayerData.rebounds} reb, ${topPlayerData.assists} ast`);
      return topPlayerData;
    } catch (error) {
      console.error(`Error fetching player stats for game ${gameId}: ${error.response?.status || 'Unknown'}`, error.message, 'Data:', error.response?.data);
      if (error.response?.status === 429 && i < retries - 1) {
        console.log(`Rate limit hit for game ${gameId}. Retrying in 15 seconds... (${retries - i - 1} retries left)`);
        await new Promise(resolve => setTimeout(resolve, 15000));
      } else {
        console.error('Failed to fetch player stats after retries:', error.message);
        return null;
      }
    }
  }
}

async function postMatchTweet(game, timestamp, client) {
  try {
    let tweetContent = `${game.date}:\n${game.homeTeam} ${game.score} ${game.awayTeam}\n`;
    const topPlayer = await getTopPlayerStats(game.gameId);
    if (topPlayer) {
      tweetContent += `${topPlayer.name}: ${topPlayer.points}pts, ${topPlayer.rebounds}reb, ${topPlayer.assists}ast\n`;
    }
    const teamHashtags = `#${game.homeTeam.replace(/\s+/g, '')} #${game.awayTeam.replace(/\s+/g, '')}`;
    tweetContent += `${baseHashtags} ${teamHashtags} [${timestamp}]`;
    console.log(`Tweet length: ${tweetContent.length}`);
    if (tweetContent.length > 280) {
      console.log(`Tweet too long (${tweetContent.length} chars), truncating`);
      tweetContent = tweetContent.substring(0, 277) + '...';
    }
    const logoPath = path.join(__dirname, 'logos', 'NBA.png');
    console.log(`Checking logo file: ${logoPath}, exists: ${fs.existsSync(logoPath)}`);
    const mediaIds = fs.existsSync(logoPath) ? [await uploadMedia(logoPath, client)] : [];
    const tweetPayload = { text: tweetContent, media: { media_ids: mediaIds } };
    console.log('Tweet payload:', JSON.stringify(tweetPayload));
    await client.v2.tweet(tweetPayload);
    console.log(`Match tweet posted: ${tweetContent}`);
  } catch (error) {
    console.error(`Error posting match tweet for game ${game.gameId}:`, error.message, 'Data:', error.response?.data);
  }
}


async function postNBATweets() {
  const requiredEnvVars = [
    'RAPIDAPI_KEY',
    'TWITTER_APP_KEY',
    'TWITTER_APP_SECRET',
    'TWITTER_ACCESS_TOKEN',
    'TWITTER_ACCESS_SECRET',
  ];
  const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);
  if (missingVars.length > 0) {
    console.error(`Missing required environment variables: ${missingVars.join(', ')}`);
    throw new Error('Environment configuration incomplete');
  }

  const client = new TwitterApi({
    appKey: process.env.TWITTER_APP_KEY,
    appSecret: process.env.TWITTER_APP_SECRET,
    accessToken: process.env.TWITTER_ACCESS_TOKEN,
    accessSecret: process.env.TWITTER_ACCESS_SECRET,
  });

  let results = [];
  try {
    results = await getNBAResultsWithRetry();
  } catch (error) {
    console.error('Fatal error in postNBATweets:', error.message);
    throw error; // Rethrow to ensure the process exits with an error
  }

  const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
  if (results.length === 0) {
    console.log('No game results available, posting fallback tweet.');
    const fallbackTweet = `No NBA game results available for today. Stay tuned for more updates! ${baseHashtags} [${timestamp}]`;
    await client.v2.tweet({ text: fallbackTweet });
    console.log('Fallback tweet posted:', fallbackTweet);
  } else {
    for (const game of results) {
      await postMatchTweet(game, timestamp, client);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
}

async function testTwitterClient() {
  const client = new TwitterApi({
    appKey: process.env.TWITTER_APP_KEY,
    appSecret: process.env.TWITTER_APP_SECRET,
    accessToken: process.env.TWITTER_ACCESS_TOKEN,
    accessSecret: process.env.TWITTER_ACCESS_SECRET,
  });
  try {
    await client.v2.tweet({ text: `Test tweet from nba-bot ${new Date().toISOString()} ${baseHashtags}` });
    console.log('Test tweet posted successfully');
  } catch (error) {
    console.error('Error posting test tweet:', error.message, 'Data:', error.response?.data);
  }
}

module.exports = { postNBATweets, testTwitterClient };