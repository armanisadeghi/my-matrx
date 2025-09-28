// Template JavaScript for new pages
document.addEventListener('DOMContentLoaded', function() {
    console.log('New page loaded! 📄');
    
    // Add any page-specific functionality here
    
    // Example: Animate content blocks on scroll
    const contentBlocks = document.querySelectorAll('.content-block');
    
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);

    contentBlocks.forEach((block, index) => {
        block.style.opacity = '0';
        block.style.transform = 'translateY(20px)';
        block.style.transition = `opacity 0.5s ease ${index * 0.1}s, transform 0.5s ease ${index * 0.1}s`;
        observer.observe(block);
    });
});