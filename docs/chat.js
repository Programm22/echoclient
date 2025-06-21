class ChatSystem {
    constructor() {
        this.chatWindow = null;
        this.chatInput = null;
        this.chatMessages = null;
        this.username = "";
        this.isMinimized = false;
        this.unreadCount = 0;
        this.messageColors = {};
        this.isConnected = false;
        this.onlineUsers = [];
        this.isVisible = true;
        this.isChangingUsername = false;
        this.db = null;
        this.usersRef = null;
        this.messagesRef = null;
        this.userListeners = [];
        this.connectedRef = null;        this.myUserKey = null;
        
        this.init();
    }

    async init() {
        this.createChatUI();
        
        this.setupEventListeners();
        
        this.initFirebase();
    }
      initFirebase() {
        const firebaseConfig = {
            apiKey: "AIzaSyB98OVLKtgP2fAyO3xFm-vySo06RnrxcyE",
            authDomain: "territorial-chat.firebaseapp.com",
            databaseURL: "https://territorial-chat-default-rtdb.firebaseio.com",
            projectId: "territorial-chat",
            storageBucket: "territorial-chat.appspot.com",
            messagingSenderId: "1097798491605",
            appId: "1:1097798491605:web:b2d6db8bce49186c6e98e2"
        };
          firebase.initializeApp(firebaseConfig);
        
        this.db = firebase.database();
        this.usersRef = this.db.ref('users');
        this.messagesRef = this.db.ref('messages');
        
        this.connectedRef = firebase.database().ref('.info/connected');
        
        this.connectedRef.on('value', (snap) => {
            if (snap.val() === true) {
                this.isConnected = true;
                this.addSystemMessage("Connected to chat server. Enter a username to join the conversation.");
                this.chatWindow.classList.add('connected');
            } else {
                this.isConnected = false;
                this.chatWindow.classList.remove('connected');
                this.addSystemMessage("Disconnected from chat server. Attempting to reconnect...");
            }
        });
          this.usersRef.on('value', (snapshot) => {
            const users = [];
            snapshot.forEach((userSnapshot) => {
                const userData = userSnapshot.val();
                if (userData.username) {
                    users.push(userData.username);
                }
            });
            
            this.onlineUsers = users;
            this.updateUserList(users);
            this.updateUserCount(users.length);
        });
          this.messagesRef.limitToLast(50).on('child_added', (snapshot) => {
            const messageData = snapshot.val();
            if (messageData.type === 'chat') {
                this.addChatMessage(messageData.username, messageData.message, messageData.timestamp);
            } else if (messageData.type === 'system') {
                this.addSystemMessage(messageData.message);
            }
        });
    }    createChatUI() {
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
        
        this.chatWindow = chatContainer;
        this.chatInput = chatContainer.querySelector('.chat-input');
        this.chatMessages = chatContainer.querySelector('.chat-messages');
        this.sendButton = chatContainer.querySelector('.chat-send-btn');
        this.userList = chatContainer.querySelector('.user-list');
        this.usernameDisplay = chatContainer.querySelector('.username-display');
        this.currentUsernameSpan = chatContainer.querySelector('.current-username');
        this.changeUsernameBtn = chatContainer.querySelector('.change-username-btn');
        
        window.chatSystem = this;
    }
      setupEventListeners() {
        this.sendButton.addEventListener('click', () => {
            if (this.isChangingUsername) {
                return;
            }
            
            if (!this.username) {
                this.joinChat();
            } else {
                this.sendMessage();
            }
        });
        
        this.chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                if (this.isChangingUsername) {
                    return;
                }
                
                if (!this.username) {
                    this.joinChat();
                } else {
                    this.sendMessage();
                }
            }
        });
          this.changeUsernameBtn.addEventListener('click', () => {
            this.startUsernameChange();
        });
        
        const minimizeBtn = this.chatWindow.querySelector('.minimize-btn');
        minimizeBtn.addEventListener('click', () => this.toggleMinimize());
        
        const closeBtn = this.chatWindow.querySelector('.close-btn');
        closeBtn.addEventListener('click', () => this.closeChat());
    }

    joinChat() {
        const username = this.chatInput.value.trim();
        
        if (username.length < 2 || username.length > 20) {
            this.addErrorMessage("Username must be between 2 and 20 characters.");
            return;
        }
        
        // Check if username is already taken
        this.usersRef.once('value', (snapshot) => {
            let usernameTaken = false;
            snapshot.forEach((userSnapshot) => {
                const userData = userSnapshot.val();
                if (userData.username === username) {
                    usernameTaken = true;
                }
            });
                  if (usernameTaken) {
            this.addErrorMessage(`Username '${username}' is already taken. Please choose another.`);
            return;
        }
        
        const newUserRef = this.usersRef.push();
        this.myUserKey = newUserRef.key;
        
        newUserRef.set({
            username: username,
            joinedAt: firebase.database.ServerValue.TIMESTAMP,
            lastActive: firebase.database.ServerValue.TIMESTAMP
        });
        
        newUserRef.onDisconnect().remove();
                  this.messagesRef.push({
            type: 'system',
            message: `${username} has joined the chat`,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });
        
        this.username = username;
        
        this.updateUIAfterJoin(username);
        
        this.addSystemMessage(`You are now chatting as ${username}`);
    });
    }
      updateUIAfterJoin(username) {
        this.currentUsernameSpan.textContent = username;
        this.usernameDisplay.style.display = 'flex';
        
        this.chatInput.value = "";
        this.chatInput.placeholder = "Type your message...";
        this.sendButton.textContent = "Send";
    }
      startUsernameChange() {
        this.chatInput.value = this.username;
        this.chatInput.placeholder = "Enter new username...";
        this.sendButton.textContent = "Update";
        this.chatInput.focus();
        this.chatInput.select();
        
        this.isChangingUsername = true;
        
        const handleUsernameChange = () => {
            const newUsername = this.chatInput.value.trim();
            
            if (newUsername.length < 2 || newUsername.length > 20) {
                this.addErrorMessage("Username must be between 2 and 20 characters.");
                return;
            }
            
            // Check if username is already taken
            this.usersRef.once('value', (snapshot) => {
                let usernameTaken = false;
                snapshot.forEach((userSnapshot) => {
                    if (userSnapshot.key !== this.myUserKey) {
                        const userData = userSnapshot.val();
                        if (userData.username === newUsername) {
                            usernameTaken = true;
                        }
                    }
                });
                  if (usernameTaken) {
                    this.addErrorMessage(`Username '${newUsername}' is already taken. Please choose another.`);
                    return;
                }
                
                const oldUsername = this.username;
                this.username = newUsername;
                
                if (this.myUserKey) {
                    this.usersRef.child(this.myUserKey).update({
                        username: newUsername,
                        lastActive: firebase.database.ServerValue.TIMESTAMP
                    });
                    
                    this.messagesRef.push({
                        type: 'system',
                        message: `${oldUsername} is now known as ${newUsername}`,
                        timestamp: firebase.database.ServerValue.TIMESTAMP
                    });
                }
                  this.updateUIAfterJoin(newUsername);
                
                this.isChangingUsername = false;
                
                this.sendButton.removeEventListener('click', handleUsernameChangeClick);
                this.chatInput.removeEventListener('keypress', handleUsernameChangeKeypress);
            });
        };
          const handleUsernameChangeClick = () => {
            handleUsernameChange();
        };
        
        const handleUsernameChangeKeypress = (e) => {
            if (e.key === 'Enter') {
                handleUsernameChange();
            }
        };
        
        this.sendButton.addEventListener('click', handleUsernameChangeClick, { once: true });
        this.chatInput.addEventListener('keypress', handleUsernameChangeKeypress, { once: true });
    }    sendMessage() {
        if (this.isChangingUsername) {
            return;
        }
        
        if (!this.username) {
            this.joinChat();
            return;
        }
        
        const message = this.chatInput.value.trim();
        
        if (!message) {
            return;
        }
        
        this.messagesRef.push({
            type: 'chat',
            username: this.username,
            message: message,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });
        
        if (this.myUserKey) {
            this.usersRef.child(this.myUserKey).update({
                lastActive: firebase.database.ServerValue.TIMESTAMP
            });
        }
        
        this.chatInput.value = "";
    }    addChatMessage(username, message, timestamp) {
        const messageElement = document.createElement('div');
        messageElement.className = 'chat-message';
        
        if (!this.messageColors[username]) {
            const colors = [
                '#4cc9f0', '#4361ee', '#7209b7', '#f72585', '#4ade80', 
                '#fb8500', '#ffbe0b', '#8338ec', '#3a86ff', '#ff006e'
            ];
            this.messageColors[username] = colors[Object.keys(this.messageColors).length % colors.length];
        }
        
        const date = new Date(timestamp);
        const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        messageElement.innerHTML = `
            <span class="chat-username" style="color: ${this.messageColors[username]}">${username}</span>
            <span class="chat-time">${timeString}</span>
            <div class="chat-text">${this.formatMessage(message)}</div>
        `;
        
        this.chatMessages.appendChild(messageElement);
        this.scrollToBottom();
        
        // Increment unread count if chat is minimized or not visible
        if (this.isMinimized || !this.isVisible) {
            this.unreadCount++;
            this.updateUnreadBadge();
        }
    }    addSystemMessage(message) {
        const messageElement = document.createElement('div');
        messageElement.className = 'chat-message system-message';
        
        const date = new Date();
        const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        messageElement.innerHTML = `
            <span class="chat-time">${timeString}</span>
            <div class="chat-text">${message}</div>
        `;
        
        this.chatMessages.appendChild(messageElement);
        this.scrollToBottom();
    }    addErrorMessage(message) {
        const messageElement = document.createElement('div');
        messageElement.className = 'chat-message error-message';
        
        const date = new Date();
        const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        messageElement.innerHTML = `
            <span class="chat-time">${timeString}</span>
            <div class="chat-text">${message}</div>
        `;
        
        this.chatMessages.appendChild(messageElement);
        this.scrollToBottom();
    }

    formatMessage(message) {
        // Replace URLs with clickable links
        return message.replace(
            /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g,
            '<a href="$&" target="_blank" rel="noopener noreferrer">$&</a>'
        );
    }

    updateUserCount(count) {
        const countElement = this.chatWindow.querySelector('.chat-online-count');
        if (countElement) {
            countElement.textContent = `${count} online`;
        }
    }

    updateUserList(users) {
        this.onlineUsers = users;
        this.userList.innerHTML = '';
        
        users.forEach(user => {
            const userElement = document.createElement('li');
            userElement.className = 'user-item';
            userElement.innerHTML = `
                <div class="user-status online"></div>
                <div class="user-name">${user}</div>
            `;
            this.userList.appendChild(userElement);
        });
    }

    scrollToBottom() {
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }    toggleMinimize() {
        this.isMinimized = !this.isMinimized;
        
        if (this.isMinimized) {
            this.chatWindow.classList.add('minimized');
        } else {
            this.chatWindow.classList.remove('minimized');
            this.unreadCount = 0;
            this.updateUnreadBadge();
        }
    }

    closeChat() {
        this.chatWindow.style.display = 'none';
        this.isVisible = false;
    }

    toggleVisibility() {
        if (this.isVisible) {
            this.chatWindow.style.display = 'none';
            this.isVisible = false;
        } else {
            this.chatWindow.style.display = 'flex';
            this.isVisible = true;
            // Reset unread count
            this.unreadCount = 0;
            this.updateUnreadBadge();
        }
    }
      updateUnreadBadge() {
        const existingBadge = this.chatWindow.querySelector('.notification-badge');
        if (existingBadge) {
            existingBadge.remove();
        }
        
        if (this.unreadCount > 0 && (!this.isVisible || this.isMinimized)) {
            const badge = document.createElement('div');
            badge.className = 'notification-badge';
            badge.textContent = this.unreadCount > 9 ? '9+' : this.unreadCount;
            this.chatWindow.querySelector('.chat-header').appendChild(badge);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new ChatSystem();
});
