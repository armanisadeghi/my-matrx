# 🚀 Main App Integration Instructions for AI Agent

## Overview
Your main app (aimatrx.com) needs to create HTML pages and display them in iframes. Here are the EXACT instructions for your AI agent.

---

## 📋 STEP 1: Add Environment Variables

Add these to your main app's `.env.local` file:

```bash
# Supabase credentials for the HTML pages project
SUPABASE_HTML_URL=https://viyklljfdhtidwecakwx.supabase.co
SUPABASE_HTML_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpeWtsbGpmZGh0aWR3ZWNha3d4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkwNzg4MDAsImV4cCI6MjA3NDY1NDgwMH0.ft4lQevyknckVrvM5LbhZ0KKSw7N1dlMUh8X37JuWhs

# Static site URLs
NEXT_PUBLIC_HTML_SITE_URL=https://mymatrx.com
```

---

## 📋 STEP 2: Install Supabase Client

Run this command in your main app:

```bash
npm install @supabase/supabase-js
```

---

## 📋 STEP 3: Create Supabase Client for HTML Pages

Create `lib/supabase-html.js`:

```javascript
import { createClient } from '@supabase/supabase-js'

const supabaseHtml = createClient(
  process.env.SUPABASE_HTML_URL,
  process.env.SUPABASE_HTML_ANON_KEY
)

export default supabaseHtml
```

---

## 📋 STEP 4: Create HTML Page Service

Create `lib/htmlPageService.js`:

```javascript
import supabaseHtml from './supabase-html'

export class HTMLPageService {
  /**
   * Create a new HTML page
   * @param {string} htmlContent - Complete HTML content
   * @param {string} title - Page title
   * @param {string} description - Optional description
   * @param {string} userId - User ID from your main app
   * @returns {Promise<{success: boolean, pageId: string, url: string}>}
   */
  static async createPage(htmlContent, title, description = '', userId) {
    try {
      console.log('Creating HTML page:', { title, userId })

      const { data, error } = await supabaseHtml
        .from('html_pages')
        .insert({
          html_content: htmlContent,
          title: title,
          description: description,
          user_id: userId
        })
        .select()
        .single()

      if (error) {
        console.error('Failed to create HTML page:', error)
        throw new Error(`Database error: ${error.message}`)
      }

      const pageUrl = `${process.env.NEXT_PUBLIC_HTML_SITE_URL}/p/${data.id}`

      console.log('HTML page created successfully:', data.id)

      return {
        success: true,
        pageId: data.id,
        url: pageUrl,
        title: data.title,
        createdAt: data.created_at
      }

    } catch (error) {
      console.error('HTMLPageService.createPage error:', error)
      throw error
    }
  }

  /**
   * Get user's HTML pages
   * @param {string} userId - User ID
   * @returns {Promise<Array>}
   */
  static async getUserPages(userId) {
    try {
      const { data, error } = await supabaseHtml
        .from('html_pages')
        .select('id, title, description, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) {
        throw new Error(`Database error: ${error.message}`)
      }

      return data.map(page => ({
        ...page,
        url: `${process.env.NEXT_PUBLIC_HTML_SITE_URL}/p/${page.id}`
      }))

    } catch (error) {
      console.error('HTMLPageService.getUserPages error:', error)
      throw error
    }
  }

  /**
   * Delete a HTML page
   * @param {string} pageId - Page ID
   * @param {string} userId - User ID (for security)
   * @returns {Promise<boolean>}
   */
  static async deletePage(pageId, userId) {
    try {
      const { error } = await supabaseHtml
        .from('html_pages')
        .delete()
        .eq('id', pageId)
        .eq('user_id', userId)

      if (error) {
        throw new Error(`Database error: ${error.message}`)
      }

      return true

    } catch (error) {
      console.error('HTMLPageService.deletePage error:', error)
      throw error
    }
  }
}
```

---

## 📋 STEP 5: Create React Hook for HTML Pages

Create `hooks/useHTMLPages.js`:

```javascript
import { useState } from 'react'
import { HTMLPageService } from '../lib/htmlPageService'

export function useHTMLPages(userId) {
  const [isCreating, setIsCreating] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  const createHTMLPage = async (htmlContent, title, description = '') => {
    setIsCreating(true)
    setError(null)

    try {
      const result = await HTMLPageService.createPage(
        htmlContent, 
        title, 
        description, 
        userId
      )
      
      return result
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setIsCreating(false)
    }
  }

  const getUserPages = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const pages = await HTMLPageService.getUserPages(userId)
      return pages
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  const deletePage = async (pageId) => {
    setError(null)

    try {
      await HTMLPageService.deletePage(pageId, userId)
      return true
    } catch (err) {
      setError(err.message)
      throw err
    }
  }

  return {
    createHTMLPage,
    getUserPages,
    deletePage,
    isCreating,
    isLoading,
    error,
    clearError: () => setError(null)
  }
}
```

---

## 📋 STEP 6: Example Component Usage

Create `components/HTMLPageGenerator.jsx`:

```javascript
'use client'

import { useState } from 'react'
import { useHTMLPages } from '../hooks/useHTMLPages'
import { useUser } from '../hooks/useUser' // Your existing user hook

export function HTMLPageGenerator() {
  const { user } = useUser()
  const { createHTMLPage, isCreating, error } = useHTMLPages(user?.id)
  
  const [title, setTitle] = useState('')
  const [htmlContent, setHtmlContent] = useState('')
  const [description, setDescription] = useState('')
  const [createdPage, setCreatedPage] = useState(null)

  const handleCreatePage = async (e) => {
    e.preventDefault()

    if (!htmlContent || !title) {
      alert('Please provide both title and HTML content')
      return
    }

    try {
      const result = await createHTMLPage(htmlContent, title, description)
      setCreatedPage(result)
      
      // Clear form
      setTitle('')
      setHtmlContent('')
      setDescription('')
      
      console.log('Page created:', result)
    } catch (error) {
      console.error('Failed to create page:', error)
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6">Generate HTML Page</h2>
      
      <form onSubmit={handleCreatePage} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Page Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full p-3 border rounded-lg"
            placeholder="Enter page title"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Description (optional)</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full p-3 border rounded-lg"
            placeholder="Brief description"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">HTML Content</label>
          <textarea
            value={htmlContent}
            onChange={(e) => setHtmlContent(e.target.value)}
            className="w-full p-3 border rounded-lg h-64 font-mono text-sm"
            placeholder="Paste your complete HTML content here..."
            required
          />
        </div>

        <button
          type="submit"
          disabled={isCreating}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {isCreating ? 'Creating Page...' : 'Create HTML Page'}
        </button>
      </form>

      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800">Error: {error}</p>
        </div>
      )}

      {createdPage && (
        <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <h3 className="text-lg font-semibold text-green-800 mb-2">
            ✅ Page Created Successfully!
          </h3>
          <p className="text-green-700 mb-3">
            <strong>Page ID:</strong> {createdPage.pageId}
          </p>
          <p className="text-green-700 mb-4">
            <strong>URL:</strong> {createdPage.url}
          </p>
          
          {/* Preview in iframe */}
          <div className="mt-4">
            <h4 className="font-medium text-green-800 mb-2">Preview:</h4>
            <iframe
              src={createdPage.url}
              className="w-full h-96 border rounded-lg"
              title={createdPage.title}
            />
          </div>
        </div>
      )}
    </div>
  )
}
```

---

## 📋 STEP 7: AI Integration Example

Here's how to integrate with your AI system:

```javascript
// In your AI generation component
import { HTMLPageService } from '../lib/htmlPageService'

export async function generateAndCreateHTMLPage(userPrompt, userId) {
  try {
    // 1. Generate HTML with AI
    const htmlContent = await generateHTMLWithAI(userPrompt)
    
    // 2. Extract title from HTML or generate one
    const title = extractTitleFromHTML(htmlContent) || `Generated Page - ${new Date().toLocaleDateString()}`
    
    // 3. Create page in database
    const result = await HTMLPageService.createPage(
      htmlContent,
      title,
      `Generated from: ${userPrompt}`,
      userId
    )
    
    // 4. Return result for immediate display
    return result
    
  } catch (error) {
    console.error('AI generation and page creation failed:', error)
    throw error
  }
}

function extractTitleFromHTML(html) {
  const titleMatch = html.match(/<title>(.*?)<\/title>/i)
  return titleMatch ? titleMatch[1] : null
}
```

---

## 📋 STEP 8: Iframe Display Component

Create `components/HTMLPageViewer.jsx`:

```javascript
'use client'

import { useState } from 'react'

export function HTMLPageViewer({ pageUrl, title }) {
  const [isLoading, setIsLoading] = useState(true)

  return (
    <div className="w-full">
      {isLoading && (
        <div className="flex items-center justify-center h-96 bg-gray-50 rounded-lg">
          <div className="text-gray-600">Loading page...</div>
        </div>
      )}
      
      <iframe
        src={pageUrl}
        title={title}
        className="w-full h-screen border rounded-lg"
        onLoad={() => setIsLoading(false)}
        style={{ minHeight: '600px' }}
      />
    </div>
  )
}
```

---

## 📋 STEP 9: Complete Workflow Example

```javascript
// Complete workflow in your main component
export function AIHTMLGenerator() {
  const { user } = useUser()
  const { createHTMLPage } = useHTMLPages(user?.id)
  const [currentPage, setCurrentPage] = useState(null)

  const handleAIGeneration = async (prompt) => {
    try {
      // 1. Generate HTML with your AI
      const generatedHTML = await yourAIService.generateHTML(prompt)
      
      // 2. Create page in database
      const result = await createHTMLPage(
        generatedHTML,
        `AI Generated: ${prompt.substring(0, 50)}...`,
        `Generated from prompt: ${prompt}`
      )
      
      // 3. Set for immediate display
      setCurrentPage(result)
      
    } catch (error) {
      console.error('AI generation failed:', error)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* AI Generation Panel */}
      <div>
        <AIPromptInput onGenerate={handleAIGeneration} />
      </div>
      
      {/* Live Preview Panel */}
      <div>
        {currentPage && (
          <HTMLPageViewer 
            pageUrl={currentPage.url} 
            title={currentPage.title} 
          />
        )}
      </div>
    </div>
  )
}
```

---

## ✅ SUMMARY FOR AI AGENT

**Tell your AI agent to:**

1. **Add environment variables** to `.env.local`
2. **Install** `@supabase/supabase-js`
3. **Create** the service files above
4. **Use HTMLPageService.createPage()** to save generated HTML
5. **Display pages** in iframes using the returned URL
6. **URLs format**: `https://mymatrx.com/p/[uuid]`

**Key Points:**
- ✅ **Instant availability** - Pages appear immediately after creation
- ✅ **No caching** - Updates reflect instantly  
- ✅ **Perfect for iframes** - Server-side rendered
- ✅ **Scalable** - Database handles millions of pages
- ✅ **Simple integration** - Just create and display

The HTML pages will be served at `https://mymatrx.com/p/[uuid]` and can be embedded in iframes immediately after creation.
