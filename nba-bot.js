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
    const dates = [];
    for (let i = 1; i <= 7; i++) { // Check last 7 days
      const pastDate = new Date(today);
      pastDate.setDate(today.getDate() - i);
      dates.push(pastDate.toISOString().split('T')[0]); // YYYY-MM-DD
    }

    const response = await axios.get('https://www.balldontlie.io/api/v1/games', {
      params: {
        dates: dates,
        per_page: 100,
      },
    });

    const games = response.data.data;
    if (games.length === 0) {
      console.log('No games found in the last 7 days:', dates);
      return [];
    }

    const results = games.map(game => ({
      date: new Date(game.date).toDateString(),
      homeTeam: game.home_team.full_name,
      awayTeam: game.visitor_team.full_name,
      score: `${game.home_team_score}-${game.visitor_team_score}`,
    }));

    console.log('Résultats récupérés:', results);
    return results;
  } catch (error) {
    if (error.response && error.response.status === 404) {
      console.log('No games found for the requested dates');
      return [];
    }
    console.error('API Error:', error.message);
    return [];
  }
}

async function getAllGamesPost() {
  try {
    const results = await getNBAResults();
    if (results.length === 0) throw new Error("Aucun résultat trouvé.");

    let postContent = `${results[0].date}:\n`;
    for (const game of results) {
      const gameLine = `${game.homeTeam} ${game.score} ${game.awayTeam}\n`;
      postContent += gameLine;
    }
    postContent += hashtags;

    if (postContent.length > 280) {
      const maxContentLength = 280 - hashtags.length - 4;
      postContent = `${postContent.substring(0, maxContentLength)}... ${hashtags}`;
    }

    return postContent;
  } catch (error) {
    console.error('Erreur lors de la récupération des résultats NBA:', error.message);
    return 'Erreur lors de la récupération des résultats NBA.';
  }
}

async function postNBATweet() {
  try {
    const content = await getAllGamesPost();
    if (content === 'Erreur lors de la récupération des résultats NBA.') {
      console.log('No game results available, skipping tweet.');
      return;
    }
    if (typeof content !== 'string') throw new Error("Contenu invalide.");
    const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const tweet = `${content} [${timestamp}]`;

    if (tweet.length > 280) {
      const shortTweet = `${content.substring(0, 280 - timestamp.length - 4)}... [${timestamp}]`;
      await client.v2.tweet(shortTweet);
      console.log(`Tweet court envoyé: ${shortTweet}`);
    } else {
      await client.v2.tweet(tweet);
      console.log(`Tweet envoyé: ${tweet}`);
    }
  } catch (error) {
    console.error("Erreur lors de l'envoi du tweet:", error.message);
    if (error.code === 429) {
      console.log('Rate limit hit. Waiting 15 minutes...');
      await new Promise(resolve => setTimeout(resolve, 15 * 60 * 1000));
      await postNBATweet();
    }
  }
}

schedule.scheduleJob('0 0 * * *', async () => await postNBATweet());
postNBATweet().then(() => console.log("Premier tweet envoyé"));

app.get('/', (req, res) => res.send('NBA Twitter Bot en fonctionnement!'));
app.listen(PORT, () => {
  console.log(`NBA Bot démarré! Publication toutes les 24 heures. Serveur en fonctionnement sur le port ${PORT}`);
});

getAllGamesPost().then(result => console.log("Résultat de getAllGamesPost:", result));