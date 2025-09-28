# My Matrx 🚀

A clean, organized repository for hosting individual HTML/CSS/JS pages on Vercel. Perfect for quick prototypes, landing pages, and simple web projects.

## 📁 Project Structure

```
/
├── pages/               # Individual HTML pages
│   ├── index.html      # Home page
│   └── about.html      # About page
├── assets/             # Shared assets
│   ├── css/           # Stylesheets
│   │   ├── global.css # Global styles
│   │   ├── home.css   # Home page styles
│   │   └── about.css  # About page styles
│   ├── js/            # JavaScript files
│   │   ├── global.js  # Global functionality
│   │   └── home.js    # Home page functionality
│   └── images/        # Shared images
├── templates/         # Page templates
│   ├── basic-page.html # Basic page template
│   ├── template.css   # Template styles
│   └── template.js    # Template JavaScript
├── vercel.json        # Vercel configuration
└── .gitignore        # Git ignore rules
```

## 🎯 Features

- **Zero Configuration**: Ready to deploy on Vercel instantly
- **Clean Structure**: Organized folders for easy project management
- **Responsive Design**: Mobile-first approach with modern CSS
- **Template System**: Quick page creation using templates
- **Modern JavaScript**: ES6+ with smooth animations and interactions
- **SEO Friendly**: Proper HTML structure and meta tags

## 🚀 Quick Start

### Creating a New Page

1. **Copy the template**:
   ```bash
   cp templates/basic-page.html pages/your-page.html
   ```

2. **Create page-specific styles** (optional):
   ```bash
   cp templates/template.css assets/css/your-page.css
   ```

3. **Create page-specific JavaScript** (optional):
   ```bash
   cp templates/template.js assets/js/your-page.js
   ```

4. **Edit your new page**:
   - Update the title and content in `pages/your-page.html`
   - Link your CSS and JS files if created
   - Add navigation links as needed

### Deployment on Vercel

1. **Connect your repository** to Vercel
2. **Deploy**: Vercel will automatically detect and deploy your static files
3. **Access**: Your pages will be available at `your-domain.vercel.app/your-page.html`

## 📝 Customization

### Global Styles
Edit `assets/css/global.css` to change:
- Color scheme
- Typography
- Layout structure
- Responsive breakpoints

### Navigation
Update the navigation in each HTML file or create a JavaScript function to generate it dynamically.

### Adding New Assets
- **Images**: Add to `assets/images/`
- **Fonts**: Link in HTML head or add to CSS
- **Icons**: Use CDN links or add SVG files

## 🛠 Development Tips

### Local Development
Use a simple HTTP server to test your pages locally:

```bash
# Using Python
python -m http.server 8000

# Using Node.js
npx serve .

# Using PHP
php -S localhost:8000
```

### File Organization
- Keep page-specific CSS and JS files named consistently
- Use the `templates/` folder for reusable components
- Store shared assets in the `assets/` folders

### Performance
- Optimize images before adding them
- Minimize CSS and JS for production
- Use external CDNs for common libraries

## 📖 Examples

### Simple Landing Page
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>My Landing Page</title>
    <link rel="stylesheet" href="../assets/css/global.css">
</head>
<body>
    <main>
        <section class="hero">
            <h1>Welcome to My Project</h1>
            <p>This is a simple landing page.</p>
        </section>
    </main>
    <script src="../assets/js/global.js"></script>
</body>
</html>
```

### Adding Custom Styles
```css
/* assets/css/landing.css */
.hero {
    text-align: center;
    padding: 4rem 2rem;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    justify-content: center;
}
```

## 🤝 Contributing

Feel free to fork this repository and customize it for your needs. If you create useful templates or improvements, consider sharing them!

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

---

Happy coding! 🎉