const { TwitterApi } = require('twitter-api-v2');
const schedule = require('node-schedule');
const axios = require('axios');
const cheerio = require('cheerio');
const express = require('express');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

const client = new TwitterApi({
    appKey: process.env.TWITTER_APP_KEY,
    appSecret: process.env.TWITTER_APP_SECRET,
    accessToken: process.env.TWITTER_ACCESS_TOKEN,
    accessSecret: process.env.TWITTER_ACCESS_SECRET,
});

const hashtags = "#NBA #Basketball #Stats";

// Fetch recent game results from ESPN
async function getRecentGameResult() {
    try {
        const response = await axios.get('https://www.espn.com/nba/scoreboard');
        const $ = cheerio.load(response.data);
        const games = [];

        // Scrape game data from the scoreboard
        $('.ScoreboardScoreCell').each((i, element) => {
            const teams = $(element).find('.ScoreCell_Score--scoreboard').text().split(' ');
            const scores = $(element).find('.ScoreCell_Score').map((j, el) => $(el).text()).get();
            if (scores.length === 2) {
                games.push(`${teams[0]} ${scores[0]} - ${teams[1]} ${scores[1]} (Final)`);
            }
        });

        if (games.length === 0) return "No recent NBA game results found.";
        return games[Math.floor(Math.random() * games.length)];
    } catch (error) {
        console.error("Error fetching game result:", error.message);
        return "Unable to fetch latest game result.";
    }
}

// Fetch a random stat (simplified, from game leaders on ESPN)
async function getRandomStat() {
    try {
        const response = await axios.get('https://www.espn.com/nba/scoreboard');
        const $ = cheerio.load(response.data);
        const stats = [];

        // Scrape leading scorers from game summaries
        $('.ScoreboardScoreCell__Leaders').each((i, element) => {
            const player = $(element).find('.Athlete__PlayerName').text();
            const points = $(element).find('.Stat__Value').text();
            const team = $(element).closest('.ScoreboardScoreCell').find('.ScoreCell_Score--scoreboard').text().split(' ')[0];
            if (player && points) {
                stats.push(`${player} scored ${points} points for ${team}.`);
            }
        });

        if (stats.length === 0) return "No player stats available.";
        return stats[Math.floor(Math.random() * stats.length)];
    } catch (error) {
        console.error("Error fetching stat:", error.message);
        return "Unable to fetch latest stat.";
    }
}

// Randomly select content type
async function getRandomNBAPost() {
    const isGameResult = Math.random() < 0.5;
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

// Start Express server
app.get('/', (req, res) => {
    res.send('NBA Twitter Bot is running!');
});

app.listen(PORT, () => {
    console.log(`NBA Bot started! Posting every 6 hours. Server running on port ${PORT}`);
});