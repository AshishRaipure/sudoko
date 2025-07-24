// PWA (Progressive Web App) functionality
class PWA {
    constructor() {
        this.deferredPrompt = null;
        this.installPrompt = document.getElementById('installPrompt');
        this.installBtn = document.getElementById('installBtn');
        this.dismissInstallBtn = document.getElementById('dismissInstallBtn');
        
        this.init();
    }
    
    init() {
        // Register service worker
        this.registerServiceWorker();
        
        // Set up install prompt
        this.setupInstallPrompt();
        
        // Handle app shortcuts
        this.handleAppShortcuts();
    }
    
    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('/static/sw.js');
                console.log('Service Worker registered successfully:', registration);
                
                // Check for updates
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            this.showUpdateNotification();
                        }
                    });
                });
            } catch (error) {
                console.error('Service Worker registration failed:', error);
            }
        }
    }
    
    setupInstallPrompt() {
        // Listen for the beforeinstallprompt event
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
            
            // Show install prompt after a delay
            setTimeout(() => {
                this.showInstallPrompt();
            }, 3000);
        });
        
        // Handle install button click
        this.installBtn.addEventListener('click', () => {
            this.installApp();
        });
        
        // Handle dismiss button click
        this.dismissInstallBtn.addEventListener('click', () => {
            this.hideInstallPrompt();
        });
        
        // Handle app installed event
        window.addEventListener('appinstalled', () => {
            this.hideInstallPrompt();
            this.deferredPrompt = null;
            this.showInstallSuccess();
        });
    }
    
    showInstallPrompt() {
        if (this.deferredPrompt && !this.isAppInstalled()) {
            this.installPrompt.classList.add('show');
        }
    }
    
    hideInstallPrompt() {
        this.installPrompt.classList.remove('show');
    }
    
    async installApp() {
        if (this.deferredPrompt) {
            this.deferredPrompt.prompt();
            const { outcome } = await this.deferredPrompt.userChoice;
            
            if (outcome === 'accepted') {
                console.log('User accepted the install prompt');
            } else {
                console.log('User dismissed the install prompt');
            }
            
            this.deferredPrompt = null;
            this.hideInstallPrompt();
        }
    }
    
    isAppInstalled() {
        return window.matchMedia('(display-mode: standalone)').matches ||
               window.navigator.standalone === true;
    }
    
    showInstallSuccess() {
        // Show success message
        const successMessage = document.createElement('div');
        successMessage.className = 'install-success';
        successMessage.innerHTML = `
            <div class="success-content">
                <h3>🎉 App Installed Successfully!</h3>
                <p>You can now access Sudoku Game from your home screen.</p>
                <button onclick="this.parentElement.parentElement.remove()" class="btn btn-primary">OK</button>
            </div>
        `;
        document.body.appendChild(successMessage);
        
        // Remove after 5 seconds
        setTimeout(() => {
            if (successMessage.parentElement) {
                successMessage.remove();
            }
        }, 5000);
    }
    
    showUpdateNotification() {
        const updateMessage = document.createElement('div');
        updateMessage.className = 'update-notification';
        updateMessage.innerHTML = `
            <div class="update-content">
                <h3>🔄 Update Available</h3>
                <p>A new version of Sudoku Game is available.</p>
                <button onclick="location.reload()" class="btn btn-primary">Update Now</button>
                <button onclick="this.parentElement.parentElement.remove()" class="btn btn-secondary">Later</button>
            </div>
        `;
        document.body.appendChild(updateMessage);
    }
    
    handleAppShortcuts() {
        // Handle URL parameters for shortcuts
        const urlParams = new URLSearchParams(window.location.search);
        const difficulty = urlParams.get('difficulty');
        
        if (difficulty && ['easy', 'medium', 'hard', 'expert'].includes(difficulty)) {
            // Set difficulty and start game
            const difficultySelect = document.getElementById('difficulty');
            if (difficultySelect) {
                difficultySelect.value = difficulty;
                // Trigger new game after a short delay
                setTimeout(() => {
                    const newGameBtn = document.getElementById('newGameBtn');
                    if (newGameBtn) {
                        newGameBtn.click();
                    }
                }, 1000);
            }
        }
    }
}

// Initialize PWA when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new PWA();
});

// Handle offline/online events
window.addEventListener('online', () => {
    console.log('App is online');
    this.showOnlineStatus();
});

window.addEventListener('offline', () => {
    console.log('App is offline');
    this.showOfflineStatus();
});

// Show online/offline status
function showOnlineStatus() {
    const status = document.getElementById('status');
    if (status) {
        status.textContent = '🟢 Back online!';
        status.className = 'status success';
        setTimeout(() => {
            status.textContent = '';
            status.className = 'status';
        }, 3000);
    }
}

function showOfflineStatus() {
    const status = document.getElementById('status');
    if (status) {
        status.textContent = '🔴 You are offline. Some features may not work.';
        status.className = 'status error';
    }
} 