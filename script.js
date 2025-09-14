// DOM Elements
const menuToggle = document.getElementById('menuToggle');
const navMenu = document.getElementById('navMenu');
const navLinks = document.querySelectorAll('.nav-link');
const bookingForm = document.getElementById('bookingForm');

// Mobile Menu Toggle
function toggleMenu() {
    menuToggle.classList.toggle('active');
    navMenu.classList.toggle('active');
    
    // Prevent body scrolling when menu is open
    document.body.style.overflow = navMenu.classList.contains('active') ? 'hidden' : '';
}

// Smooth scrolling to sections
function scrollToSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
        const headerHeight = document.querySelector('.header').offsetHeight;
        const offsetTop = section.offsetTop - headerHeight;
        
        window.scrollTo({
            top: offsetTop,
            behavior: 'smooth'
        });
        
        // Close mobile menu if open
        if (navMenu.classList.contains('active')) {
            toggleMenu();
        }
    }
}

// Handle navigation clicks
function handleNavClick(e) {
    e.preventDefault();
    const href = e.target.getAttribute('href');
    if (href.startsWith('#')) {
        const sectionId = href.substring(1);
        scrollToSection(sectionId);
    }
}

// Form submission handler
function handleFormSubmission(e) {
    e.preventDefault();
    
    // Get form data
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);
    
    // Simple validation
    const requiredFields = ['name', 'email', 'phone', 'datetime', 'guests'];
    let isValid = true;
    
    requiredFields.forEach(field => {
        const input = e.target.querySelector(`[name="${field}"], input[type="text"], input[type="email"], input[type="tel"], input[type="datetime-local"], select`);
        if (input && !input.value.trim()) {
            isValid = false;
            input.style.borderColor = '#d32f2f';
            input.style.backgroundColor = '#fff5f5';
        } else if (input) {
            input.style.borderColor = '#ddd';
            input.style.backgroundColor = '#fff';
        }
    });
    
    if (isValid) {
        // Show success message
        showNotification('Prenotazione inviata con successo! Ti contatteremo presto.', 'success');
        e.target.reset();
    } else {
        showNotification('Compila tutti i campi obbligatori.', 'error');
    }
}

// Show notification
function showNotification(message, type = 'info') {
    // Remove existing notification
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    // Create notification
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span>${message}</span>
            <button class="notification-close">&times;</button>
        </div>
    `;
    
    // Add styles
    notification.style.cssText = `
        position: fixed;
        top: 100px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 10000;
        min-width: 300px;
        max-width: 90%;
        padding: 1rem 1.5rem;
        border-radius: 10px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        animation: slideInDown 0.3s ease;
        font-family: 'Poppins', sans-serif;
        font-weight: 500;
    `;
    
    if (type === 'success') {
        notification.style.background = '#4caf50';
        notification.style.color = 'white';
    } else if (type === 'error') {
        notification.style.background = '#f44336';
        notification.style.color = 'white';
    } else {
        notification.style.background = '#2196f3';
        notification.style.color = 'white';
    }
    
    document.body.appendChild(notification);
    
    // Close notification
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.style.cssText = `
        background: none;
        border: none;
        color: inherit;
        font-size: 1.5rem;
        cursor: pointer;
        margin-left: 1rem;
        padding: 0;
    `;
    
    const closeNotification = () => {
        notification.style.animation = 'slideOutUp 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    };
    
    closeBtn.addEventListener('click', closeNotification);
    
    // Auto remove after 5 seconds
    setTimeout(closeNotification, 5000);
}

// Add CSS animations for notifications
function addNotificationStyles() {
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideInDown {
            from {
                transform: translate(-50%, -100%);
                opacity: 0;
            }
            to {
                transform: translate(-50%, 0);
                opacity: 1;
            }
        }
        
        @keyframes slideOutUp {
            from {
                transform: translate(-50%, 0);
                opacity: 1;
            }
            to {
                transform: translate(-50%, -100%);
                opacity: 0;
            }
        }
        
        .notification-content {
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
    `;
    document.head.appendChild(style);
}

// Highlight active navigation item
function highlightActiveNav() {
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav-link');
    
    function updateActiveNav() {
        const scrollPos = window.scrollY + 100;
        
        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.offsetHeight;
            const sectionId = section.getAttribute('id');
            
            if (scrollPos >= sectionTop && scrollPos < sectionTop + sectionHeight) {
                navLinks.forEach(link => {
                    link.classList.remove('active');
                    if (link.getAttribute('href') === `#${sectionId}`) {
                        link.classList.add('active');
                    }
                });
            }
        });
    }
    
    window.addEventListener('scroll', updateActiveNav);
    updateActiveNav(); // Initial call
}

// Add active nav styles
function addActiveNavStyles() {
    const style = document.createElement('style');
    style.textContent = `
        .nav-link.active {
            background-color: rgba(255,255,255,0.2);
            border-radius: 5px;
        }
    `;
    document.head.appendChild(style);
}

// Lazy loading effect for menu items
function addMenuAnimation() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.animation = 'fadeInUp 0.6s ease forwards';
            }
        });
    }, { threshold: 0.2 });
    
    const menuItems = document.querySelectorAll('.menu-item');
    menuItems.forEach((item, index) => {
        item.style.opacity = '0';
        item.style.transform = 'translateY(20px)';
        item.style.animationDelay = `${index * 0.1}s`;
        observer.observe(item);
    });
}

// Add scroll to top functionality
function addScrollToTop() {
    const scrollBtn = document.createElement('button');
    scrollBtn.innerHTML = '↑';
    scrollBtn.className = 'scroll-to-top';
    scrollBtn.style.cssText = `
        position: fixed;
        bottom: 30px;
        right: 30px;
        width: 50px;
        height: 50px;
        border: none;
        border-radius: 50%;
        background: #d32f2f;
        color: white;
        font-size: 1.5rem;
        font-weight: bold;
        cursor: pointer;
        box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        opacity: 0;
        visibility: hidden;
        transition: all 0.3s ease;
        z-index: 1000;
    `;
    
    document.body.appendChild(scrollBtn);
    
    // Show/hide button based on scroll position
    function toggleScrollBtn() {
        if (window.scrollY > 300) {
            scrollBtn.style.opacity = '1';
            scrollBtn.style.visibility = 'visible';
        } else {
            scrollBtn.style.opacity = '0';
            scrollBtn.style.visibility = 'hidden';
        }
    }
    
    // Scroll to top on click
    scrollBtn.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
    
    window.addEventListener('scroll', toggleScrollBtn);
}

// Add loading animation
function showLoadingAnimation() {
    const loader = document.createElement('div');
    loader.id = 'page-loader';
    loader.innerHTML = `
        <div class="loader-content">
            <img src="logo.png" alt="Romagna Mia Logo" class="loader-logo">
            <h3>Romagna Mia</h3>
            <p>Caricamento in corso...</p>
        </div>
    `;
    
    loader.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: #d32f2f;
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
        color: white;
        font-family: 'Poppins', sans-serif;
    `;
    
    const style = document.createElement('style');
    style.textContent = `
        .loader-content {
            text-align: center;
        }
        
        .loader-logo {
            width: 100px;
            height: 100px;
            margin-bottom: 1rem;
            animation: bounce 1s infinite;
            filter: drop-shadow(0 5px 15px rgba(0,0,0,0.3));
        }
        
        .loader-content h3 {
            font-size: 2rem;
            margin-bottom: 0.5rem;
            font-weight: 700;
        }
        
        .loader-content p {
            opacity: 0.8;
        }
    `;
    
    document.head.appendChild(style);
    document.body.appendChild(loader);
    
    // Remove loader after page load
    window.addEventListener('load', () => {
        setTimeout(() => {
            loader.style.opacity = '0';
            loader.style.transition = 'opacity 0.5s ease';
            setTimeout(() => loader.remove(), 500);
        }, 1000);
    });
}

// Initialize all functionality
function init() {
    // Show loading animation
    showLoadingAnimation();
    
    // Add event listeners
    if (menuToggle) {
        menuToggle.addEventListener('click', toggleMenu);
    }
    
    // Navigation links
    navLinks.forEach(link => {
        link.addEventListener('click', handleNavClick);
    });
    
    // Form submission
    if (bookingForm) {
        bookingForm.addEventListener('submit', handleFormSubmission);
    }
    
    // Add styles and animations
    addNotificationStyles();
    addActiveNavStyles();
    
    // Initialize features when page loads
    window.addEventListener('load', () => {
        highlightActiveNav();
        addMenuAnimation();
        addScrollToTop();
    });
    
    // Handle orientation change (mobile)
    window.addEventListener('orientationchange', () => {
        setTimeout(() => {
            // Recalculate positions after orientation change
            if (navMenu.classList.contains('active')) {
                toggleMenu();
            }
        }, 100);
    });
    
    // Close mobile menu when clicking outside
    document.addEventListener('click', (e) => {
        if (navMenu.classList.contains('active') && 
            !navMenu.contains(e.target) && 
            !menuToggle.contains(e.target)) {
            toggleMenu();
        }
    });
    
    // Prevent menu close when clicking inside menu
    navMenu.addEventListener('click', (e) => {
        e.stopPropagation();
    });
}

// Add PWA-like functionality
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // You can add service worker registration here for offline functionality
        console.log('PWA ready - Service Worker can be added for offline functionality');
    });
}

// Add install prompt for PWA
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    
    // Show install button (you can customize this)
    const installBtn = document.createElement('button');
    installBtn.textContent = 'Installa App';
    installBtn.style.cssText = `
        position: fixed;
        bottom: 90px;
        right: 30px;
        background: #4caf50;
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 25px;
        font-weight: 600;
        cursor: pointer;
        box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        z-index: 1000;
        font-size: 0.9rem;
    `;
    
    installBtn.addEventListener('click', async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                showNotification('App installata con successo!', 'success');
            }
            deferredPrompt = null;
            installBtn.remove();
        }
    });
    
    document.body.appendChild(installBtn);
    
    // Remove install button after 10 seconds if not used
    setTimeout(() => {
        if (installBtn.parentNode) {
            installBtn.remove();
        }
    }, 10000);
});

// Initialize the app
document.addEventListener('DOMContentLoaded', init);

// Global function for button onclick (for compatibility)
window.scrollToSection = scrollToSection;