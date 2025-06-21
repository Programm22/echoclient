import os
import webbrowser
import http.server
import socketserver
import threading
import socket
import time
import json
import sys
from pathlib import Path
import websockets
import asyncio
import uuid

# Get the directory of the current script
CURRENT_DIR = Path(__file__).parent.absolute()

# The ports to serve the web client and WebSocket server
HTTP_PORT = 8080
WS_PORT = 8081

# Global variables to track state
is_running = True
server_instance = None
connected_clients = {}  # WebSocket connections

def find_available_port(start_port=8000, max_attempts=10):
    """Find an available port starting from start_port"""
    current_port = start_port
    for _ in range(max_attempts):
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind(('', current_port))
                return current_port
        except OSError:
            current_port += 1
    print(f"Warning: Could not find an available port after {max_attempts} attempts.")
    return start_port  # Return the starting port and hope for the best

def start_server(port=HTTP_PORT):
    """Start a simple HTTP server to serve the web client files"""
    global server_instance
    
    # Use a custom handler to enable CORS for API requests
    class CORSHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
        def end_headers(self):
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type')
            http.server.SimpleHTTPRequestHandler.end_headers(self)
            
        def do_OPTIONS(self):
            self.send_response(200)
            self.end_headers()
            
        def do_GET(self):
            # Handle API requests
            if self.path.startswith('/api/'):
                if self.path == '/api/chat-info':
                    self.send_response(200)
                    self.send_header('Content-type', 'application/json')
                    self.end_headers()
                    
                    data = {
                        'ws_port': WS_PORT,
                        'online_users': len(connected_clients),
                        'chat_enabled': True
                    }
                    self.wfile.write(json.dumps(data).encode())
                    return
                
            # Handle normal file requests
            return http.server.SimpleHTTPRequestHandler.do_GET(self)

    # Change to the directory containing the HTML files
    os.chdir(CURRENT_DIR)
    
    # Create and start the server
    try:
        server_instance = socketserver.TCPServer(("", port), CORSHTTPRequestHandler)
        print(f"Server started at http://localhost:{port}")
        server_instance.serve_forever()
    except OSError as e:
        print(f"Error starting server: {e}")
        sys.exit(1)

def stop_server():
    """Stop the HTTP server"""
    global server_instance
    if server_instance:
        server_instance.shutdown()
        server_instance.server_close()
        print("Server stopped")

async def chat_server(websocket):
    """Handle WebSocket connections for the chat"""
    client_id = str(uuid.uuid4())
    username = None
    
    try:
        # Register the client
        connected_clients[client_id] = {"websocket": websocket, "username": username}
          # Send welcome message
        await websocket.send(json.dumps({
            "type": "system",
            "message": "Welcome to the Territorial.io chat! Please enter your username to begin.",
            "timestamp": time.time()
        }))
        
        # Notify all clients about user count update
        await broadcast_user_count()
        
        # Handle messages from this client
        async for message_str in websocket:
            try:
                message_data = json.loads(message_str)
                
                # Handle different message types
                if message_data["type"] == "join":
                    # User is setting their username
                    new_username = message_data.get("username", "").strip()
                    if new_username:
                        # Check if username is already taken
                        if any(client["username"] == new_username for client in connected_clients.values() if client["username"]):
                            await websocket.send(json.dumps({
                                "type": "error",
                                "message": f"Username '{new_username}' is already taken. Please choose another.",
                                "timestamp": time.time()
                            }))
                        else:
                            # Set the username
                            old_username = username
                            username = new_username
                            connected_clients[client_id]["username"] = username
                              # Notify the user
                            await websocket.send(json.dumps({
                                "type": "join_success",
                                "username": username,
                                "message": f"You are now chatting as {username}",
                                "timestamp": time.time()
                            }))
                            
                            # Notify all users if this is a new user (not a rename)
                            if not old_username:
                                await broadcast_message({
                                    "type": "system",
                                    "message": f"{username} has joined the chat",
                                    "timestamp": time.time()
                                })
                            
                            # Send updated user list to all clients
                            await broadcast_user_list()
                            
                elif message_data["type"] == "chat" and username:
                    # Regular chat message
                    chat_message = message_data.get("message", "").strip()
                    if chat_message:
                        # Broadcast the message to all clients
                        await broadcast_message({
                            "type": "chat",
                            "username": username,
                            "message": chat_message,
                            "timestamp": time.time()
                        })
                        
                elif message_data["type"] == "ping":
                    # Respond to ping with pong
                    await websocket.send(json.dumps({
                        "type": "pong",
                        "timestamp": time.time()
                    }))
                    
            except json.JSONDecodeError:
                # Ignore invalid JSON
                pass
    except websockets.exceptions.ConnectionClosed:
        # Connection closed, normal behavior
        pass
    finally:
        # Remove the client from connected_clients
        if client_id in connected_clients:
            del connected_clients[client_id]
            
        # Notify all remaining clients if a user left
        if username:
            await broadcast_message({
                "type": "system",
                "message": f"{username} has left the chat",
                "timestamp": time.time()
            })
            
        # Update user count for all clients
        await broadcast_user_count()
        await broadcast_user_list()

async def broadcast_message(message):
    """Broadcast a message to all connected clients"""
    message_json = json.dumps(message)
    tasks = [client["websocket"].send(message_json) for client in connected_clients.values()]
    if tasks:
        await asyncio.gather(*tasks, return_exceptions=True)

async def broadcast_user_count():
    """Broadcast user count to all connected clients"""
    count_message = json.dumps({
        "type": "user_count",
        "count": len(connected_clients),
        "timestamp": time.time()
    })
    tasks = [client["websocket"].send(count_message) for client in connected_clients.values()]
    if tasks:
        await asyncio.gather(*tasks, return_exceptions=True)

async def broadcast_user_list():
    """Broadcast the list of users to all connected clients"""
    user_list = [client["username"] for client in connected_clients.values() if client["username"]]
    list_message = json.dumps({
        "type": "user_list",
        "users": user_list,
        "timestamp": time.time()
    })
    tasks = [client["websocket"].send(list_message) for client in connected_clients.values()]
    if tasks:
        await asyncio.gather(*tasks, return_exceptions=True)

async def start_websocket_server(port=WS_PORT):
    """Start a WebSocket server for real-time chat"""
    try:
        server = await websockets.serve(chat_server, "localhost", port)
        print(f"WebSocket chat server started at ws://localhost:{port}")
        return server
    except OSError as e:
        print(f"Error starting WebSocket server: {e}")
        return None

def main():
    """Main function to start the servers and open the browser"""
    global is_running
    
    # Find available ports
    http_port = find_available_port(HTTP_PORT)
    # Make sure WS port is different from HTTP port
    ws_port = find_available_port(http_port + 1)
    
    if http_port != HTTP_PORT:
        print(f"HTTP Port {HTTP_PORT} is in use, using port {http_port} instead")
    if ws_port != WS_PORT:
        print(f"WebSocket Port {WS_PORT} is in use, using port {ws_port} instead")
    
    # Start the HTTP server in a separate thread
    server_thread = threading.Thread(target=start_server, args=(http_port,))
    server_thread.daemon = True  # Thread will exit when the main program exits
    server_thread.start()
    
    # Set up asyncio for the WebSocket server
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    
    # Start the WebSocket server
    ws_server = None
    
    def run_websocket_server():
        nonlocal ws_server
        ws_server = loop.run_until_complete(start_websocket_server(ws_port))
        loop.run_forever()
    
    ws_thread = threading.Thread(target=run_websocket_server)
    ws_thread.daemon = True
    ws_thread.start()
      # Wait a moment for the servers to start
    time.sleep(1)
    
    # Open the web client in the default browser
    webbrowser.open(f"http://localhost:{http_port}/index.html")
    
    print("Territorial.io Client launched!")
    print(f"HTTP Server: http://localhost:{http_port}")
    print(f"WebSocket Server: ws://localhost:{ws_port}")
    print("Press Ctrl+C to exit")
    
    try:
        # Keep the main thread running
        while is_running:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nExiting Chat Application...")
        stop_server()
        
        # Clean shutdown of the asyncio loop
        if ws_server:
            loop.call_soon_threadsafe(lambda: loop.stop())
            ws_thread.join(timeout=1.0)

if __name__ == "__main__":
    main()
