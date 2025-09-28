// Home page specific functionality

document.addEventListener('DOMContentLoaded', function() {
    // Demo button functionality
    const demoBtn = document.getElementById('demo-btn');
    
    if (demoBtn) {
        let clickCount = 0;
        const messages = [
            "Hello! 👋",
            "You clicked me! 🎉",
            "One more time? 🤔",
            "You seem to like clicking! 😄",
            "This is fun! ✨",
            "Alright, I think you get the idea! 🚀"
        ];

        demoBtn.addEventListener('click', function() {
            clickCount++;
            const messageIndex = Math.min(clickCount - 1, messages.length - 1);
            
            // Create a temporary message element
            const message = document.createElement('div');
            message.textContent = messages[messageIndex];
            message.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 1rem 2rem;
                border-radius: 8px;
                font-size: 1.2rem;
                font-weight: 600;
                z-index: 1000;
                box-shadow: 0 8px 30px rgba(102, 126, 234, 0.4);
                opacity: 0;
                transition: all 0.3s ease;
            `;
            
            document.body.appendChild(message);
            
            // Animate in
            setTimeout(() => {
                message.style.opacity = '1';
                message.style.transform = 'translate(-50%, -50%) scale(1.05)';
            }, 10);
            
            // Animate out and remove
            setTimeout(() => {
                message.style.opacity = '0';
                message.style.transform = 'translate(-50%, -50%) scale(0.95)';
                setTimeout(() => {
                    document.body.removeChild(message);
                }, 300);
            }, 1500);
            
            // Add button animation
            this.style.transform = 'scale(0.95)';
            setTimeout(() => {
                this.style.transform = 'scale(1)';
            }, 150);
        });
    }

    // Animate features on scroll
    const features = document.querySelectorAll('.feature');
    
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -100px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);

    features.forEach((feature, index) => {
        feature.style.opacity = '0';
        feature.style.transform = 'translateY(30px)';
        feature.style.transition = `opacity 0.6s ease ${index * 0.2}s, transform 0.6s ease ${index * 0.2}s`;
        observer.observe(feature);
    });
});

console.log('Home page script loaded! 🏠');