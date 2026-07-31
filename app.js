// Configuration
const CONFIG = {
    // Base folder for markdown files
    baseFolder: 'Chem/',
    speechEnabled: true,
    translateEnabled: false,
    translationCache: {},
    currentUtterance: null,
    // Scan mode: 'auto' (directory listing for local server) / 'json' (pre-generated files.json for GitHub Pages)
    scanMode: 'auto'
};

// Current file path (for resolving image paths relative to MD location)
let currentBasePath = 'Chem/';

// Chemistry vocabulary for translation - loaded from external file
let CHEM_DICT = {};

// Load vocabulary on init
function loadChemVocabulary() {
    fetch('chemword.txt')
    .then(response => response.text())
    .then(text => {
        // Parse each line: english_word=chinese_translation
        const lines = text.split('\n');
        lines.forEach(line => {
            line = line.trim();
            // Skip comments and empty lines
            if (line.startsWith('#') || line === '') return;
            const eq = line.indexOf('=');
            if (eq > 0) {
                const en = line.substring(0, eq).trim().toLowerCase();
                const zh = line.substring(eq + 1).trim();
                CHEM_DICT[en] = zh;
            }
        });
    })
    .catch(error => {
        console.error('Failed to load chemistry vocabulary:', error);
    });
}

// DOM Elements
const elements = {
    contentContainer: document.getElementById('content-container'),
    fileListContainer: document.getElementById('file-list-container'),
    fileList: document.getElementById('file-list'),
    backButton: document.getElementById('back-to-list'),
    tocContent: document.getElementById('toc-content'),
    speechToggle: document.getElementById('speech-toggle'),
    translateToggle: document.getElementById('translate-toggle'),
    themeToggle: document.getElementById('theme-toggle'),
    tocToggle: document.getElementById('toc-toggle'),
    tocClose: document.getElementById('toc-close'),
    sidebarToc: document.getElementById('sidebar-toc'),
    overlay: document.getElementById('overlay'),
    progressBar: document.getElementById('progress-bar')
};

// Auto-scan markdown files from directory listing (works with local HTTP server)
// Or from pre-generated files.json for GitHub Pages
let markdownFiles = [];

function autoScanMarkdownFiles() {
    if (CONFIG.scanMode === 'json') {
        // Load from pre-generated files.json (for GitHub Pages)
        fetch('files.json')
        .then(response => response.json())
        .then(data => {
            markdownFiles = data.files || [];
            renderFileList();
        })
        .catch(error => {
            console.error('Failed to load files.json:', error);
            alert('Error: Cannot load files.json for GitHub Pages. Check that files.json exists in the chem folder.');
        });
    } else {
        // Auto-scan from directory listing (local server)
        // Our structure is Chem/MC/ and Chem/Notes/
        const subfolders = ['MC/', 'Notes/'];
        let pending = subfolders.length;
        let allFiles = [];
        
        subfolders.forEach(folder => {
            fetch(CONFIG.baseFolder + folder)
            .then(response => response.text())
            .then(html => {
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                const links = Array.from(doc.querySelectorAll('a'));
                
                links.forEach(link => {
                    const href = link.getAttribute('href');
                    if (href.endsWith('.md')) {
                        // Skip parent link
                        if (href.includes('../')) return;
                        allFiles.push(folder + href);
                    }
                });
                
                pending--;
                if (pending === 0) {
                    // All subfolders scanned
                    markdownFiles = allFiles;
                    renderFileList();
                }
            })
            .catch(error => {
                console.error(`Failed to scan ${folder}:`, error);
                pending--;
                if (pending === 0) {
                    markdownFiles = allFiles;
                    renderFileList();
                }
            });
        });
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', init);

function init() {
    // Load chemistry vocabulary first
    loadChemVocabulary();
    
    // Load saved preferences
    loadPreferences();
    
    // Auto-scan for markdown files from server directory listing
    autoScanMarkdownFiles();
    
    // Bind events
    bindEvents();
    
    // Update UI based on current state
    updateToggleUI();
}

function renderFileList() {
    // Group files by folder
    const groups = {};
    markdownFiles.forEach(file => {
        const folder = file.split('/')[0];
        if (!groups[folder]) {
            groups[folder] = [];
        }
        groups[folder].push(file);
    });
    
    // Sort groups: Notes first, then MC
    const groupOrder = ['Notes', 'MC'];
    let html = '';
    
    groupOrder.forEach(groupName => {
        if (!groups[groupName]) return;
        
        // Sort files naturally by chapter/chapter number
        let files = groups[groupName];
        files.sort((a, b) => {
            // Extract chapter number from filename
            const getNum = (str) => {
                // Match both "Chapter X" and "Ch X"
                const matchChapter = str.match(/[Cc]h(?:apter)?[^\d]*(\d+)/);
                if (matchChapter) {
                    return parseInt(matchChapter[1], 10);
                }
                // No chapter number, fall back to 9999
                return 9999;
            };
            const numA = getNum(a);
            const numB = getNum(b);
            if (numA !== 9999 && numB !== 9999) {
                return numA - numB;
            }
            // Fallback to alphabetical sort
            return a.localeCompare(b);
        });
        
        html += `<div class="file-group">
            <h3 class="group-title">${groupName}</h3>
            <div class="file-list">`;
        
        files.forEach(file => {
           const fileName = file.split('/').pop();
           // Decode URL percent encoding (change %20 back to space)
           const displayName = fileName.replace(/\%20/g, ' ').replace(/\.md$/, '');
           html += `
               <div class="file-item" data-path="${CONFIG.baseFolder}${file}">
                   <div class="file-item-name">${displayName}</div>
               </div>
           `;
        });
        
        html += `</div></div>`;
    });
    
    // Any other folders (unexpected)
    for (const [groupName, files] of Object.entries(groups)) {
        if (groupName === 'Notes' || groupName === 'MC') continue;
        files.sort();
        html += `<div class="file-group">
            <h3 class="group-title">${groupName}</h3>
            <div class="file-list">`;
        files.forEach(file => {
           const fileName = file.split('/').pop();
           // Decode URL percent encoding (change %20 back to space)
           const displayName = fileName.replace(/\%20/g, ' ').replace(/\.md$/, '');
           html += `
               <div class="file-item" data-path="${CONFIG.baseFolder}${file}">
                   <div class="file-item-name">${displayName}</div>
               </div>
           `;
        });
        html += `</div></div>`;
    }
    
    elements.fileList.innerHTML = html;
    
    // Bind click events
    elements.fileList.querySelectorAll('.file-item').forEach(item => {
        item.addEventListener('click', () => {
            let path = item.getAttribute('data-path');
            // Set base path for image resolution (directory of the MD file)
            const lastSlash = path.lastIndexOf('/');
            currentBasePath = lastSlash >= 0 ? path.substring(0, lastSlash + 1) : '';
            // Encode spaces in URL
            path = path.replace(/ /g, '%20');
            loadMarkdown(path);
            showContent();
        });
    });
}

function showContent() {
    elements.fileListContainer.classList.add('hidden');
    elements.contentContainer.classList.remove('hidden');
    elements.backButton.classList.remove('hidden');
}

function showFileList() {
    elements.fileListContainer.classList.remove('hidden');
    elements.contentContainer.classList.add('hidden');
    elements.backButton.classList.add('hidden');
    window.scrollTo(0, 0);
}

function loadPreferences() {
    // Theme
    const darkMode = localStorage.getItem('chem-dark-mode') === 'true';
    if (darkMode) {
        document.body.classList.add('dark-mode');
        elements.themeToggle.checked = true;
    }
    
    // Speech / Translate
    const speechEnabled = localStorage.getItem('chem-speech-enabled');
    const translateEnabled = localStorage.getItem('chem-translate-enabled');
    
    if (speechEnabled !== null) {
        CONFIG.speechEnabled = speechEnabled === 'true';
        elements.speechToggle.checked = CONFIG.speechEnabled;
    }
    
    if (translateEnabled !== null) {
        CONFIG.translateEnabled = translateEnabled === 'true';
        elements.translateToggle.checked = CONFIG.translateEnabled;
    }
}

function savePreferences() {
    localStorage.setItem('chem-dark-mode', document.body.classList.contains('dark-mode'));
    localStorage.setItem('chem-speech-enabled', CONFIG.speechEnabled);
    localStorage.setItem('chem-translate-enabled', CONFIG.translateEnabled);
}

function bindEvents() {
    // Toggles
    elements.speechToggle.addEventListener('change', handleSpeechToggle);
    elements.translateToggle.addEventListener('change', handleTranslateToggle);
    elements.themeToggle.addEventListener('change', handleThemeToggle);
    
    // TOC
    elements.tocToggle.addEventListener('click', openTOC);
    elements.tocClose.addEventListener('click', closeTOC);
    elements.overlay.addEventListener('click', closeTOC);
    
    // Back to file list
    elements.backButton.addEventListener('click', showFileList);
    
    // Scroll for progress bar and active TOC
    window.addEventListener('scroll', handleScroll);
    
    // Image zoom
    document.addEventListener('click', handleImageClick);
}

function handleSpeechToggle() {
    // Speech and Translate are mutually exclusive
    CONFIG.speechEnabled = elements.speechToggle.checked;
    if (CONFIG.speechEnabled && CONFIG.translateEnabled) {
        CONFIG.translateEnabled = false;
        elements.translateToggle.checked = false;
    }
    updateToggleUI();
    savePreferences();
}

function handleTranslateToggle() {
    CONFIG.translateEnabled = elements.translateToggle.checked;
    if (CONFIG.translateEnabled && CONFIG.speechEnabled) {
        CONFIG.speechEnabled = false;
        elements.speechToggle.checked = false;
    }
    updateToggleUI();
    savePreferences();
}

function handleThemeToggle() {
    if (elements.themeToggle.checked) {
        document.body.classList.add('dark-mode');
    } else {
        document.body.classList.remove('dark-mode');
    }
    savePreferences();
}

function updateToggleUI() {
    // Remove existing event listeners and tooltip
    document.body.classList.toggle('translate-mode', CONFIG.translateEnabled);
    removeExistingTooltip();
}

function removeExistingTooltip() {
    const existing = document.querySelector('.translate-tooltip');
    if (existing) existing.remove();
}

function openTOC() {
    elements.sidebarToc.classList.add('open');
    elements.overlay.classList.add('open');
}

function closeTOC() {
    elements.sidebarToc.classList.remove('open');
    elements.overlay.classList.remove('open');
}

function handleScroll() {
    // Update progress bar
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = (scrollTop / docHeight) * 100;
    elements.progressBar.style.width = progress + '%';
    
    // Update active TOC
    updateActiveTOC();
}

function loadMarkdown(filename) {
    fetch(filename)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Cannot load ${filename}`);
            }
            return response.text();
        })
        .then(text => {
            renderMarkdown(text);
        })
        .catch(error => {
            elements.contentContainer.innerHTML = `
                <div class="error">
                    <h2>Error loading markdown file</h2>
                    <p>${error.message}</p>
                    <p>Make sure your markdown file is named <code>${filename}</code> and placed in the same folder as this HTML.</p>
                </div>
            `;
        });
}

function renderMarkdown(text) {
    // Extract all LaTeX formulas first, completely protect them
    const formulas = [];
    let formulaIndex = 0;
    
    // Replace non-breaking hyphen (U+2011) and other special hyphens with normal hyphen for KaTeX compatibility
    text = text.replace(/[\u2011\u2013]/g, '-');
    
    // Use very unique placeholder that won't conflict with anything
    function getPlaceholder(i) {
        return `⟦FORMULA-${i}⟧`;
    }
    
    // Step 1: Extract all block and inline formulas
    // First handle block $$
    text = text.replace(/(\$\$[\s\S]*?\$\$)/g, function(match) {
        formulas.push(match);
        return getPlaceholder(formulaIndex++);
    });
    
    // Then handle inline $
    text = text.replace(/(\$[^$\n]+\$)/g, function(match) {
        formulas.push(match);
        return getPlaceholder(formulaIndex++);
    });
    
    // Convert Obsidian highlight ==text== to <mark> tag
    // Support custom color: =={red}XXX== → highlight with red background
    // Allow nested markdown (e.g. =={red}**bold text**==)
    text = text.replace(/==\{([^}]+)\}([\s\S]*?)==/g, '<mark class="highlight-text" style="background-color: $1">$2</mark>');
    // Default: ==text== → yellow highlight, allow nested markdown
    text = text.replace(/==([\s\S]*?)==/g, '<mark class="highlight-text">$1</mark>');
    
    // Convert standalone --- to <hr> (horizontal rule)
    text = text.replace(/^---$/gm, '<hr>');
    
    // Convert Obsidian-style image links: ![[filename|size]] to <img> with full path
    text = text.replace(/!\[\[([^\]|]+)(?:\|(\d+))?\]\]/g, function(match, filename, width) {
        // Build path relative to HTML page, not MD file
        const imgPath = currentBasePath + filename;
        if (width) {
            return `<img src="${imgPath}" width="${width}" class="obsidian-image">`;
        }
        return `<img src="${imgPath}" class="obsidian-image">`;
    });
    
    // Configure marked - disable some problematic features
    marked.setOptions({
        highlight: (code, lang) => {
            if (lang && hljs.getLanguage(lang)) {
                return hljs.highlight(code, { language: lang }).value;
            }
            return hljs.highlightAuto(code).value;
        },
        breaks: true,
        gfm: true,
        smartypants: false
    });
    
    // Restore formulas - render them directly with KaTeX
    let html = marked.parse(text);
    
    for (let i = 0; i < formulas.length; i++) {
        let formula = formulas[i];
        const isBlock = formula.startsWith('$$');
        let mathContent = formula.replace(/^\$\$?/, '').replace(/\$\$?$/, '');
        
        // Remove unnecessary newlines inside formula (common when each character on separate line)
        mathContent = mathContent.replace(/\n/g, ' ').trim();
        
        let renderedHtml = '';
        try {
            if (isBlock) {
                renderedHtml = katex.renderToString(mathContent, {
                    displayMode: true,
                    throwOnError: false,
                    trust: true,
                    macros: {
                        "\\ce": "\\text{#1}"
                    }
                });
            } else {
                renderedHtml = katex.renderToString(mathContent, {
                    displayMode: false,
                    throwOnError: false,
                    trust: true,
                    macros: {
                        "\\ce": "\\text{#1}"
                    }
                });
            }
        } catch (e) {
            // If KaTeX fails, show the original formula text
            renderedHtml = `<code>${formula}</code>`;
        }
        
        html = html.replace(getPlaceholder(i), renderedHtml);
    }
    
    elements.contentContainer.innerHTML = html;
    
    // Make English words clickable
    wrapEnglishWords();
    
    // Generate TOC
    generateTOC();
    
    // Bind word click/hover events
    bindWordEvents();
    
    // No need for KaTeX auto-render - formulas are already rendered during markdown processing
}

function wrapEnglishWords() {
    const textNodes = [];
    const walker = document.createTreeWalker(
        elements.contentContainer,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: function(node) {
                // Skip code, pre, script, style
                const parent = node.parentElement;
                const tagName = parent.tagName.toLowerCase();
                if (['code', 'pre', 'script', 'style', 'kbd'].includes(tagName)) {
                    return NodeFilter.FILTER_REJECT;
                }
                if (node.textContent.trim().length === 0) {
                    return NodeFilter.FILTER_REJECT;
                }
                return NodeFilter.FILTER_ACCEPT;
            }
        }
    );
    
    let node;
    while (node = walker.nextNode()) {
        textNodes.push(node);
    }
    
    textNodes.forEach(textNode => {
        const text = textNode.textContent;
        // Match English words (letters only, at least 2 chars)
        const regex = /([A-Za-z]{2,})/g;
        const fragments = text.split(regex);
        
        if (fragments.length > 1) {
            const span = document.createElement('span');
            fragments.forEach(fragment => {
                if (regex.test(fragment)) {
                    const wordSpan = document.createElement('span');
                    wordSpan.className = 'english-word';
                    wordSpan.textContent = fragment;
                    span.appendChild(wordSpan);
                } else if (fragment.length > 0) {
                    span.appendChild(document.createTextNode(fragment));
                }
            });
            textNode.parentNode.replaceChild(span, textNode);
        }
    });
}

function bindWordEvents() {
    const words = document.querySelectorAll('.english-word');
    
    words.forEach(word => {
        word.addEventListener('click', handleWordClick);
        word.addEventListener('mouseenter', handleWordHover);
        word.addEventListener('mouseleave', handleWordLeave);
        word.addEventListener('mousemove', handleWordMove);
    });
}

function handleWordClick(e) {
    if (!CONFIG.speechEnabled) return;
    
    const word = e.currentTarget;
    const text = word.textContent;
    
    // Stop any current speech
    if (CONFIG.currentUtterance) {
        window.speechSynthesis.cancel();
        document.querySelector('.speaking')?.classList.remove('speaking');
    }
    
    // Add speaking highlight
    word.classList.add('speaking');
    
    // Speak the word
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    
    utterance.onend = () => {
        word.classList.remove('speaking');
        CONFIG.currentUtterance = null;
    };
    
    utterance.onerror = () => {
        word.classList.remove('speaking');
        CONFIG.currentUtterance = null;
    };
    
    CONFIG.currentUtterance = utterance;
    window.speechSynthesis.speak(utterance);
}

 function handleWordHover(e) {
    if (!CONFIG.translateEnabled) return;
    
    const word = e.currentTarget;
    let text = word.textContent.trim().toLowerCase();
    
    // Create tooltip
    removeExistingTooltip();
    
    const tooltip = document.createElement('div');
    tooltip.className = 'translate-tooltip';
    tooltip.textContent = 'Translating...';
    document.body.appendChild(tooltip);
    
    // Position tooltip
    positionTooltip(e, tooltip);
    
    // Check cache first
    if (CONFIG.translationCache[text]) {
        tooltip.textContent = CONFIG.translationCache[text];
        tooltip.classList.add('show');
        return;
    }
    
    // Check chemistry dictionary first for accurate translation
    if (CHEM_DICT[text]) {
        const translation = CHEM_DICT[text];
        CONFIG.translationCache[text] = translation;
        tooltip.textContent = translation;
        tooltip.classList.add('show');
        return;
    }
    
    // Use free MyMemory translation API for words not in dictionary
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|zh-CN`;
    
    fetch(url)
    .then(response => response.json())
    .then(data => {
        let translation = data.responseData.translatedText || text;
        // Clean up common translation artifacts
        translation = translation.replace(/\./g, '').trim();
        CONFIG.translationCache[text] = translation;
        tooltip.textContent = translation;
        tooltip.classList.add('show');
    })
    .catch(error => {
        console.error('Translation error:', error);
        tooltip.textContent = `${text} (翻譯失敗)`;
        tooltip.classList.add('show');
    });
}

function handleWordLeave() {
    removeExistingTooltip();
}

function handleWordMove(e) {
    if (!CONFIG.translateEnabled) return;
    
    const tooltip = document.querySelector('.translate-tooltip');
    if (tooltip) {
        positionTooltip(e, tooltip);
    }
}

function positionTooltip(e, tooltip) {
    const x = e.pageX + 10;
    const y = e.pageY + 15;
    
    tooltip.style.left = x + 'px';
    tooltip.style.top = y + 'px';
}

function generateTOC() {
    const headings = elements.contentContainer.querySelectorAll('h1, h2, h3');
    if (headings.length === 0) {
        elements.sidebarToc.classList.add('hidden');
        return;
    }
    
    elements.sidebarToc.classList.remove('hidden');
    
    let tocHtml = '<ul>';
    headings.forEach((heading, index) => {
        // Add id if not present
        if (!heading.id) {
            heading.id = `heading-${index}`;
        }
        
        const level = heading.tagName.toLowerCase();
        const text = heading.textContent;
        const classes = `toc-${level}`;
        
        tocHtml += `<li><a href="#${heading.id}" class="${classes}">${text}</a></li>`;
    });
    tocHtml += '</ul>';
    
    elements.tocContent.innerHTML = tocHtml;
    
    // Bind click events
    elements.tocContent.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('href').substring(1);
            const target = document.getElementById(targetId);
            if (target) {
                window.scrollTo({
                    top: target.offsetTop - 80,
                    behavior: 'smooth'
                });
                closeTOC();
            }
        });
    });
}

function updateActiveTOC() {
    const headings = elements.contentContainer.querySelectorAll('h1, h2, h3');
    const links = elements.tocContent.querySelectorAll('a');
    
    if (headings.length === 0) return;
    
    let activeIndex = 0;
    const scrollPosition = window.scrollY;
    
    for (let i = 0; i < headings.length; i++) {
        if (headings[i].offsetTop - 100 <= scrollPosition) {
            activeIndex = i;
        }
    }
    
    links.forEach((link, index) => {
        if (index === activeIndex) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
}

function handleImageClick(e) {
    if (e.target.tagName.toLowerCase() !== 'img') return;
    if (!e.target.closest('.content-container')) return;
    
    const imgSrc = e.target.src;
    
    // Create modal
    const modal = document.createElement('div');
    modal.className = 'image-modal';
    const modalImg = document.createElement('img');
    modalImg.src = imgSrc;
    modal.appendChild(modalImg);
    document.body.appendChild(modal);
    
    // Open modal
    setTimeout(() => modal.classList.add('open'), 10);
    
    // Close on click
    modal.addEventListener('click', () => {
        modal.classList.remove('open');
        setTimeout(() => modal.remove(), 300);
    });
}
