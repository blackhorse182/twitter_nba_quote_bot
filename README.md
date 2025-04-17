# twitter_nba_quote_bot

This bot is designed to interact with Twitter and provide engaging NBA-related quotes. It automates the process of fetching, formatting, and posting quotes about NBA players, teams, or moments. The bot can be customized to include specific hashtags, mentions, or other content to increase visibility and engagement.

## Features

- Fetches NBA-related quotes from a predefined source or API.
- Formats the quotes for Twitter's character limit.
- Automatically posts tweets at scheduled intervals.
- Includes hashtags and mentions to improve discoverability.

## Requirements

- rapidAPI credentials
- Twitter API credentials (API key, API secret, Access token, Access token secret)
- Dependencies listed in `requirements.txt`

## Installation

1. Clone the repository:

    ```bash
    git clone https://github.com/yourusername/twitter_nba_quote_bot.git
    ```plaintext

2. Navigate to the project directory:

    ```bash
    cd twitter_nba_quote_bot
    ```

3. Install dependencies:

    ```bash
    pip install -r requirements.txt
    ```

## Usage

1. Set up your Twitter API credentials in a `.env` file:

    ```
    API_KEY=your_api_key
    API_SECRET=your_api_secret
    ACCESS_TOKEN=your_access_token
    ACCESS_TOKEN_SECRET=your_access_token_secret
    ```

2. Run the bot:

    ```bash
    python bot.py
    ```

## Contributing

Contributions are welcome! Feel free to open an issue or submit a pull request.

## License

This project is licensed under the MIT License. See the `LICENSE` file for details.
