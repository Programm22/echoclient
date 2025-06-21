# Territorial.io Game Client with Chat

A custom client for Territorial.io with an integrated chat system. This client allows players to chat with each other while playing the game, without requiring any downloads or installations.

## Features

- **Territorial.io Game**: Play the original game inside our client
- **Real-time Chat**: Chat with other players in real-time
- **User List**: See who's currently online
- **Username System**: Choose a unique username for the chat
- **Responsive Design**: Works on both desktop and mobile devices

## How to Use

1. Visit the [Territorial.io Chat Client](https://yourusername.github.io/territorial-chat/) 
2. Enter a username in the chat panel
3. Start chatting with other players
4. Enjoy the game with enhanced social features

## Chat System Options

This folder contains two versions of the chat system:

1. **Firebase Chat** (default):
   - Uses Firebase Realtime Database
   - Works on static hosting without a backend
   - Uses `chat.js` and `index.html`

2. **WebSocket Chat**:
   - Requires a WebSocket server (e.g., on Render.com)
   - Uses `ws-chat.js` and `ws-index.html`

## Switching Between Chat Systems

### For Firebase (Static) Chat:
Make sure `index.html` contains:
```html
<script src="chat.js"></script>
```

### For WebSocket Chat:
1. Rename `ws-index.html` to `index.html` (replace the existing file)
2. Update the WebSocket URL in `ws-chat.js`:
   - Find: `this.connectToWebSocket('wss://your-render-app.onrender.com');`
   - Replace with your actual Render.com WebSocket URL

## Deployment Instructions

### Deploying to GitHub Pages

1. Fork this repository
2. Enable GitHub Pages in your repository settings:
   - Go to Settings > Pages
   - Set Source to "main" branch and "/docs" folder
   - Click Save
3. Your site will be published at `https://yourusername.github.io/territorial-chat/`

### Customizing Your Deployment

#### Firebase Configuration
Replace the Firebase configuration in `chat.js` with your own:
1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com/)
2. Enable Realtime Database (start in test mode)
3. Copy your configuration from Project Settings > Your Apps
4. Replace the configuration in `chat.js`:

```javascript
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    databaseURL: "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};
```

#### WebSocket Configuration
If using the WebSocket version with a Render.com backend:
1. Deploy the server code to Render.com (see `/server/README.md`)
2. Update the WebSocket URL in `ws-chat.js` to point to your Render.com deployment
3. Rename `ws-index.html` to `index.html` to use the WebSocket version

## License

This project is for educational purposes only. Territorial.io is owned and operated by David Tschacher.

## Credits

- Game: [Territorial.io](https://territorial.io/) by David Tschacher
- Chat system: Custom implementation using Firebase Realtime Database or WebSockets
