const { TwitterApi } = require('twitter-api-v2');
const schedule = require('node-schedule');
const express = require('express');
const puppeteer = require('puppeteer');
require('dotenv').config({ path: './keys.env' });

const app = express();
const PORT = process.env.PORT || 3000;

const client = new TwitterApi({
  appKey: process.env.TWITTER_APP_KEY,
  appSecret: process.env.TWITTER_APP_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_SECRET,
});

const hashtags = "#NBA #Basketball #Stats";

async function getNBAResults() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  try {
    const today = new Date();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const year = today.getFullYear();
    let url = `https://www.basketball-reference.com/boxscores/?month=${month}&day=${day}&year=${year}`;
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    await new Promise(resolve => setTimeout(resolve, 5000));

    let results = await page.evaluate(() => {
      const games = Array.from(document.querySelectorAll('div.game_summary'));
      return games.map(game => {
        const date = document.querySelector('h1')?.textContent.trim() || 'N/A';
        const teams = Array.from(game.querySelectorAll('table.teams tbody tr'));
        const awayTeam = teams[0]?.querySelector('td:first-child')?.textContent.trim() || 'N/A';
        const awayScore = teams[0]?.querySelector('td:nth-child(2)')?.textContent.trim() || 'N/A';
        const homeTeam = teams[1]?.querySelector('td:first-child')?.textContent.trim() || 'N/A';
        const homeScore = teams[1]?.querySelector('td:nth-child(2)')?.textContent.trim() || 'N/A';
        const score = (homeScore !== 'N/A' && awayScore !== 'N/A') ? `${homeScore}-${awayScore}` : 'Final';
        return { date, homeTeam, awayTeam, score };
      }).filter(item => item.homeTeam !== 'N/A');
    });

    // Fallback to yesterday if no results
    if (results.length === 0) {
      console.log('No games today, trying yesterday...');
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      const yMonth = String(yesterday.getMonth() + 1).padStart(2, '0');
      const yDay = String(yesterday.getDate()).padStart(2, '0');
      const yYear = yesterday.getFullYear();
      url = `https://www.basketball-reference.com/boxscores/?month=${yMonth}&day=${yDay}&year=${yYear}`;
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise(resolve => setTimeout(resolve, 5000));

      results = await page.evaluate(() => {
        const games = Array.from(document.querySelectorAll('div.game_summary'));
        return games.map(game => {
          const date = document.querySelector('h1')?.textContent.trim() || 'N/A';
          const teams = Array.from(game.querySelectorAll('table.teams tbody tr'));
          const awayTeam = teams[0]?.querySelector('td:first-child')?.textContent.trim() || 'N/A';
          const awayScore = teams[0]?.querySelector('td:nth-child(2)')?.textContent.trim() || 'N/A';
          const homeTeam = teams[1]?.querySelector('td:first-child')?.textContent.trim() || 'N/A';
          const homeScore = teams[1]?.querySelector('td:nth-child(2)')?.textContent.trim() || 'N/A';
          const score = (homeScore !== 'N/A' && awayScore !== 'N/A') ? `${homeScore}-${awayScore}` : 'Final';
          return { date, homeTeam, awayTeam, score };
        }).filter(item => item.homeTeam !== 'N/A');
      });
    }

    if (results.length === 0) {
      console.error('Aucun résultat trouvé');
    } else {
      console.log('Résultats récupérés:', results);
    }

    return results;
  } catch (error) {
    console.error('Scraping Error:', error.message);
    return [];
  } finally {
    await browser.close();
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

schedule.scheduleJob('0 0 * * *', async () => await postNBATweet()); // Daily at midnight
postNBATweet().then(() => console.log("Premier tweet envoyé"));

app.get('/run', (req, res) => res.send('NBA Twitter Bot en fonctionnement!'));
app.listen(PORT, () => {
  console.log(`NBA Bot démarré! Publication toutes les 6 heures. Serveur en fonctionnement sur le port ${PORT}`);
});

getAllGamesPost().then(result => console.log("Résultat de getAllGamesPost:", result));