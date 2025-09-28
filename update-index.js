#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { parse } = require('node-html-parser');

/**
 * Automatically updates index.html with all HTML pages in the directory
 */
function updateIndex() {
    const currentDir = process.cwd();
    const pagesDir = path.join(currentDir, 'pages');
    
    // Check if pages directory exists
    if (!fs.existsSync(pagesDir)) {
        console.log('Pages directory does not exist. Creating it...');
        fs.mkdirSync(pagesDir, { recursive: true });
        console.log('✅ Created pages directory');
        return;
    }
    
    // Get all HTML files from pages directory
    const htmlFiles = fs.readdirSync(pagesDir)
        .filter(file => file.endsWith('.html'))
        .map(file => {
            const filePath = path.join(pagesDir, file);
            const content = fs.readFileSync(filePath, 'utf8');
            const root = parse(content);
            
            // Extract title from the HTML file
            const titleElement = root.querySelector('title');
            const title = titleElement ? titleElement.text : file.replace('.html', '');
            
            // Try to extract description from meta description or first paragraph
            let description = 'HTML page';
            const metaDesc = root.querySelector('meta[name="description"]');
            if (metaDesc) {
                description = metaDesc.getAttribute('content');
            } else {
                // Try to get description from first paragraph or h2
                const firstP = root.querySelector('p');
                const firstH2 = root.querySelector('h2');
                const subtitle = root.querySelector('.subtitle');
                
                if (subtitle) {
                    description = subtitle.text.trim();
                } else if (firstH2) {
                    description = firstH2.text.trim();
                } else if (firstP) {
                    description = firstP.text.trim().substring(0, 100) + '...';
                }
            }
            
            return {
                filename: file,
                uuid: file.replace('.html', ''),
                title: title,
                description: description.substring(0, 150) // Limit description length
            };
        })
        .sort((a, b) => a.title.localeCompare(b.title)); // Sort alphabetically by title
    
    // Read current index.html
    const indexPath = path.join(currentDir, 'index.html');
    let indexContent = fs.readFileSync(indexPath, 'utf8');
    
    // Generate new page cards HTML
    const pageCardsHTML = htmlFiles.map(page => `            <a href="pages/${page.filename}" class="page-card">
                <div class="page-title">${page.title}</div>
                <div class="page-description">
                    ${page.description}
                </div>
                <div class="page-id">ID: ${page.uuid}</div>
            </a>`).join('\n');
    
    // Replace the pages list section
    const startMarker = '<div class="pages-list">';
    const endMarker = '</div>';
    
    const startIndex = indexContent.indexOf(startMarker);
    const endIndex = indexContent.indexOf(endMarker, startIndex) + endMarker.length;
    
    if (startIndex !== -1 && endIndex !== -1) {
        const newPagesSection = `<div class="pages-list">
${pageCardsHTML}
        </div>`;
        
        indexContent = indexContent.substring(0, startIndex) + 
                      newPagesSection + 
                      indexContent.substring(endIndex);
        
        // Write updated index.html
        fs.writeFileSync(indexPath, indexContent, 'utf8');
        
        console.log(`✅ Updated index.html with ${htmlFiles.length} pages:`);
        htmlFiles.forEach(page => {
            console.log(`   - ${page.title} (${page.uuid})`);
        });
    } else {
        console.error('❌ Could not find pages-list section in index.html');
        process.exit(1);
    }
}

// Install required dependency if not present
function ensureDependencies() {
    try {
        require('node-html-parser');
    } catch (error) {
        console.log('📦 Installing required dependency: node-html-parser');
        const { execSync } = require('child_process');
        execSync('npm install node-html-parser --save-dev', { stdio: 'inherit' });
        console.log('✅ Dependency installed successfully');
    }
}

// Main execution
if (require.main === module) {
    try {
        ensureDependencies();
        updateIndex();
    } catch (error) {
        console.error('❌ Error updating index:', error.message);
        process.exit(1);
    }
}

module.exports = { updateIndex };
