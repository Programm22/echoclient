# Territorial.io Chat Server

This is the WebSocket server for the Territorial.io chat client. It handles real-time chat messages between players.

## Deployment on Render.com

Follow these steps to deploy the WebSocket server on Render.com:

1. **Create a Render.com Account**:
   - Sign up at [Render.com](https://render.com/)

2. **Create a New Web Service**:
   - Click "New" > "Web Service"
   - Connect your GitHub repository or use the Render Git service

3. **Configure the Web Service**:
   - Set the following configuration:
     - **Name**: territorial-chat (or your preferred name)
     - **Root Directory**: server
     - **Runtime**: Python 3
     - **Build Command**: pip install -r requirements.txt
     - **Start Command**: python server.py

4. **Deploy**:
   - Click "Create Web Service"
   - Wait for the deployment to complete
   - Note the URL of your service (e.g., https://territorial-chat.onrender.com)

5. **Update Client Configuration**:
   - Once deployed, you need to update the WebSocket URL in the client
   - Open `docs/ws-chat.js`
   - Find the line with `this.connectToWebSocket('wss://your-render-app.onrender.com');`
   - Replace `your-render-app.onrender.com` with your actual Render.com domain
   - Use `wss://` protocol for secure connections (Render.com uses HTTPS)

## Local Development

To run the server locally:

1. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

2. **Run the Server**:
   ```bash
   python test.py  # For local testing with the full application
   # OR
   python server.py  # For testing just the WebSocket server
   ```

3. **Access the Client**:
   - When using test.py, it will automatically open the client in your browser
   - Or manually open http://localhost:8080 in your browser

## Files

- **server.py**: Production WebSocket server for Render.com deployment
- **test.py**: Development server with integrated HTTP server
- **requirements.txt**: Python dependencies
- **Procfile**: Deployment configuration for Render.com

## Troubleshooting

- **Connection Issues**: Ensure your Render.com service is running and the WebSocket URL is correct
- **CORS Issues**: The server is configured to accept connections from any origin
- **Port Issues**: Render.com will automatically assign a port via the PORT environment variable
