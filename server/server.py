import os
import http.server
import socketserver
import json
import time
import sys
from pathlib import Path
import websockets
import asyncio
import uuid

# The ports to serve the WebSocket server
# For Render.com, we'll use the PORT environment variable
WS_PORT = int(os.environ.get("PORT", 8081))

# Global variables to track state
connected_clients = {}  # WebSocket connections

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

async def main():
    """Main function to start the WebSocket server"""
    # Set up SSL context for secure connections (needed for production)
    ssl_context = None
    
    # Start the WebSocket server - Listen on all interfaces (0.0.0.0) for production
    server = await websockets.serve(
        chat_server, 
        host="0.0.0.0",  # Listen on all interfaces
        port=WS_PORT,
        ssl=ssl_context
    )
    
    print(f"WebSocket chat server started at ws://0.0.0.0:{WS_PORT}")
    
    # Keep the server running
    await server.wait_closed()

if __name__ == "__main__":
    asyncio.run(main())
