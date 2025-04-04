const { TwitterApi } = require('twitter-api-v2');
const schedule = require('node-schedule');
const express = require('express');
const axios = require('axios');
require('dotenv').config({ path: './keys.env' });

const app = express();
const PORT = process.env.PORT || 10000;

const client = new TwitterApi({
  appKey: process.env.TWITTER_APP_KEY,
  appSecret: process.env.TWITTER_APP_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_SECRET,
});

const hashtags = "#NBA #Basketball #Stats";

async function getNBAResults() {
  try {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];

    const response = await axios.get('https://api-nba-v1.p.rapidapi.com/games', {
      headers: {
        'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
        'X-RapidAPI-Host': 'api-nba-v1.p.rapidapi.com',
      },
      params: { date: dateStr },
    });

    const games = response.data.response;
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
    return [];
  }
}

async function getTopPlayerStats(gameId, retries = 3) {
  try {
    const response = await axios.get('https://api-nba-v1.p.rapidapi.com/players/statistics', {
      headers: {
        'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
        'X-RapidAPI-Host': 'api-nba-v1.p.rapidapi.com',
      },
      params: { game: gameId },
    });

    const players = response.data.response;
    if (!players || players.length === 0) {
      console.log(`No player stats available for game ${gameId}`);
      return null;
    }

    const topPlayer = players.reduce((prev, curr) =>
      (parseInt(curr.points) || 0) > (parseInt(prev.points) || 0) ? curr : prev
    );

    return {
      name: `${topPlayer.player.firstname} ${topPlayer.player.lastname}`,
      points: topPlayer.points || '0',
      rebounds: topPlayer.totReb || '0',
      assists: topPlayer.assists || '0',
    };
  } catch (error) {
    console.error(`Error fetching player stats for game ${gameId}: ${error.response?.status || 'Unknown'}`, error.message);
    if (error.response?.status === 429 && retries > 0) {
      console.log(`Rate limit hit for game ${gameId}. Retrying in 15 seconds... (${retries} retries left)`);
      await new Promise(resolve => setTimeout(resolve, 15 * 1000));
      return getTopPlayerStats(gameId, retries - 1);
    }
    return null;
  }
}

async function getAllGamesPost() {
  try {
    const results = await getNBAResults();
    if (results.length === 0) throw new Error("No results found.");

    let postContent = `${results[0].date}:\n`;
    let statsAdded = false;

    for (const game of results) {
      const gameLine = `${game.homeTeam} ${game.score} ${game.awayTeam}\n`;
      postContent += gameLine;

      // Only add stats for the first game to avoid rate limits
      if (!statsAdded) {
        const topPlayer = await getTopPlayerStats(game.gameId);
        if (topPlayer) {
          const playerLine = `${topPlayer.name}: ${topPlayer.points} pts, ${topPlayer.rebounds} reb, ${topPlayer.assists} ast\n`;
          postContent += playerLine;
          statsAdded = true;
        }
      }
    }
    postContent += hashtags;

    if (postContent.length > 280) {
      const maxContentLength = 280 - hashtags.length - 4;
      postContent = `${postContent.substring(0, maxContentLength)}... ${hashtags}`;
    }

    return postContent;
  } catch (error) {
    console.error('Error retrieving NBA results:', error.message);
    return 'Error retrieving NBA results.';
  }
}

async function postNBATweet() {
  try {
    const content = await getAllGamesPost();
    if (content === 'Error retrieving NBA results.') {
      console.log('No game results available, skipping tweet.');
      return;
    }
    if (typeof content !== 'string') throw new Error("Invalid content.");
    const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const tweet = `${content} [${timestamp}]`;

    if (tweet.length > 280) {
      const shortTweet = `${content.substring(0, 280 - timestamp.length - 4)}... [${timestamp}]`;
      await client.v2.tweet(shortTweet);
      console.log(`Short tweet posted: ${shortTweet}`);
    } else {
      await client.v2.tweet(tweet);
      console.log(`Tweet posted: ${tweet}`);
    }
  } catch (error) {
    console.error("Error posting tweet:", error.message);
    if (error.code === 429) {
      console.log('Twitter rate limit hit. Waiting 15 minutes...');
      await new Promise(resolve => setTimeout(resolve, 15 * 60 * 1000));
      await postNBATweet();
    }
  }
}

schedule.scheduleJob('0 0 * * *', async () => await postNBATweet());
postNBATweet().then(() => console.log("First tweet posted"));

app.get('/run', (req, res) => res.send('NBA Twitter Bot running!'));
app.listen(PORT, () => {
  console.log(`NBA Bot started! Posting every 24 hours. Server running on port ${PORT}`);
});

getAllGamesPost().then(result => console.log("Result of getAllGamesPost:", result));