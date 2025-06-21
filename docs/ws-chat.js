// chat.js - Client chat functionality (WebSocket version for hosted deployment)

class ChatSystem {
    constructor() {
        this.chatWindow = null;
        this.chatInput = null;
        this.chatMessages = null;
        this.username = "";
        this.isMinimized = false;
        this.unreadCount = 0;
        this.messageColors = {};
        this.socket = null;
        this.isConnected = false;
        this.reconnectInterval = null;
        this.onlineUsers = [];
        this.isVisible = true;
        this.isChangingUsername = false;
        
        // Initialize the chat UI
        this.init();
    }

    async init() {
        // Create chat UI
        this.createChatUI();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Connect to WebSocket server
        // REPLACE THIS URL with your Render.com deployment URL
        this.connectToWebSocket('https://echoclient.onrender.com');
    }

    createChatUI() {
        // Create chat container
        const chatContainer = document.createElement('div');
        chatContainer.className = 'chat-container';
        chatContainer.innerHTML = `
            <div class="chat-header">
                <span class="chat-title">Territorial.io Chat</span>
                <span class="chat-online-count">0 online</span>
                <div class="chat-controls">
                    <button class="minimize-btn">−</button>
                    <button class="close-btn">×</button>
                </div>
            </div>
            <div class="chat-messages"></div>
            <div class="user-list-container">
                <h3>Online Users</h3>
                <ul class="user-list"></ul>
            </div>
            <div class="username-display" style="display: none;">
                <span>Chatting as: </span>
                <span class="current-username"></span>
                <button class="change-username-btn">Change</button>
            </div>
            <div class="chat-input-container">
                <input type="text" class="chat-input" placeholder="Enter username to join chat...">
                <button class="chat-send-btn">Join</button>
            </div>
        `;
        
        document.body.appendChild(chatContainer);
        
        // Store references to elements
        this.chatWindow = chatContainer;
        this.chatInput = chatContainer.querySelector('.chat-input');
        this.chatMessages = chatContainer.querySelector('.chat-messages');
        this.sendButton = chatContainer.querySelector('.chat-send-btn');
        this.userList = chatContainer.querySelector('.user-list');
        this.usernameDisplay = chatContainer.querySelector('.username-display');
        this.currentUsernameSpan = chatContainer.querySelector('.current-username');
        this.changeUsernameBtn = chatContainer.querySelector('.change-username-btn');
        
        // Make this instance available globally
        window.chatSystem = this;
    }

    setupEventListeners() {
        // Send button
        this.sendButton.addEventListener('click', () => {
            if (this.isChangingUsername) {
                // This case is handled by the one-time event listeners in startUsernameChange
                return;
            }
            
            if (!this.username) {
                this.joinChat();
            } else {
                this.sendMessage();
            }
        });
        
        // Enter key in input
        this.chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                if (this.isChangingUsername) {
                    // This case is handled by the one-time event listeners in startUsernameChange
                    return;
                }
                
                if (!this.username) {
                    this.joinChat();
                } else {
                    this.sendMessage();
                }
            }
        });
        
        // Change username button
        this.changeUsernameBtn.addEventListener('click', () => {
            this.startUsernameChange();
        });
        
        // Minimize button
        const minimizeBtn = this.chatWindow.querySelector('.minimize-btn');
        minimizeBtn.addEventListener('click', () => this.toggleMinimize());
        
        // Close button
        const closeBtn = this.chatWindow.querySelector('.close-btn');
        closeBtn.addEventListener('click', () => this.closeChat());
    }

    connectToWebSocket(serverUrl) {
        try {
            // Close existing connection if any
            if (this.socket) {
                this.socket.close();
            }
            
            // Create a new WebSocket connection
            this.socket = new WebSocket(serverUrl);
            
            // Connection opened
            this.socket.addEventListener('open', () => {
                this.isConnected = true;
                console.log('Connected to chat server');
                
                // Clear any reconnect interval
                if (this.reconnectInterval) {
                    clearInterval(this.reconnectInterval);
                    this.reconnectInterval = null;
                }
                
                // Update UI to show connected state
                this.chatWindow.classList.add('connected');
                
                // Show welcome message
                this.addSystemMessage("Connected to chat server. Enter a username to join the conversation.");
            });
            
            // Listen for messages
            this.socket.addEventListener('message', (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleServerMessage(data);
                } catch (error) {
                    console.error('Error parsing message:', error);
                }
            });
            
            // Connection closed
            this.socket.addEventListener('close', () => {
                this.isConnected = false;
                console.log('Disconnected from chat server');
                
                // Update UI to show disconnected state
                this.chatWindow.classList.remove('connected');
                
                // Show disconnection message
                this.addSystemMessage("Disconnected from chat server. Attempting to reconnect...");
                
                // Attempt to reconnect
                if (!this.reconnectInterval) {
                    this.reconnectInterval = setInterval(() => {
                        this.connectToWebSocket(serverUrl);
                    }, 5000); // Try to reconnect every 5 seconds
                }
            });
            
            // Connection error
            this.socket.addEventListener('error', (error) => {
                console.error('WebSocket error:', error);
                
                // Show error message
                this.addSystemMessage("Error connecting to chat server.");
            });
            
        } catch (error) {
            console.error('Error connecting to WebSocket:', error);
            this.addSystemMessage("Could not connect to chat server.");
        }
    }

    handleServerMessage(data) {
        // Handle different message types from the server
        switch (data.type) {
            case 'chat':
                // Regular chat message
                this.addChatMessage(data.username, data.message, data.timestamp);
                break;
                
            case 'system':
                // System message
                this.addSystemMessage(data.message);
                break;
                
            case 'error':
                // Error message
                this.addErrorMessage(data.message);
                break;
                
            case 'join_success':
                // Username accepted
                this.username = data.username;
                this.addSystemMessage(data.message);
                this.updateUsernameDisplay();
                break;
                
            case 'user_count':
                // Update user count
                this.updateUserCount(data.count);
                break;
                
            case 'user_list':
                // Update user list
                this.onlineUsers = data.users;
                this.updateUserList(data.users);
                break;
                
            case 'pong':
                // Server responded to ping
                console.log('Pong received at', new Date(data.timestamp * 1000).toLocaleTimeString());
                break;
                
            default:
                console.log('Unknown message type:', data.type);
                break;
        }
    }

    joinChat() {
        // Get username from input
        const username = this.chatInput.value.trim();
        
        if (!username) {
            this.addErrorMessage("Please enter a username.");
            return;
        }
        
        if (!this.isConnected) {
            this.addErrorMessage("Not connected to chat server. Please wait...");
            return;
        }
        
        // Send join message to server
        this.socket.send(JSON.stringify({
            type: 'join',
            username: username,
            timestamp: Date.now() / 1000
        }));
        
        // Clear input
        this.chatInput.value = '';
        
        // Update placeholder
        this.chatInput.placeholder = 'Type a message...';
        this.sendButton.textContent = 'Send';
    }

    sendMessage() {
        // Get message from input
        const message = this.chatInput.value.trim();
        
        if (!message) {
            return;
        }
        
        if (!this.isConnected) {
            this.addErrorMessage("Not connected to chat server. Please wait...");
            return;
        }
        
        // Send chat message to server
        this.socket.send(JSON.stringify({
            type: 'chat',
            message: message,
            timestamp: Date.now() / 1000
        }));
        
        // Clear input
        this.chatInput.value = '';
    }

    startUsernameChange() {
        this.isChangingUsername = true;
        
        // Update input for username change
        this.chatInput.value = this.username;
        this.chatInput.placeholder = 'Enter new username...';
        this.sendButton.textContent = 'Update';
        this.chatInput.focus();
        
        // Create one-time event listeners for handling the username change
        const handleSubmit = () => {
            const newUsername = this.chatInput.value.trim();
            
            if (newUsername && newUsername !== this.username) {
                // Send join message to server with new username
                this.socket.send(JSON.stringify({
                    type: 'join',
                    username: newUsername,
                    timestamp: Date.now() / 1000
                }));
            } else if (newUsername === this.username) {
                // No change, just reset
                this.addSystemMessage("Username unchanged.");
            }
            
            // Reset input
            this.chatInput.value = '';
            this.chatInput.placeholder = 'Type a message...';
            this.sendButton.textContent = 'Send';
            
            // Remove one-time event listeners
            this.sendButton.removeEventListener('click', clickHandler);
            this.chatInput.removeEventListener('keypress', keypressHandler);
            
            this.isChangingUsername = false;
        };
        
        // Define handlers that we can remove later
        const clickHandler = () => handleSubmit();
        const keypressHandler = (e) => {
            if (e.key === 'Enter') {
                handleSubmit();
            }
        };
        
        // Add one-time event listeners
        this.sendButton.addEventListener('click', clickHandler);
        this.chatInput.addEventListener('keypress', keypressHandler);
    }

    updateUsernameDisplay() {
        if (this.username) {
            // Show username display with current username
            this.usernameDisplay.style.display = 'flex';
            this.currentUsernameSpan.textContent = this.username;
            
            // Update input placeholder
            this.chatInput.placeholder = 'Type a message...';
            this.sendButton.textContent = 'Send';
        } else {
            // Hide username display
            this.usernameDisplay.style.display = 'none';
            
            // Reset input placeholder
            this.chatInput.placeholder = 'Enter username to join chat...';
            this.sendButton.textContent = 'Join';
        }
    }

    addChatMessage(username, message, timestamp) {
        // Create message element
        const messageElement = document.createElement('div');
        messageElement.className = 'chat-message';
        
        // Get or generate color for username
        let userColor = this.messageColors[username];
        if (!userColor) {
            // Generate a color based on username
            const hue = Math.abs(this.hashCode(username) % 360);
            userColor = `hsl(${hue}, 70%, 60%)`;
            this.messageColors[username] = userColor;
        }
        
        // Format timestamp
        const date = new Date(timestamp * 1000);
        const timeString = date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        
        // Build message HTML
        messageElement.innerHTML = `
            <div class="message-header">
                <span class="message-username" style="color: ${userColor}">${username}</span>
                <span class="message-time">${timeString}</span>
            </div>
            <div class="message-content">${this.escapeHTML(message)}</div>
        `;
        
        // Add message to chat
        this.chatMessages.appendChild(messageElement);
        
        // Scroll to bottom
        this.scrollToBottom();
        
        // If chat is minimized, increment unread count
        if (this.isMinimized) {
            this.unreadCount++;
            this.updateUnreadBadge();
        }
    }

    addSystemMessage(message) {
        // Create message element
        const messageElement = document.createElement('div');
        messageElement.className = 'chat-message system-message';
        
        // Format timestamp
        const date = new Date();
        const timeString = date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        
        // Build message HTML
        messageElement.innerHTML = `
            <div class="message-header">
                <span class="message-username">System</span>
                <span class="message-time">${timeString}</span>
            </div>
            <div class="message-content">${this.escapeHTML(message)}</div>
        `;
        
        // Add message to chat
        this.chatMessages.appendChild(messageElement);
        
        // Scroll to bottom
        this.scrollToBottom();
    }

    addErrorMessage(message) {
        // Create message element
        const messageElement = document.createElement('div');
        messageElement.className = 'chat-message error-message';
        
        // Format timestamp
        const date = new Date();
        const timeString = date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        
        // Build message HTML
        messageElement.innerHTML = `
            <div class="message-header">
                <span class="message-username">Error</span>
                <span class="message-time">${timeString}</span>
            </div>
            <div class="message-content">${this.escapeHTML(message)}</div>
        `;
        
        // Add message to chat
        this.chatMessages.appendChild(messageElement);
        
        // Scroll to bottom
        this.scrollToBottom();
    }

    updateUserCount(count) {
        // Update user count in UI
        const countElement = this.chatWindow.querySelector('.chat-online-count');
        countElement.textContent = `${count} online`;
    }

    updateUserList(users) {
        // Update user list in UI
        this.userList.innerHTML = '';
        
        if (users.length === 0) {
            const emptyItem = document.createElement('li');
            emptyItem.textContent = 'No users online';
            emptyItem.className = 'empty-list';
            this.userList.appendChild(emptyItem);
            return;
        }
        
        // Sort users alphabetically
        users.sort();
        
        // Create user list items
        users.forEach(username => {
            const userItem = document.createElement('li');
            
            // Get color for username
            let userColor = this.messageColors[username];
            if (!userColor) {
                // Generate a color based on username
                const hue = Math.abs(this.hashCode(username) % 360);
                userColor = `hsl(${hue}, 70%, 60%)`;
                this.messageColors[username] = userColor;
            }
            
            userItem.innerHTML = `<span style="color: ${userColor}">${username}</span>`;
            
            // Highlight current user
            if (username === this.username) {
                userItem.className = 'current-user';
            }
            
            this.userList.appendChild(userItem);
        });
    }

    scrollToBottom() {
        // Scroll chat to bottom
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    toggleMinimize() {
        // Toggle minimized state
        this.isMinimized = !this.isMinimized;
        
        if (this.isMinimized) {
            this.chatWindow.classList.add('minimized');
        } else {
            this.chatWindow.classList.remove('minimized');
            
            // Reset unread count
            this.unreadCount = 0;
            this.updateUnreadBadge();
            
            // Scroll to bottom
            this.scrollToBottom();
        }
    }

    toggleVisibility() {
        // Toggle visibility
        this.isVisible = !this.isVisible;
        
        if (this.isVisible) {
            this.chatWindow.style.display = 'flex';
            
            // Reset unread count
            this.unreadCount = 0;
            this.updateUnreadBadge();
            
            // Scroll to bottom
            this.scrollToBottom();
        } else {
            this.chatWindow.style.display = 'none';
        }
    }

    closeChat() {
        // Hide chat window
        this.isVisible = false;
        this.chatWindow.style.display = 'none';
    }

    updateUnreadBadge() {
        // Update unread count badge
        const minimizeBtn = this.chatWindow.querySelector('.minimize-btn');
        
        if (this.unreadCount > 0) {
            minimizeBtn.setAttribute('data-unread', this.unreadCount);
        } else {
            minimizeBtn.removeAttribute('data-unread');
        }
    }

    escapeHTML(text) {
        // Escape HTML special characters
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    hashCode(str) {
        // Simple hash function for generating colors
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash |= 0; // Convert to 32bit integer
        }
        return hash;
    }
}

// Initialize chat when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    new ChatSystem();
});
