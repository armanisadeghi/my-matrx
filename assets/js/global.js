// Global JavaScript functionality

// Utility function for smooth scrolling
function smoothScroll(target) {
    document.querySelector(target).scrollIntoView({
        behavior: 'smooth'
    });
}

// Add smooth scrolling to all anchor links
document.addEventListener('DOMContentLoaded', function() {
    // Add active class to current page navigation
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const navLinks = document.querySelectorAll('nav a');
    
    navLinks.forEach(link => {
        if (link.getAttribute('href') === currentPage) {
            link.style.opacity = '1';
            link.style.textDecoration = 'underline';
        }
    });

    // Add fade-in animation to main content
    const main = document.querySelector('main');
    if (main) {
        main.style.opacity = '0';
        main.style.transform = 'translateY(20px)';
        main.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        
        setTimeout(() => {
            main.style.opacity = '1';
            main.style.transform = 'translateY(0)';
        }, 100);
    }

    // Add hover effects to cards
    const cards = document.querySelectorAll('.feature, .info-box');
    cards.forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-5px)';
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
        });
    });
});

// Console message for developers
console.log('%cWelcome to My Matrx!', 'color: #667eea; font-size: 18px; font-weight: bold;');
console.log('%cThis is a clean repository for HTML/CSS/JS pages.', 'color: #666; font-size: 12px;');