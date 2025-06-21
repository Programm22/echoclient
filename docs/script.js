// script.js - Game client functionality

document.addEventListener('DOMContentLoaded', function() {
    // UI Elements
    const gameFrame = document.getElementById('gameFrame');
    const loadingScreen = document.getElementById('loadingScreen');
    const chatBtn = document.getElementById('chatBtn');
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    const gameNotification = document.getElementById('gameNotification');
    
    // Chat functionality reference (initialized in chat.js)
    let chatSystem = null;
    
    // Initialize game client
    initGameClient();
    
    function initGameClient() {
        // Hide loading screen when game is loaded
        gameFrame.addEventListener('load', function() {
            setTimeout(() => {
                loadingScreen.style.opacity = '0';
                setTimeout(() => {
                    loadingScreen.style.display = 'none';
                }, 500);
                
                // Show welcome notification
                showNotification('Welcome to Territorial.io with Chat');
            }, 1000);
        });
        
        // Initialize fullscreen button
        fullscreenBtn.addEventListener('click', function() {
            toggleFullscreen();
        });
        
        // Initialize chat button
        chatBtn.addEventListener('click', function() {
            if (window.chatSystem) {
                window.chatSystem.toggleVisibility();
                showNotification('Chat toggled');
            } else {
                showNotification('Chat system not available');
            }
        });
    }
    
    // Helper functions
    function showNotification(message) {
        gameNotification.textContent = message;
        gameNotification.classList.add('show');
        
        setTimeout(() => {
            gameNotification.classList.remove('show');
        }, 3000);
    }
    
    function toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                showNotification('Error entering fullscreen mode');
                console.error(`Error attempting to enable fullscreen mode: ${err.message}`);
            });
            showNotification('Fullscreen mode enabled');
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
                showNotification('Fullscreen mode disabled');
            }
        }
    }
});
