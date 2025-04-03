const { TwitterApi } = require('twitter-api-v2');
const schedule = require('node-schedule');
const axios = require('axios');
const express = require('express');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

const client = new TwitterApi({
    appKey: 'MQnQJz6JfQ6FdbhGjmsgtN5aE', // Remplace par ta vraie API Key
    appSecret: 'MO4J0paVS0kvmPvSh715OjDU5R8cjJuWlOPN6Zz5JDPZqgmb5G',         // Remplace par ton vrai API Secret
    accessToken: '1509015998317404161-0PtKc05VWPikCLXyKtXvIIo5IQ8GUF',    // Ton Access Token
    accessSecret: 'ejdT2uFYLQXFvHM1rkoJXe6U2FX0PHTqWjgqVQhm3EmoL',  // Ton Access Secret
  });

const hashtags = "#NBA #Basketball #Stats";
const SPORTS_DATA_API_KEY = process.env.SPORTS_DATA_API_KEY;

// Fetch a random recent game result
async function getRecentGameResult() {
    try {
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const response = await axios.get(
            `https://api.sportsdata.io/v3/nba/scores/json/GamesByDate/${today}?key=${SPORTS_DATA_API_KEY}`
        );
        const games = response.data.filter(game => game.Status === "Final"); // Only completed games
        if (games.length === 0) return "No completed NBA games found for today.";

        const randomGame = games[Math.floor(Math.random() * games.length)];
        return `${randomGame.AwayTeam} ${randomGame.AwayTeamScore} - ${randomGame.HomeTeam} ${randomGame.HomeTeamScore} (Final)`;
    } catch (error) {
        console.error("Error fetching game result:", error.message);
        return "Unable to fetch latest game result.";
    }
}

// Fetch a random stat from a recent game
async function getRandomStat() {
    try {
        const today = new Date().toISOString().split('T')[0];
        const response = await axios.get(
            `https://api.sportsdata.io/v3/nba/stats/json/PlayerGameStatsByDate/${today}?key=${SPORTS_DATA_API_KEY}`
        );
        const stats = response.data.filter(stat => stat.Minutes > 0); // Players who played
        if (stats.length === 0) return "No player stats available for today.";

        const topScorer = stats.reduce((prev, curr) => (curr.Points > prev.Points ? curr : prev), stats[0]);
        return `${topScorer.Name} scored ${topScorer.Points} points for ${topScorer.Team}.`;
    } catch (error) {
        console.error("Error fetching stat:", error.message);
        return "Unable to fetch latest stat.";
    }
}

// Randomly select content type
async function getRandomNBAPost() {
    const isGameResult = Math.random() < 0.5; // 50% chance for game or stat
    return isGameResult ? await getRecentGameResult() : await getRandomStat();
}

// Post to Twitter
async function postNBATweet() {
    const content = await getRandomNBAPost();
    const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const tweet = `${content} ${hashtags} [${timestamp}]`;

    try {
        if (tweet.length > 280) {
            const shortTweet = `${content.substring(0, 280 - hashtags.length - timestamp.length - 5)}... ${hashtags} [${timestamp}]`;
            await client.v2.tweet(shortTweet);
            console.log(`Short tweet posted: ${shortTweet}`);
        } else {
            await client.v2.tweet(tweet);
            console.log(`Tweet posted: ${tweet}`);
        }
    } catch (error) {
        console.error("Error posting tweet:", error.message);
    }
}

// Schedule posts every 6 hours
schedule.scheduleJob('0 */6 * * *', () => {
    postNBATweet();
});

// Initial post on startup
postNBATweet();

// Start Express server for deployment
app.get('/', (req, res) => {
    res.send('NBA Twitter Bot is running!');
});

app.listen(PORT, () => {
    console.log(`NBA Bot started! Posting every 6 hours. Server running on port ${PORT}`);
});