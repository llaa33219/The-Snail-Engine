/**
 * The Snail Engine
 * A custom Wiki Engine that renders a specific markup syntax into HTML.
 */

class TheSnail {
    constructor() {
        this.baseLevel = null;
        this.counters = {}; // Key: level, Value: count
        this.toc = [];
        this.tocInserted = false;
        this.injectStyles();
    }

    injectStyles() {
        if (typeof document === 'undefined') return;
        if (document.getElementById('snail-engine-styles')) return;

        const styles = `
            .snail-header { margin-top: 1em; margin-bottom: 0.5em; font-weight: bold; cursor: pointer; user-select: none; }
            .snail-header::before { content: '▼'; display: inline-block; margin-right: 8px; font-size: 0.8em; transition: transform 0.2s; color: #007BFF; }
            .snail-number { color: #005BDD; margin-right: 5px; }
            .snail-collapsed > .snail-header::before { transform: rotate(-90deg); }
            .snail-collapsed > .snail-content { display: none; }
            .snail-level-1 > .snail-header { font-size: 2em; border-bottom: 2px solid #005BDD; }
            .snail-level-2 > .snail-header { font-size: 1.75em; border-bottom: 1px solid #005BDD; }
            .snail-level-3 > .snail-header { font-size: 1.5em; border-bottom: 1px solid #005BDD; }
            .snail-level-4 > .snail-header { font-size: 1.25em; border-bottom: 1px solid #005BDD; }
            .snail-level-5 > .snail-header { font-size: 1.1em; border-bottom: 1px solid #005BDD; }
            .snail-level-6 > .snail-header { font-size: 1em; border-bottom: 1px solid #005BDD; }
            .snail-section { margin-left: 20px; border-left: 1px solid #eee; padding-left: 10px; }
            .snail-level-1 { margin-left: 0; border-left: none; padding-left: 0; }
            .snail-box { background: #f9f9f9; }
            .snail-hidden { opacity: 0; transition: opacity 0.2s; cursor: help; }
            .snail-hidden:hover { opacity: 1; }
            .snail-table { border-collapse: collapse; margin: 10px 0; }
            .snail-table-wrapper { display: table; margin: 10px 0; }
            .snail-table-wrapper .snail-table { display: table; width: 100%; margin: 0; }
            .snail-table-wrapper .snail-table + .snail-table { margin-top: -1px; }
            .snail-table td { border: 1px solid #ccc; padding: 5px; vertical-align: top; }
            .snail-split-cell { display: flex; flex-direction: row; margin: -5px; }
            .snail-split-cell > div { flex: 1; padding: 5px; border-right: 1px solid #ccc; }
            .snail-split-cell > div:last-child { border-right: none; }
            .snail-table.nested { margin: 0; }
            .snail-doc-title { text-align: center; font-size: 3em; margin-bottom: 10px; color: #005BDD; }
            .snail-category { text-align: center; color: #666; margin-bottom: 20px; font-style: italic; }
            .snail-big-box { border: 2px solid #333; padding: 20px; font-size: 2em; text-align: center; background: #eee; margin: 20px 0; font-weight: bold; }
            blockquote { border-left: 4px solid #005BDD; margin: 10px 0; padding-left: 10px; color: #555; }
            kbd { border: 1px solid #ccc; padding: 2px 4px; border-radius: 3px; background: #f5f5f5; font-family: monospace; }
            code { background: #f5f5f5; padding: 2px 4px; border-radius: 3px; font-family: monospace; }
            .snail-toc { background: #f9f9f9; border: 1px solid #ddd; padding: 15px; margin-bottom: 20px; display: inline-block; min-width: 200px; }
            .snail-toc h3 { margin-top: 0; font-size: 1.2em; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
            .snail-toc ul { padding-left: 20px; margin: 0; }
            .snail-toc li { list-style-type: none; margin: 5px 0; }
            .snail-toc a { text-decoration: none; color: #333; }
            .snail-toc a:hover { text-decoration: underline; color: #000; }
            .snail-tooltip { position: relative; display: inline-block; }
            .snail-tooltip-trigger { cursor: help; color: #555; font-size: 0.8em; vertical-align: super; }
            .snail-tooltip-content { visibility: hidden; width: 200px; background-color: #f5f5f5; border: 1px solid #005BDD; color: #000; text-align: center; padding: 5px; position: absolute; z-index: 1; bottom: 125%; left: 50%; margin-left: -100px; opacity: 0; transition: opacity 0.3s; font-size: 0.9rem; font-weight: normal; }
            .snail-tooltip:hover .snail-tooltip-content { visibility: visible; opacity: 1; }
            p { margin: 0.3em 0; }
            br { display: block; content: ""; margin: 0.2em 0; }
        `;

        const styleEl = document.createElement('style');
        styleEl.id = 'snail-engine-styles';
        styleEl.textContent = styles;
        document.head.appendChild(styleEl);
    }

    /**
     * Main render function
     * @param {string} text 
     * @returns {string} HTML string
     */
    render(text) {
        this.baseLevel = null;
        this.counters = {};
        this.toc = [];
        this.tocInserted = false;
        // Normalize line endings
        const lines = text.replace(/\r\n/g, '\n').split('\n');
        let html = this.parseBlockContent(lines, true);

        // Generate TOC
        const tocHtml = this.generateTOC();

        // Insert TOC
        if (html.includes('<!--TOC-->')) {
            html = html.replace('<!--TOC-->', tocHtml);
        } else {
            // If no placeholder (e.g. no content triggered it, or only metadata), append or prepend?
            // If only metadata, maybe no TOC needed? 
            // Or if content exists but logic missed it (unlikely with default case).
            // If there are headers, we should show TOC.
            if (this.toc.length > 0) {
                // Prepend if not found (fallback)
                html = tocHtml + html;
            }
        }

        return html.trim();
    }

    generateTOC() {
        if (this.toc.length === 0) return '';

        let html = '<div class="snail-toc"><h3>Table of Contents</h3><ul>';
        let currentLevel = this.baseLevel || 1;
        let stack = [currentLevel]; // Track open levels

        this.toc.forEach(item => {
            const level = item.level;

            if (level > currentLevel) {
                // Open nested lists
                for (let i = 0; i < level - currentLevel; i++) {
                    html += '<ul>';
                    stack.push(level); // Simplified tracking
                }
            } else if (level < currentLevel) {
                // Close nested lists
                // We need to close until we match the level or just close difference?
                // The stack logic in parseList was better.
                // Let's just close (current - level) times.
                for (let i = 0; i < currentLevel - level; i++) {
                    html += '</ul>';
                    stack.pop();
                }
            }

            html += `<li><a href="#${item.id}"><span class="snail-number">${item.number}</span> ${item.title}</a></li>`;
            currentLevel = level;
        });

        // Close remaining
        while (stack.length > 1) { // Keep root? No, close all uls opened inside the root ul
            // Wait, I started with <ul>.
            // If I pushed to stack, I opened another <ul>.
            // So I need to close stack.length - 1 uls?
            // Actually, the first <ul> is outside the loop.
            // If stack has 1 item (root), I don't close it in loop.
            html += '</ul>';
            stack.pop();
        }

        html += '</ul></div>';
        return html;
    }

    /**
     * Parses a block of lines and returns HTML
     * @param {string[]} lines 
     * @param {boolean} isRoot
     * @returns {string}
     */
    parseBlockContent(lines, isRoot = false) {
        let html = '';
        let i = 0;

        while (i < lines.length) {
            const line = lines[i];
            const trimmed = line.trim();

            // Check for TOC insertion point (if Root and not Metadata)
            if (isRoot && !this.tocInserted) {
                const isMetadata = trimmed.startsWith('*|*') || trimmed.startsWith('?!|') || trimmed.startsWith('*!!|') || trimmed === '';
                if (!isMetadata) {
                    html += '<!--TOC-->';
                    this.tocInserted = true;
                }
            }

            // 1. HTML Block
            if (trimmed === '<<html>>') {
                let j = i + 1;
                let htmlContent = '';
                while (j < lines.length && lines[j].trim() !== '>>END<<') {
                    htmlContent += lines[j] + '\n';
                    j++;
                }
                html += htmlContent;
                i = j + 1;
                continue;
            }

            // 2. Box Block
            // %%[width, height]{position}%% or %%[width, height]%%
            // width and height can be numbers or 'auto'
            // Can be multi-line or single-line: %%[w,h]{pos}%%content%%END%%
            const boxMatch = trimmed.match(/^%%\[(\d+|auto),\s*(\d+|auto)\](?:\{(\w+)\})?%%(.*)$/);
            if (boxMatch) {
                const widthVal = boxMatch[1];
                const heightVal = boxMatch[2];
                const position = boxMatch[3] || 'left'; // Default to left
                const restOfLine = boxMatch[4] || '';

                let boxContent = '';
                let j = i + 1;

                // Check if this is a single-line box (content and %%END%% on same line)
                if (restOfLine.includes('%%END%%')) {
                    // Single line box: extract content between %% and %%END%%
                    const endIndex = restOfLine.indexOf('%%END%%');
                    boxContent = restOfLine.substring(0, endIndex);
                    // j stays at i + 1, but we don't need to scan more lines
                } else {
                    // Multi-line box
                    // If there's content after the opening tag on the same line, include it
                    if (restOfLine.trim()) {
                        boxContent = restOfLine + '\n';
                    }

                    let nesting = 1;

                    // Collect all content until %%END%%, handling nesting
                    while (j < lines.length) {
                        const currentLine = lines[j];
                        const currentTrimmed = currentLine.trim();
                        
                        // Check for nested box start
                        if (currentTrimmed.match(/^%%\[(\d+|auto),\s*(\d+|auto)\](?:\{\w+\})?%%/)) {
                            nesting++;
                        }
                        
                        // Check for %%END%% (could be at start, middle, or end of line)
                        if (currentTrimmed === '%%END%%') {
                            nesting--;
                            if (nesting === 0) break;
                        } else if (currentTrimmed.includes('%%END%%')) {
                            // %%END%% is part of the line (possibly single-line nested box ending)
                            // Count how many %%END%% are in this line
                            const endMatches = currentTrimmed.match(/%%END%%/g);
                            if (endMatches) {
                                for (const _ of endMatches) {
                                    nesting--;
                                    if (nesting === 0) break;
                                }
                            }
                            if (nesting === 0) {
                                // Extract content before %%END%%
                                const endIdx = currentLine.indexOf('%%END%%');
                                if (endIdx > 0) {
                                    boxContent += currentLine.substring(0, endIdx) + '\n';
                                }
                                j++;
                                break;
                            }
                        }
                        
                        boxContent += currentLine + '\n';
                        j++;
                    }
                }

                // Parse width and height
                const width = widthVal === 'auto' ? 'auto' : `${widthVal}px`;
                const height = heightVal === 'auto' ? 'auto' : `${heightVal}px`;

                let style = `width: ${width}; height: ${height}; overflow: auto; border: 1px solid #ccc; padding: 10px;`;
                if (position === 'center') style += ` margin: 0 auto;`;
                else if (position === 'right') style += ` float: right; margin-left: 10px;`;
                else if (position === 'left') style += ` float: left; margin-right: 10px;`;

                // Parse the box content
                const boxLines = boxContent.split('\n');
                // Remove last empty line if present
                if (boxLines.length > 0 && boxLines[boxLines.length - 1] === '') {
                    boxLines.pop();
                }

                // Clear floats if necessary or just use flow-root
                html += `<div style="${style}" class="snail-box">`;
                html += this.parseBlockContent(boxLines);
                html += `</div>`;

                // If float, we might need a clearer, but the prompt says "text below is blocked until box ends" 
                // which implies standard flow, but "blocked in the space" implies wrapping. 
                // Standard float behavior does wrapping.

                i = j + 1;
                continue;
            }

            // 3. Header/Section Block
            // Starts with [ ... ] (1 to 12 brackets)
            // Regex to match start: ^(\[{1,12})(.*?)(\]{0,12})$
            // The prompt says "Start with [Paragraph Title]". It doesn't strictly say it must end with brackets on the same line, 
            // but the examples show [[Title]].
            // "All paragraphs start with [Paragraph Title] ... and end with ]END["

            const headerStartMatch = trimmed.match(/^(\[{1,12})(.*)/);
            // We need to be careful not to match table starts [{ or inline links.
            // Tables start with [{ so if the second char is {, it's a table (probably).
            // But a header could be `[{Title}]`? Unlikely given table syntax.
            // Let's assume headers don't start with [{

            if (headerStartMatch && !trimmed.startsWith('[{')) {
                const brackets = headerStartMatch[1];
                const level = brackets.length;

                // Check if it's actually a header block start.
                // It must eventually end with ]END[.
                // Also, we need to distinguish from inline text that just starts with [. 
                // But the prompt implies a block structure.

                // Extract title. The title might be wrapped in matching brackets or just raw.
                // Example: [[Title]] -> Title. [Title -> Title.
                let title = headerStartMatch[2];
                // Remove trailing brackets if they match the level
                // const trailingRegex = new RegExp(`\\]{${level}}$`);
                // if (trailingRegex.test(title)) {
                //     title = title.replace(trailingRegex, '');
                // }
                // Actually, the prompt says: "Start is [[Paragraph]]". 
                // Let's assume the title line is just the title content.
                // We need to handle the "numbering" logic.

                if (this.baseLevel === null) this.baseLevel = level;

                // Calculate section number
                // Reset counters for deeper levels
                for (let k = level + 1; k <= 12; k++) this.counters[k] = 0;
                if (!this.counters[level]) this.counters[level] = 0;
                this.counters[level]++;

                let sectionNum = '';
                if (level >= this.baseLevel) {
                    let nums = [];
                    for (let k = this.baseLevel; k <= level; k++) {
                        nums.push(this.counters[k] || 0); // Should be at least 0, but logic says 1 if visited.
                    }
                    sectionNum = nums.join('.') + '.';
                }

                // Clean title
                // If title ends with matching brackets, remove them
                let cleanTitle = title;
                if (cleanTitle.endsWith(']'.repeat(level))) {
                    cleanTitle = cleanTitle.substring(0, cleanTitle.length - level);
                }
                cleanTitle = cleanTitle.trim();

                // TOC Collection
                const sectionId = `snail-section-${this.toc.length + 1}`;
                this.toc.push({
                    level: level,
                    title: cleanTitle,
                    number: sectionNum,
                    id: sectionId
                });

                // Find the content until ]END[
                let j = i + 1;
                let contentLines = [];
                let blockNesting = 1;
                let inRawBlock = false;

                // We need to handle nested blocks of the SAME type (if allowed) or just find the matching ]END[
                // The prompt says: "Smaller paragraph belongs to the larger one above it".
                // And "Ends with ]END[".
                // This implies a strict block structure.

                while (j < lines.length) {
                    const lineTrim = lines[j].trim();

                    // Check for Raw Block start/end
                    if (lineTrim.startsWith('{|')) {
                        // If it's a single line raw block `{| ... |}`, we don't enter raw mode.
                        if (!lineTrim.endsWith('|}') || lineTrim.length <= 4) {
                            inRawBlock = true;
                        }
                    } else if (inRawBlock && lineTrim.endsWith('|}')) {
                        inRawBlock = false;
                    }

                    if (!inRawBlock) {
                        // Check for invalid nesting (Header of same or higher level)
                        // Regex to find start of a header: [Title] or [[Title]]
                        // But NOT [{ (table) or other bracket uses if any.
                        // Header syntax: ^\[{1,12}[^\[]
                        const headerMatch = lineTrim.match(/^(\[{1,12})[^\[]/);
                        if (headerMatch && !lineTrim.startsWith('[{')) {
                            const foundLevel = headerMatch[1].length;
                            if (foundLevel <= level) {
                                // Found a header that is equal or larger (smaller number) than current.
                                // This implicitly closes the current block.
                                // We do NOT consume this line, so the parent can handle it.
                                break;
                            }
                        }

                        if (lineTrim.match(/^\[{1,12}[^\[]/) && !lineTrim.startsWith('[{')) {
                            // Potential start of new block.
                            // We don't necessarily need to track nesting count if we just recurse.
                            // But to find the *matching* END, we need to count.
                            blockNesting++;
                        } else if (lineTrim.endsWith(']END[')) {
                            // Check if there is content before ]END[
                            const contentBefore = lineTrim.substring(0, lineTrim.length - 5);
                            if (contentBefore.trim() !== '') {
                                contentLines.push(contentBefore);
                            }

                            blockNesting--;
                            if (blockNesting === 0) {
                                // Consumed the closing tag
                                j++;
                                break;
                            }
                        }
                    }

                    contentLines.push(lines[j]);
                    j++;
                }

                // Render the header
                // Size: 1 is biggest, 12 is smallest.
                // HTML h1-h6. We can map 1->h1, 2->h2... 6->h6, 7+->div with class.
                const hTag = level <= 6 ? `h${level}` : 'div';
                const hClass = level > 6 ? `snail-h${level}` : '';
                const combinedClass = `snail-header${hClass ? ' ' + hClass : ''}`;

                html += `<div class="snail-section snail-level-${level}">`;
                html += `<${hTag} class="${combinedClass}" id="${sectionId}" onclick="this.parentElement.classList.toggle('snail-collapsed')"><span class="snail-number">${sectionNum}</span> ${this.parseInline(cleanTitle)}</${hTag}>`;
                html += `<div class="snail-content">`;
                html += this.parseBlockContent(contentLines);
                html += `</div>`;
                html += `</div>`;

                i = j;
                continue;
            }

            // 4. Metadata (Title, Category, BigText)
            if (trimmed.startsWith('*|*') && trimmed.endsWith('*|*')) {
                const title = trimmed.substring(3, trimmed.length - 3);
                html += `<h1 class="snail-doc-title">${this.parseInline(title)}</h1>`;
                i++; continue;
            }
            if (trimmed.startsWith('?!|') && trimmed.endsWith('|!?')) {
                const cat = trimmed.substring(3, trimmed.length - 3);
                html += `<div class="snail-category">${this.parseInline(cat)}</div>`;
                i++; continue;
            }
            if (trimmed.startsWith('*!!|') && trimmed.endsWith('|!!*')) {
                const text = trimmed.substring(4, trimmed.length - 4);
                html += `<div class="snail-big-box">${this.parseInline(text)}</div>`;
                i++; continue;
            }

            // 5. Lists
            // -, --, ---
            // +. ++.
            if (trimmed.match(/^[-]+ /) || trimmed.match(/^\++\. /)) {
                // Collect all list items
                let listLines = [];
                let j = i;
                while (j < lines.length) {
                    const l = lines[j].trim();
                    if (l.match(/^[-]+ /) || l.match(/^\++\. /)) {
                        listLines.push(lines[j]);
                        j++;
                    } else {
                        break;
                    }
                }
                html += this.parseList(listLines);
                i = j;
                continue;
            }

            // 6. Tables
            // Starts with [{
            if (trimmed.startsWith('[{')) {
                let tableLines = [];
                let j = i;
                while (j < lines.length && lines[j].trim().startsWith('[{')) {
                    tableLines.push(lines[j].trim());
                    j++;
                }

                html += '<div class="snail-table-wrapper">';

                let currentGroup = [];
                let currentCols = -1;

                const processGroup = () => {
                    if (currentGroup.length === 0) return;
                    html += '<table class="snail-table">';
                    currentGroup.forEach(line => {
                        // Use colspan 1 since we are grouping by cell count, so implies a perfect grid for this segment.
                        // If standard behavior is desired (full even split), colspan 1 is fine.
                        html += this.parseTableLine(line, 1);
                    });
                    html += '</table>';
                };

                for (const line of tableLines) {
                    const count = this.countTableCells(line);
                    if (count !== currentCols) {
                        processGroup();
                        currentGroup = [];
                        currentCols = count;
                    }
                    currentGroup.push(line);
                }
                processGroup();

                html += '</div>';

                i = j;
                continue;
            }

            // 7. Horizontal Rules and Blockquotes
            if (trimmed === '----') {
                html += '<hr>';
                i++; continue;
            }
            if (trimmed.match(/^--\[(.*?)\]--$/)) {
                const color = trimmed.match(/^--\[(.*?)\]--$/)[1];
                html += `<hr style="border-color: ${color};">`;
                i++; continue;
            }
            if (trimmed === '""') {
                // Blockquote start
                // Find next ""
                let j = i + 1;
                let quoteLines = [];
                while (j < lines.length && lines[j].trim() !== '""') {
                    quoteLines.push(lines[j]);
                    j++;
                }
                html += `<blockquote>${this.parseBlockContent(quoteLines)}</blockquote>`;
                i = j + 1;
                continue;
            }

            // 8. Raw Text Block
            // Starts with {|
            if (trimmed.startsWith('{|')) {
                let rawContent = '';
                // Check if it ends on the same line: {| content |}
                if (trimmed.endsWith('|}') && trimmed.length > 4) {
                    rawContent = trimmed.substring(2, trimmed.length - 2);
                    // Escape HTML
                    rawContent = rawContent.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                    html += `<div>${rawContent}</div>`;
                    i++;
                    continue;
                }

                // Multi-line
                let j = i;
                // If the first line is just `{|`, start content from next line.
                // If `{| content`, include content.
                let contentStart = trimmed.substring(2);
                if (contentStart) rawContent += contentStart + '\n';

                j++;
                while (j < lines.length) {
                    const l = lines[j];
                    if (l.trim().endsWith('|}')) {
                        // End found
                        // Add content before |}
                        const endContent = l.trim().substring(0, l.trim().length - 2);
                        // If line was just `|}`, endContent is empty.
                        // But we need to be careful about preserving whitespace of the last line if it wasn't just `|}`.
                        // Actually, let's look at the line.
                        const idx = l.lastIndexOf('|}');
                        if (idx !== -1) {
                            rawContent += l.substring(0, idx);
                        }
                        j++;
                        break;
                    }
                    rawContent += l + '\n';
                    j++;
                }

                // Escape HTML
                rawContent = rawContent.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                // Replace newlines with <br>
                rawContent = rawContent.replace(/\n/g, '<br>');

                html += `<div>${rawContent}</div>`;
                i = j;
                continue;
            }

            // 9. Default: Paragraph
            // If empty line, skip or add break?
            if (trimmed === '') {
                html += '<br>';
                i++;
                continue;
            }

            html += `<p>${this.parseInline(line)}</p>`;
            i++;
        }
        return html;
    }

    parseList(lines) {
        // We need to handle nesting based on the prefix length.
        // - is ul, +. is ol
        // - level 1, -- level 2
        // +. level 1, ++. level 2

        let html = '';
        let stack = []; // { type: 'ul'|'ol', level: 1 }

        lines.forEach(line => {
            const trimmed = line.trim();
            let type, level, content;

            if (trimmed.startsWith('-')) {
                const match = trimmed.match(/^([-]+) (.*)/);
                type = 'ul';
                level = match[1].length;
                content = match[2];
            } else {
                const match = trimmed.match(/^(\++)(\. ) (.*)/); // +. or ++.
                // Wait, regex for +. is ^(\++)\. (.*)
                const m = trimmed.match(/^(\++)\. (.*)/);
                type = 'ol';
                level = m[1].length;
                content = m[2];
            }

            // Adjust stack
            while (stack.length > 0 && stack[stack.length - 1].level > level) {
                const last = stack.pop();
                html += `</${last.type}></li>`; // Close sublist
            }

            if (stack.length > 0 && stack[stack.length - 1].level === level) {
                // Same level, close previous item
                html += `</li>`;
            }

            while (stack.length === 0 || stack[stack.length - 1].level < level) {
                // Open new list
                const currentLevel = stack.length > 0 ? stack[stack.length - 1].level : 0;
                // If skipping levels (e.g. 1 to 3), we might need to open intermediates, 
                // but usually we just open one.
                html += `<${type}>`;
                stack.push({ type, level });
            }

            // If switching list type at same level? (Not common in this syntax but possible)
            if (stack[stack.length - 1].type !== type) {
                // Close and reopen?
                // For simplicity, assume consistent type for a level or handle it.
                // If type mismatch, close and reopen.
                html += `</${stack[stack.length - 1].type}><${type}>`;
                stack[stack.length - 1].type = type;
            }

            html += `<li>${this.parseInline(content)}`;
        });

        // Close all
        while (stack.length > 0) {
            const last = stack.pop();
            html += `</li></${last.type}>`;
        }

        return html;
    }

    countTableCells(line) {
        // Count the number of top-level cells in a table line
        let count = 0;
        let braceDepth = 0;
        let i = 0;

        while (i < line.length) {
            let openBracketCount = 0;
            let j = i;
            while (j < line.length && line[j] === '[') {
                openBracketCount++;
                j++;
            }

            if (openBracketCount > 0 && j < line.length && line[j] === '{') {
                if (openBracketCount === 1) {
                    braceDepth++;
                }
                i += openBracketCount + 1;
                continue;
            }

            if (line[i] === '}') {
                let closeBracketCount = 0;
                j = i + 1;
                while (j < line.length && line[j] === ']') {
                    closeBracketCount++;
                    j++;
                }

                if (closeBracketCount > 0) {
                    if (closeBracketCount === 1) {
                        braceDepth--;
                        if (braceDepth === 0) {
                            count++;
                        }
                    }
                    i += 1 + closeBracketCount;
                    continue;
                }
            }

            i++;
        }

        return count;
    }

    parseTableLine(line, lastCellColspan = 1) {
        // [{cell1}][{cell2}]
        // Nested: [{ [[{inner}]] }]
        // This is tricky. We need to parse the balanced [{ ... }]

        // Simple approach: Split by `][` ? No, nesting breaks that.
        // We need a parser that walks the string.

        const cells = [];
        let currentCell = '';
        let braceDepth = 0; // Count of [{ at level 1 only
        let inCell = false;

        // The line should start with [{ and end with }] (ignoring whitespace)
        // Actually the line is `[{c1}][{c2}]`

        let i = 0;
        while (i < line.length) {
            // Count consecutive [ brackets
            let openBracketCount = 0;
            let j = i;
            while (j < line.length && line[j] === '[') {
                openBracketCount++;
                j++;
            }

            // Check for [{, [[{, [[[{, etc.
            if (openBracketCount > 0 && j < line.length && line[j] === '{') {
                const token = '['.repeat(openBracketCount) + '{';
                if (openBracketCount === 1) {
                    // Level 1: outer cell delimiter
                    if (braceDepth === 0) {
                        inCell = true;
                        currentCell = '';
                    } else {
                        currentCell += token;
                    }
                    braceDepth++;
                } else {
                    // Level 2+: nested table, treat as content
                    if (inCell) currentCell += token;
                }
                i += openBracketCount + 1;
                continue;
            }

            // Count consecutive } followed by ]
            if (line[i] === '}') {
                let closeBracketCount = 0;
                j = i + 1;
                while (j < line.length && line[j] === ']') {
                    closeBracketCount++;
                    j++;
                }

                if (closeBracketCount > 0) {
                    const token = '}' + ']'.repeat(closeBracketCount);
                    if (closeBracketCount === 1) {
                        // Level 1: outer cell delimiter
                        braceDepth--;
                        if (braceDepth === 0) {
                            inCell = false;
                            cells.push(currentCell);
                            currentCell = '';
                        } else {
                            currentCell += token;
                        }
                    } else {
                        // Level 2+: nested table, treat as content
                        if (inCell) currentCell += token;
                    }
                    i += 1 + closeBracketCount;
                    continue;
                }
            }

            // Regular character
            if (inCell) currentCell += line[i];
            i++;
        }

        let html = '<tr>';
        cells.forEach((cell, idx) => {
            const isLastCell = idx === cells.length - 1;
            // Check for background color: [color]content
            // But NOT [[{ which is nested table syntax
            let content = cell;
            let style = '';
            // Only match color if it starts with [ but NOT [[
            if (content.startsWith('[') && !content.startsWith('[[')) {
                const colorMatch = content.match(/^\[([^\[\]]*?)\](.*)/s);
                if (colorMatch) {
                    style = `background-color: ${colorMatch[1]};`;
                    content = colorMatch[2];
                }
            }

            // Recursive table check
            // If content contains `[{`, it might be a nested table.
            // The prompt says: `[[{content}]]` for split?
            // "[[{content}]][[{content}]] inside [{...}]"
            // Wait, the syntax for nested table is `[[{` instead of `[{`.
            // I will implement a generic table parser that looks for `[+{` where + is one or more [.

            // For now, let's treat the content as inline + potential nested table.
            // If content has `[[{`, we replace it?

            // Apply colspan to the last cell if needed
            const colspanAttr = (isLastCell && lastCellColspan > 1) ? ` colspan="${lastCellColspan}"` : '';

            // Let's try to detect if the *entire* content is a set of nested cells.
            if (content.trim().startsWith('[[{')) {
                // It's a nested table.
                // We need to parse it with the delimiter `[[{` and `}]]`.
                // This requires a more flexible parser.
                html += `<td${colspanAttr} style="${style}">${this.parseNestedTable(content, 2)}</td>`;
            } else {
                // Check for split cell syntax ||
                html += `<td${colspanAttr} style="${style}">${this.parseCellContent(content)}</td>`;
            }
        });
        html += '</tr>';
        return html;
    }

    parseNestedTable(text, level) {
        // Delimiter is `[` * level + `{`
        const startDelim = '['.repeat(level) + '{';
        const endDelim = '}' + ']'.repeat(level);

        // Parse similarly to parseTableLine but with custom delims
        const cells = [];
        let currentCell = '';
        let depth = 0;
        let i = 0;

        while (i < text.length) {
            if (text.substring(i).startsWith(startDelim)) {
                if (depth === 0) {
                    currentCell = '';
                } else {
                    currentCell += startDelim;
                }
                depth++;
                i += startDelim.length;
            } else if (text.substring(i).startsWith(endDelim)) {
                depth--;
                if (depth === 0) {
                    cells.push(currentCell);
                    currentCell = '';
                } else {
                    currentCell += endDelim;
                }
                i += endDelim.length;
            } else {
                if (depth > 0) currentCell += text[i];
                i++;
            }
        }

        let html = '<table class="snail-table nested"><tr>';
        cells.forEach(cell => {
            let content = cell;
            let style = '';
            // Only match color if it starts with [ but NOT [[
            if (content.startsWith('[') && !content.startsWith('[[')) {
                const colorMatch = content.match(/^\[([^\[\]]*?)\](.*)/s);
                if (colorMatch) {
                    style = `background-color: ${colorMatch[1]};`;
                    content = colorMatch[2];
                }
            }

            // Check for deeper nesting
            const nextStart = '['.repeat(level + 1) + '{';
            if (content.trim().startsWith(nextStart)) {
                html += `<td style="${style}">${this.parseNestedTable(content, level + 1)}</td>`;
            } else {
                // Check for split cell syntax ||
                html += `<td style="${style}">${this.parseCellContent(content)}</td>`;
            }
        });
        html += '</tr></table>';
        return html;
    }

    parseCellContent(content) {
        // Check if content contains || for split cells
        // We need to handle nested structures, so we can't just split by ||
        const parts = this.splitBySeparator(content, '||');
        
        if (parts.length > 1) {
            // Multiple parts - create split cell
            let html = '<div class="snail-split-cell">';
            parts.forEach(part => {
                html += `<div>${this.parseInline(part.trim())}</div>`;
            });
            html += '</div>';
            return html;
        } else {
            // Single part - just parse inline
            return this.parseInline(content);
        }
    }

    splitBySeparator(text, separator) {
        // Split text by separator, but respect nested structures like [[{...}]]
        const parts = [];
        let currentPart = '';
        let depth = 0;
        let i = 0;

        while (i < text.length) {
            // Check for opening brackets [{ or [[{ etc.
            if (text[i] === '[') {
                let bracketCount = 0;
                let j = i;
                while (j < text.length && text[j] === '[') {
                    bracketCount++;
                    j++;
                }
                if (j < text.length && text[j] === '{') {
                    depth++;
                    currentPart += text.substring(i, j + 1);
                    i = j + 1;
                    continue;
                }
            }

            // Check for closing brackets }] or }]] etc.
            if (text[i] === '}') {
                let j = i + 1;
                while (j < text.length && text[j] === ']') {
                    j++;
                }
                if (j > i + 1) {
                    depth--;
                    currentPart += text.substring(i, j);
                    i = j;
                    continue;
                }
            }

            // Check for separator at depth 0
            if (depth === 0 && text.substring(i, i + separator.length) === separator) {
                parts.push(currentPart);
                currentPart = '';
                i += separator.length;
                continue;
            }

            currentPart += text[i];
            i++;
        }

        parts.push(currentPart);
        return parts;
    }

    parseInline(text) {
        if (!text) return '';
        let t = text;

        // Escape HTML? Maybe not, we want to allow some? No, we should escape to prevent XSS unless it's the HTML block.
        // But we are generating HTML, so we should probably escape special chars first, 
        // THEN apply formatting.
        t = t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

        // 1. Raw: {| ... |} - Restore content after escaping?
        // Actually, raw should preserve original text.
        // Let's handle raw first and placeholder it.
        const rawMap = [];
        t = t.replace(/\{\|(.*?)\|\}/g, (match, content) => {
            rawMap.push(content); // content is already escaped? No, match is on original string if we did it before escape.
            // Let's redo: Escape AFTER handling raw?
            // If we escape first, `{|<b>|}` becomes `{|&lt;b&gt;|}`.
            // If we want raw to show `<b>`, we should escape it.
            // If we want raw to be HTML, that's different.
            // "Value regardless of grammar, original as is".
            // So `{|**bold**|}` shows `**bold**`.
            return `###SNAIL_RAW_${rawMap.length - 1}###`;
        });

        // 2. Formatting

        // Sizes (Must be before Bold because of overlapping !)
        // !|...|! to !!!!!!!!!!!!|...|!!!!!!!!!!!! (1 to 12)
        // Formula: size = 2.0 - 0.5 * log2(n)
        // We iterate from 12 down to 1 to avoid partial matches (e.g. matching 4 inside 8)
        for (let i = 12; i >= 1; i--) {
            const bangs = '!'.repeat(i);
            // We need to escape the bangs for the regex? No, ! is not special in regex unless... no it's not.
            // But we construct the regex dynamically.
            const regex = new RegExp(`${bangs}\\|(.*?)\\|${bangs}`, 'g');

            // Calculate size
            let size = 2.0 - 0.5 * Math.log2(i);
            // Round to 2 decimals
            size = Math.round(size * 100) / 100;

            t = t.replace(regex, `<span style="font-size: ${size}em;">$1</span>`);
        }

        // Bold !!text!!
        t = t.replace(/!!(.*?)!!/g, '<b>$1</b>');
        // Italic //text//
        t = t.replace(/\/\/(.*?)\/\//g, '<i>$1</i>');
        // Strike --text--
        t = t.replace(/--(.*?)--/g, '<strike>$1</strike>');
        // Underline __text__
        t = t.replace(/__(.*?)__/g, '<u>$1</u>');
        // Overline _^text_^
        t = t.replace(/_\^(.*?)_\^/g, '<span style="text-decoration: overline;">$1</span>');
        // Superscript +^text^+
        t = t.replace(/\+\^(.*?)\^\+/g, '<sup>$1</sup>');
        // Subscript +_text_+
        t = t.replace(/\+_(.*?)_\+/g, '<sub>$1</sub>');
        // Wave ~~text~~
        t = t.replace(/~~(.*?)~~/g, '<span style="text-decoration: wavy underline;">$1</span>');
        // Flip @@text@@
        t = t.replace(/@@(.*?)@@/g, '<span style="display: inline-block; transform: scaleX(-1);">$1</span>');
        // Hidden ::text::
        t = t.replace(/::(.*?)::/g, '<span class="snail-hidden">$1</span>');

        // Color ??[color]text??
        t = t.replace(/\?\?\[(.*?)\](.*?)\?\?/g, '<span style="color: $1;">$2</span>');

        // Links &&[link]text&& (Handle escaped &amp;)
        t = t.replace(/&amp;&amp;\[(.*?)\](.*?)&amp;&amp;/g, '<a href="$1">$2</a>');

        // Code ``code``
        t = t.replace(/``(.*?)``/g, '<code>$1</code>');
        // Keyboard `[key]`
        t = t.replace(/`\[(.*?)\]`/g, '<kbd>$1</kbd>');

        // Images !&link&! or !&[w, h]link&! (Handle escaped &amp;)
        t = t.replace(/!&amp;\[(\d+),\s*(\d+)\](.*?)&amp;!/g, '<img src="$3" width="$1" height="$2">');
        t = t.replace(/!&amp;(.*?)&amp;!/g, '<img src="$1">');

        // Videos ?&link&? or ?&[w, h]link&? (Handle escaped &amp;)
        t = t.replace(/\?&amp;\[(\d+),\s*(\d+)\](.*?)&amp;\?/g, '<video src="$3" width="$1" height="$2" controls></video>');
        t = t.replace(/\?&amp;(.*?)&amp;\?/g, '<video src="$1" controls></video>');

        // Tooltips: |=[content]text=|
        t = t.replace(/\|\=\[(.*?)\](.*?)\=\|/g, '<span class="snail-tooltip"><sup class="snail-tooltip-trigger">[$2]</sup><span class="snail-tooltip-content">$1</span></span>');

        // Restore Raw
        t = t.replace(/###SNAIL_RAW_(\d+)###/g, (match, index) => {
            return rawMap[index];
        });

        return t;
    }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TheSnail;
} else {
    window.TheSnail = TheSnail;
}
