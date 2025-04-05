// Importation des modules nécessaires
const { TwitterApi } = require('twitter-api-v2'); // API Twitter
const schedule = require('node-schedule'); // Planification des tâches
const express = require('express'); // Serveur web
const axios = require('axios'); // Requêtes HTTP
const fs = require('fs'); // Gestion des fichiers
const path = require('path'); // Gestion des chemins de fichiers
const sharp = require('sharp'); // Pour redimensionner les images
require('dotenv').config({ path: '.env' }); // Chargement des variables d'environnement

// Initialisation de l'application Express
const app = express();
const PORT = process.env.PORT || 10000; // Port du serveur

// Hashtags de base pour les tweets
const baseHashtags = "#NBA #Basketball #Stats";

// Fonction pour uploader un média sur Twitter avec redimensionnement
async function uploadMedia(filePath, client) {
  try {
    const resizedImageBuffer = await sharp(filePath)
      .resize({
        width: 300,
        height: 300,
        fit: 'contain', // Garde les proportions, ajoute du padding si nécessaire
        background: { r: 0, g: 0, b: 0, alpha: 0 } // Fond transparent
      })
      .toBuffer();

    const mediaId = await client.v1.uploadMedia(resizedImageBuffer, { type: 'png' });
    return mediaId;
  } catch (error) {
    console.error(`Error processing or uploading media ${filePath}:`, error.message);
    return null;
  }
}

// Fonction pour récupérer les résultats des matchs NBA
async function getNBAResults() {
  try {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1); // Date d'hier
    const dateStr = yesterday.toISOString().split('T')[0]; // Format ISO

    const response = await axios.get('https://api-nba-v1.p.rapidapi.com/games', {
      headers: {
        'X-RapidAPI-Key': process.env.Rapid_API_KEY,
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

// Fonction pour récupérer les statistiques du meilleur joueur d'un match
async function getTopPlayerStats(gameId, retries = 3) {
  try {
    const response = await axios.get('https://api-nba-v1.p.rapidapi.com/players/statistics', {
      headers: {
        'X-RapidAPI-Key': process.env.Rapid_API_KEY,
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

// Fonction pour récupérer les classements des conférences
async function getStandings() {
  try {
    const response = await axios.get('https://api-nba-v1.p.rapidapi.com/standings', {
      headers: {
        'X-RapidAPI-Key': process.env.Rapid_API_KEY,
        'X-RapidAPI-Host': 'api-nba-v1.p.rapidapi.com',
      },
      params: {
        league: 'standard',
        season: new Date().getFullYear() - 1, // Saison précédente
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

// Fonction pour poster un tweet sur un match
async function postMatchTweet(game, timestamp, client) {
  try {
    let tweetContent = `${game.date}:\n${game.homeTeam} ${game.score} ${game.awayTeam}\n`;
    const topPlayer = await getTopPlayerStats(game.gameId);
    if (topPlayer) {
      tweetContent += `${topPlayer.name}: ${topPlayer.points}pts, ${topPlayer.rebounds}reb, ${topPlayer.assists}ast\n`;
    }
    const teamHashtags = `#${game.homeTeam.replace(/\s+/g, '')} #${game.awayTeam.replace(/\s+/g, '')}`;
    tweetContent += `${baseHashtags} ${teamHashtags} [${timestamp}]`;

    const logoPath = path.join(__dirname, 'logos', 'NBA.png');
    const mediaIds = fs.existsSync(logoPath) ? [await uploadMedia(logoPath, client)] : [];

    await client.v2.tweet({ text: tweetContent, media: { media_ids: mediaIds } });
    console.log(`Match tweet posted: ${tweetContent}`);
  } catch (error) {
    console.error(`Error posting match tweet for game ${game.gameId}:`, error.message);
  }
}

// Fonction pour poster un tweet sur les classements d'une conférence
async function postConferenceTweet(conference, teams, timestamp, client) {
  try {
    const confName = conference === 'east' ? 'Eastern' : 'Western';
    let tweetContent = `${confName} Conference Top 3 - ${new Date().toDateString()}:\n`;
    teams.forEach(team => {
      tweetContent += `${team.conference.rank}. ${team.team.name} (${team.win.total}-${team.loss.total})\n`;
    });
    tweetContent += `${baseHashtags} #${confName}Conference [${timestamp}]`;

    const logoPath = path.join(__dirname, 'logos', `${confName}Conference.png`);
    const mediaIds = fs.existsSync(logoPath) ? [await uploadMedia(logoPath, client)] : [];

    await client.v2.tweet({ text: tweetContent, media: { media_ids: mediaIds } });
    console.log(`Conference tweet posted: ${tweetContent}`);
  } catch (error) {
    console.error(`Error posting ${conference} conference tweet:`, error.message);
  }
}

// Fonction principale pour poster les tweets NBA
async function postNBATweets() {
  const client = new TwitterApi({
    appKey: process.env.TWITTER_APP_KEY,
    appSecret: process.env.TWITTER_APP_SECRET,
    accessToken: process.env.TWITTER_ACCESS_TOKEN,
    accessSecret: process.env.TWITTER_ACCESS_SECRET,
  });

  try {
    const results = await getNBAResults();
    if (results.length === 0) {
      console.log('No game results available, skipping match tweets.');
    } else {
      const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
      for (const game of results) {
        await postMatchTweet(game, timestamp, client);
        await new Promise(resolve => setTimeout(resolve, 2000)); // Délai de 2s entre tweets
      }
    }

    const standings = await getStandings();
    const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
    await postConferenceTweet('east', standings.east, timestamp, client);
    await new Promise(resolve => setTimeout(resolve, 2000)); // Délai de 2s
    await postConferenceTweet('west', standings.west, timestamp, client);
  } catch (error) {
    console.error("Error in postNBATweets:", error.message);
    if (error.code === 429) {
      console.log('Twitter rate limit hit. Waiting 15 minutes...');
      await new Promise(resolve => setTimeout(resolve, 15 * 60 * 1000));
      await postNBATweets(); // Retry on rate limit
    }
  }
}

// Planification pour exécuter la fonction tous les jours à minuit (local/Render)
schedule.scheduleJob('0 0 * * *', async () => await postNBATweets());
postNBATweets().then(() => console.log("Tweets posted"));

// Route de base pour vérifier que le bot fonctionne (Render Web Service)
app.get('/run', (req, res) => res.send('NBA Twitter Bot running!'));

// Lancement du serveur Express (Render Web Service or local)
app.listen(PORT, () => {
  console.log(`NBA Bot started! Posting every 24 hours. Server running on port ${PORT}`);
});

// Export pour GitHub Actions
module.exports = { postNBATweets };
