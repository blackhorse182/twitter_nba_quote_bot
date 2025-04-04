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

    console.log(`Top player for game ${gameId}: ${topPlayerData.name} - ${topPlayerData.points} pts, ${topPlayerData.rebounds} reb, ${topPlayerData.assists} ast`);
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

async function getAllGamesPost() {
  try {
    const results = await getNBAResults();
    if (results.length === 0) throw new Error("No results found.");

    let postContent = `${results[0].date}:\n`;
    let statsAdded = false;
    let teamHashtags = new Set();

    for (const game of results) {
      const gameLine = `${game.homeTeam} ${game.score} ${game.awayTeam}\n`;
      postContent += gameLine;

      teamHashtags.add(`#${game.homeTeam.replace(/\s+/g, '')}`);
      teamHashtags.add(`#${game.awayTeam.replace(/\s+/g, '')}`);

      if (!statsAdded) {
        const topPlayer = await getTopPlayerStats(game.gameId);
        if (topPlayer) {
          const playerLine = `${topPlayer.name}: ${topPlayer.points}pts, ${topPlayer.rebounds}reb, ${topPlayer.assists}ast\n`;
          postContent += playerLine;
          statsAdded = true;
        }
      }
    }

    const standings = await getStandings();
    postContent += "\nEast Top 3:\n";
    standings.east.forEach(team => {
      postContent += `${team.conference.rank}. ${team.team.name} (${team.win.total}-${team.loss.total})\n`;
    });
    postContent += "West Top 3:\n";
    standings.west.forEach(team => {
      postContent += `${team.conference.rank}. ${team.team.name} (${team.win.total}-${team.loss.total})\n`;
    });

    const allHashtags = `${baseHashtags} ${Array.from(teamHashtags).join(' ')}`;
    postContent += allHashtags;

    if (postContent.length > 280) {
      const maxContentLength = 280 - allHashtags.length - 4;
      postContent = `${postContent.substring(0, maxContentLength)}... ${allHashtags}`;
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

    const mediaIds = [];
    const logoPaths = [
      path.join(__dirname, 'logos', 'NBA.png'),
      path.join(__dirname, 'logos', 'EasternConference.png'),
      path.join(__dirname, 'logos', 'WesternConference.png'),
    ];

    for (const logoPath of logoPaths) {
      if (fs.existsSync(logoPath)) {
        const mediaId = await uploadMedia(logoPath);
        if (mediaId) mediaIds.push(mediaId);
      } else {
        console.log(`Logo not found at: ${logoPath}`);
      }
    }

    const tweet = `${content} [${timestamp}]`;
    if (tweet.length > 280) {
      const shortTweet = `${content.substring(0, 280 - timestamp.length - 4)}... [${timestamp}]`;
      await client.v2.tweet({ text: shortTweet, media: { media_ids: mediaIds } });
      console.log(`Short tweet posted with logos: ${shortTweet}`);
    } else {
      await client.v2.tweet({ text: tweet, media: { media_ids: mediaIds } });
      console.log(`Tweet posted with logos: ${tweet}`);
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