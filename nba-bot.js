const { TwitterApi } = require('twitter-api-v2');
const schedule = require('node-schedule');
const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: './keys.env' });

const app = express();
const PORT = process.env.PORT || 10000;

const client = new TwitterApi({
  appKey: process.env.TWITTER_APP_KEY,
  appSecret: process.env.TWITTER_APP_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_SECRET,
});

const baseHashtags = "#NBA #Basketball #Stats";

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
    if (error.response?.status === 429 && retries > 0) {
      console.log(`Rate limit hit for game ${gameId}. Retrying in 15 seconds... (${retries} retries left)`);
      await new Promise(resolve => setTimeout(resolve, 15 * 1000));
      return getTopPlayerStats(gameId, retries - 1);
    }
    return null;
  }
}

async function getStandings() {
  try {
    const response = await axios.get('https://api-nba-v1.p.rapidapi.com/standings', {
      headers: {
        'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
        'X-RapidAPI-Host': 'api-nba-v1.p.rapidapi.com',
      },
      params: {
        league: 'standard',
        season: new Date().getFullYear() - 1,
      },
    });

    const standings = response.data.response;
    const east = standings.filter(team => team.conference.name === 'east').sort((a, b) => a.conference.rank - b.conference.rank).slice(0, 3);
    const west = standings.filter(team => team.conference.name === 'west').sort((a, b) => a.conference.rank - b.conference.rank).slice(0, 3);

    console.log('East Standings Top 3:', east.map(team => `${team.conference.rank}. ${team.team.name} (${team.win.total}-${team.loss.total})`));
    console.log('West Standings Top 3:', west.map(team => `${team.conference.rank}. ${team.team.name} (${team.win.total}-${team.loss.total})`));
    return { east, west };
  } catch (error) {
    console.error('Error fetching standings:', error.message);
    return { east: [], west: [] };
  }
}

async function uploadMedia(filePath) {
  try {
    const mediaId = await client.v1.uploadMedia(filePath);
    return mediaId;
  } catch (error) {
    console.error(`Error uploading media ${filePath}:`, error.message);
    return null;
  }
}

async function postMatchTweet(game, timestamp) {
  try {
    let tweetContent = `${game.date}:\n${game.homeTeam} ${game.score} ${game.awayTeam}\n`;
    const topPlayer = await getTopPlayerStats(game.gameId);
    if (topPlayer) {
      tweetContent += `${topPlayer.name}: ${topPlayer.points}pts, ${topPlayer.rebounds}reb, ${topPlayer.assists}ast\n`;
    }
    const teamHashtags = `#${game.homeTeam.replace(/\s+/g, '')} #${game.awayTeam.replace(/\s+/g, '')}`;
    tweetContent += `${baseHashtags} ${teamHashtags} [${timestamp}]`;

    const logoPath = path.join(__dirname, 'logos', 'NBA.png');
    const mediaIds = fs.existsSync(logoPath) ? [await uploadMedia(logoPath)] : [];

    await client.v2.tweet({ text: tweetContent, media: { media_ids: mediaIds } });
    console.log(`Match tweet posted: ${tweetContent}`);
  } catch (error) {
    console.error(`Error posting match tweet for game ${game.gameId}:`, error.message);
  }
}

async function postConferenceTweet(conference, teams, timestamp) {
  try {
    const confName = conference === 'east' ? 'Eastern' : 'Western';
    let tweetContent = `${confName} Conference Top 3 - ${new Date().toDateString()}:\n`;
    teams.forEach(team => {
      tweetContent += `${team.conference.rank}. ${team.team.name} (${team.win.total}-${team.loss.total})\n`;
    });
    tweetContent += `${baseHashtags} #${confName}Conference [${timestamp}]`;

    const logoPath = path.join(__dirname, 'logos', `${confName}Conference.png`);
    const mediaIds = fs.existsSync(logoPath) ? [await uploadMedia(logoPath)] : [];

    await client.v2.tweet({ text: tweetContent, media: { media_ids: mediaIds } });
    console.log(`Conference tweet posted: ${tweetContent}`);
  } catch (error) {
    console.error(`Error posting ${conference} conference tweet:`, error.message);
  }
}

async function postNBATweets() {
  try {
    const results = await getNBAResults();
    if (results.length === 0) {
      console.log('No game results available, skipping match tweets.');
    } else {
      const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
      for (const game of results) {
        await postMatchTweet(game, timestamp);
        await new Promise(resolve => setTimeout(resolve, 2000)); // Délai de 2s entre tweets
      }
    }

    const standings = await getStandings();
    const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
    await postConferenceTweet('east', standings.east, timestamp);
    await new Promise(resolve => setTimeout(resolve, 2000)); // Délai de 2s
    await postConferenceTweet('west', standings.west, timestamp);
  } catch (error) {
    console.error("Error in postNBATweets:", error.message);
    if (error.code === 429) {
      console.log('Twitter rate limit hit. Waiting 15 minutes...');
      await new Promise(resolve => setTimeout(resolve, 15 * 60 * 1000));
      await postNBATweets();
    }
  }
}

schedule.scheduleJob('0 0 * * *', async () => await postNBATweets());
postNBATweets().then(() => console.log("Tweets posted"));

app.get('/run', (req, res) => res.send('NBA Twitter Bot running!'));
app.listen(PORT, () => {
  console.log(`NBA Bot started! Posting every 24 hours. Server running on port ${PORT}`);
});