const { TwitterApi } = require('twitter-api-v2');
const schedule = require('node-schedule');
const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
require('dotenv').config({ path: '.env' });

const app = express();
const PORT = process.env.PORT || 3000; // This is fine as-is
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
    const response = await axios.get('https://api-nba-v1.p.rapidapi.com/games', {
      headers: {
        'X-RapidAPI-Key': process.env.Rapid_API_KEY,
        'X-RapidAPI-Host': 'api-nba-v1.p.rapidapi.com',
      },
      params: { date: dateStr },
    });
    const games = response.data.response || [];
    if (!games || games.length === 0) {
      console.log('No games found for', dateStr);
      return [];
    }
    const results = games.map(game => ({
      gameId: game.id,
      date: new Date(game.date.start).toDateString(),
      homeTeam: game.teams.home.name,
      awayTeam: game.teams.visitors.name,
      score: `${game.scores.home.points}-${game.scores.visitors.points}`,
    }));
    console.log('Games retrieved:', results);
    return results;
  } catch (error) {
    console.error('API Error in getNBAResults:', error.message);
    throw error; // Laissez l’appelant gérer l’erreur (pour les nouvelles tentatives)
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
      const response = await axios.get('https://api-nba-v1.p.rapidapi.com/players/statistics', {
        headers: {
          'X-RapidAPI-Key': process.env.Rapid_API_KEY,
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
      console.error(`Error fetching player stats for game ${gameId}: ${error.response?.status || 'Unknown'}`, error.message);
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
    const mediaIds = fs.existsSync(logoPath) ? [await uploadMedia(logoPath, client)] : [];
    await client.v2.tweet({ text: tweetContent, media: { media_ids: mediaIds } });
    console.log(`Match tweet posted: ${tweetContent}`);
  } catch (error) {
    console.error(`Error posting match tweet for game ${game.gameId}:`, error.message);
  }
}

async function getStandingsWithRetry(retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      // Replace with actual standings API call
      console.log("Fetching standings (placeholder)...");
      return { east: [], west: [] }; // Dummy data
    } catch (error) {
      if (error.response?.status === 429 && i < retries - 1) {
        console.log(`Rate limit hit in getStandings, retrying in 15s (${retries - i - 1} retries left)`);
        await new Promise(resolve => setTimeout(resolve, 15000));
      } else {
        console.error('Failed to fetch standings after retries:', error.message);
        return { east: [], west: [] };
      }
    }
  }
}

async function postNBATweets() {
  const client = new TwitterApi({
    appKey: process.env.TWITTER_APP_KEY,
    appSecret: process.env.TWITTER_APP_SECRET,
    accessToken: process.env.TWITTER_ACCESS_TOKEN,
    accessSecret: process.env.TWITTER_ACCESS_SECRET,
  });

  let results = [];
  let standings = { east: [], west: [] };

  try {
    results = await getNBAResultsWithRetry();
    standings = await getStandingsWithRetry();
  } catch (error) {
    console.error("Fatal error in postNBATweets:", error.message);
    return;
  }

const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
  if (results.length === 0) {
    console.log('No game results available, skipping match tweets.');
  } else {
    for (const game of results) {
      await postMatchTweet(game, timestamp, client);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
} // Add this closing brace here

schedule.scheduleJob('0 0 * * *', async () => await postNBATweets());
postNBATweets().then(() => console.log("Tweets posted"));
app.get('/run', (req, res) => res.send('NBA Twitter Bot running!'));
app.listen(PORT, () => {
  console.log(`NBA Bot started! Posting every 24 hours. Server running on port ${PORT}`);
});
  
  

schedule.scheduleJob('0 0 * * *', async () => await postNBATweets());
postNBATweets().then(() => console.log("Tweets posted"));
app.get('/run', (req, res) => res.send('NBA Twitter Bot running!'));
app.listen(PORT, () => {
  console.log(`NBA Bot started! Posting every 24 hours. Server running on port ${PORT}`);
});

