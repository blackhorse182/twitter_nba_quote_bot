const { TwitterApi } = require('twitter-api-v2');
const schedule = require('node-schedule');
const axios = require('axios');
const cheerio = require('cheerio');
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

  // Fetch recent game results from ESPN with NBA.com fallback
  async function getRecentGameResult() {
      try {
          const response = await axios.get('https://www.espn.com/nba/scoreboard');
          const $ = cheerio.load(response.data);
          const games = [];
  
          $('.ScoreboardScoreCell').each((i, element) => {
              const teams = $(element).find('.ScoreCell_Score--scoreboard').text().split(' ');
              const scores = $(element).find('.ScoreCell_Score').map((j, el) => $(el).text()).get();
              if (scores.length === 2) {
                  games.push(`${teams[0]} ${scores[0]} - ${teams[1]} ${scores[1]} (Final)`);
              }
          });
  
          if (games.length === 0) {
              return await getFallbackGameResult();
          }
          return games[Math.floor(Math.random() * games.length)];
      } catch (error) {
          console.error("Error fetching game result from ESPN:", error.message);
          return await getFallbackGameResult();
      }
  }
  
  // Fallback game result from NBA.com
  async function getFallbackGameResult() {
      try {
          const response = await axios.get('https://www.nba.com/games');
          const $ = cheerio.load(response.data);
          const games = [];
  
          // Scrape game cards from NBA.com
          $('.GameCardMatchup_gcMatchupLink__YOsQA').each((i, element) => {
              const gameBlock = $(element).closest('.GameCard_gc__n6XNv');
              const teams = gameBlock.find('.MatchupCardTeamName_base__1q7Zg').map((j, el) => $(el).text().trim()).get();
              const scores = gameBlock.find('.GameCardScore_score__q_3aN').map((j, el) => $(el).text().trim()).get();
              const status = gameBlock.find('.GameCardStatusText_gcsText__25-CQ').text().trim();
  
              if (teams.length === 2 && scores.length === 2 && status.includes('Final')) {
                  games.push(`${teams[0]} ${scores[0]} - ${teams[1]} ${scores[1]} (Final, Historical)`);
              }
          });
  
          if (games.length === 0) return "No historical NBA game results available from NBA.com.";
          return games[Math.floor(Math.random() * games.length)];
      } catch (error) {
          console.error("Error fetching fallback game result from NBA.com:", error.message);
          return "Unable to fetch historical game result.";
      }
  }
  
  // Fetch a random stat from ESPN with NBA.com fallback
  async function getRandomStat() {
      try {
          const response = await axios.get('https://www.espn.com/nba/scoreboard');
          const $ = cheerio.load(response.data);
          const stats = [];
  
          $('.ScoreboardScoreCell__Leaders').each((i, element) => {
              const player = $(element).find('.Athlete__PlayerName').text();
              const points = $(element).find('.Stat__Value').text();
              const team = $(element).closest('.ScoreboardScoreCell').find('.ScoreCell_Score--scoreboard').text().split(' ')[0];
              if (player && points) {
                  stats.push(`${player} scored ${points} points for ${team}.`);
              }
          });
  
          if (stats.length === 0) {
              return await getFallbackStat();
          }
          return stats[Math.floor(Math.random() * stats.length)];
      } catch (error) {
          console.error("Error fetching stat from ESPN:", error.message);
          return await getFallbackStat();
      }
  }
  
  // Fallback stat from NBA.com (simplified, using game leaders)
  async function getFallbackStat() {
      try {
          const response = await axios.get('https://www.nba.com/games');
          const $ = cheerio.load(response.data);
          const stats = [];
  
          // Scrape game cards for leader info
          $('.GameCard_gc__n6XNv').each((i, element) => {
              const team = $(element).find('.MatchupCardTeamName_base__1q7Zg').first().text().trim();
              const leaderText = $(element).find('.GameCardLeaderStat_statValue__kj4Go').first().text().trim();
              const status = $(element).find('.GameCardStatusText_gcsText__25-CQ').text().trim();
  
              if (leaderText && status.includes('Final')) {
                  // Assuming leaderText is points (simplified; may need adjustment)
                  stats.push(`A player scored ${leaderText} points for ${team} (Historical).`);
              }
          });
  
          if (stats.length === 0) return "No historical NBA stats available from NBA.com.";
          return stats[Math.floor(Math.random() * stats.length)];
      } catch (error) {
          console.error("Error fetching fallback stat from NBA.com:", error.message);
          return "Unable to fetch historical stat.";
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