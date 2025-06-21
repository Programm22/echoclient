import os
import http.server
import asyncio
import websockets
import json
import time
import uuid
from pathlib import Path

# Get the port from the environment (Render sets this automatically)
PORT = int(os.environ.get("PORT", 8080))

# Global variables
connected_clients = {}

# Simple HTTP handler for health checks
async def http_handler(path, request_headers):
    if path == "/health":
        return http.HTTPStatus.OK, {}, b"OK"
    
    # Return 404 for other paths
    return http.HTTPStatus.NOT_FOUND, {}, b"Not Found"

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
        
        # Handle incoming messages
        async for message_str in websocket:
            try:
                message_data = json.loads(message_str)
                
                if message_data["type"] == "join":
                    new_username = message_data.get("username", "").strip()
                    if new_username:
                        if any(client["username"] == new_username for client in connected_clients.values() if client["username"]):
                            # Username is taken
                            await websocket.send(json.dumps({
                                "type": "error",
                                "message": f"Username '{new_username}' is already taken.",
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
                    # Send a pong response
                    await websocket.send(json.dumps({
                        "type": "pong",
                        "timestamp": time.time()
                    }))
                    
            except json.JSONDecodeError:
                print(f"Invalid JSON received: {message_str}")
                
    except websockets.exceptions.ConnectionClosed:
        print(f"Client disconnected: {client_id}")
    finally:
        # Remove the client when they disconnect
        if client_id in connected_clients:
            del connected_clients[client_id]
            
        # Notify others if the user had set a username
        if username:
            await broadcast_message({
                "type": "system",
                "message": f"{username} has left the chat",
                "timestamp": time.time()
            })
            
        # Update user list
        await broadcast_user_list()
        await broadcast_user_count()

async def broadcast_message(message):
    """Send a message to all connected clients"""
    message_json = json.dumps(message)
    for client in connected_clients.values():
        try:
            await client["websocket"].send(message_json)
        except websockets.exceptions.ConnectionClosed:
            pass

async def broadcast_user_count():
    """Send the current user count to all clients"""
    count = sum(1 for client in connected_clients.values() if client["username"])
    await broadcast_message({
        "type": "user_count",
        "count": count,
        "timestamp": time.time()
    })

async def broadcast_user_list():
    """Send the user list to all connected clients"""
    users = [client["username"] for client in connected_clients.values() if client["username"]]
    await broadcast_message({
        "type": "user_list",
        "users": users,
        "timestamp": time.time()
    })

async def main():
    # Set up the WebSocket server with HTTP request handler
    async with websockets.serve(
        chat_server, 
        "0.0.0.0", 
        PORT, 
        process_request=http_handler,
        ping_interval=30,
        ping_timeout=10
    ):
        print(f"Server started on port {PORT}")
        print(f"WebSocket endpoint: ws://0.0.0.0:{PORT}")
        print(f"Health check endpoint: http://0.0.0.0:{PORT}/health")
        await asyncio.Future()  # Run forever

if __name__ == "__main__":
    asyncio.run(main())
