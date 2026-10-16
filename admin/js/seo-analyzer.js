// ========================================================
// Blackwater Digital Blog CMS - On-page SEO analysis
// Scores an article against a focus keyword (0-100), in the
// spirit of Rank Math / Yoast: keyword placement, lengths,
// links, media and readability. Runs entirely in the browser.
// ========================================================

(function () {
    const SITE_HOST = 'bwdigitalmarketing.ie';
    // The public article page appends this to every SEO title
    const TITLE_SUFFIX = ' | Blackwater Digital';
    const WORDS_PER_MINUTE = 225;

    function normalise(text) {
        return (text || '')
            .toLowerCase()
            .replace(/[’‘]/g, "'")
            .replace(/[​ ]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function escapeRegExp(text) {
        return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    // Whole-phrase matches only ("ads" should not match "loads")
    function countPhrase(haystack, phrase) {
        if (!phrase) return 0;
        const re = new RegExp('(^|[^\\p{L}\\p{N}])' + escapeRegExp(phrase) + '(?=$|[^\\p{L}\\p{N}])', 'giu');
        return (normalise(haystack).match(re) || []).length;
    }

    function wordsOf(text) {
        return normalise(text).split(' ').filter(Boolean);
    }

    function slugify(text) {
        return normalise(text).replace(/'/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    }

    function readingTime(wordCount) {
        return Math.max(1, Math.round(wordCount / WORDS_PER_MINUTE));
    }

    function parse(html) {
        const doc = new DOMParser().parseFromString(`<div id="seo-root">${html || ''}</div>`, 'text/html');
        return doc.getElementById('seo-root');
    }

    /**
     * Count words in article HTML (used for the live word count and reading time too)
     */
    function countWords(html) {
        const root = parse(html);
        return wordsOf(root.textContent).length;
    }

    /**
     * @param {object} input
     *   keyword, seoTitle, metaDescription, slug, html, featuredImage, otherKeywords[]
     * @returns {{ score, checks, stats }}
     */
    function analyze(input) {
        const keyword = normalise(input.keyword);
        const hasKeyword = keyword.length > 0;
        const root = parse(input.html);
        const text = root.textContent || '';
        const words = wordsOf(text);
        const wordCount = words.length;
        const keywordWords = keyword ? keyword.split(' ').length : 1;
        const keywordCount = countPhrase(text, keyword);
        const density = wordCount ? (keywordCount * keywordWords / wordCount) * 100 : 0;

        const seoTitle = (input.seoTitle || '').trim();
        const fullTitle = seoTitle + TITLE_SUFFIX;
        const metaDescription = (input.metaDescription || '').trim();
        const slug = (input.slug || '').trim();

        // Opening of the article: first paragraph or first 10% of words, whichever is longer
        const firstBlock = root.querySelector('p, li, blockquote');
        const tenPercent = words.slice(0, Math.max(50, Math.ceil(wordCount * 0.1))).join(' ');
        const intro = [firstBlock ? firstBlock.textContent : '', tenPercent].join(' ');

        const headings = Array.from(root.querySelectorAll('h2, h3, h4'));
        const images = Array.from(root.querySelectorAll('img'));
        const links = Array.from(root.querySelectorAll('a[href]')).map(a => a.getAttribute('href').trim());
        const internalLinks = links.filter(h => h.startsWith('/') || h.includes(SITE_HOST));
        const externalLinks = links.filter(h => /^https?:\/\//i.test(h) && !h.includes(SITE_HOST));
        const paragraphs = Array.from(root.querySelectorAll('p')).map(p => wordsOf(p.textContent).length).filter(n => n > 0);

        // Longest run of words between subheadings
        let longestSection = 0;
        let run = 0;
        Array.from(root.children).forEach(el => {
            if (/^H[2-4]$/.test(el.tagName)) {
                longestSection = Math.max(longestSection, run);
                run = 0;
            } else {
                run += wordsOf(el.textContent).length;
            }
        });
        longestSection = Math.max(longestSection, run);

        const checks = [];
        const add = (group, id, weight, status, label, tip) => checks.push({ group, id, weight, status, label, tip });
        const needKeyword = 'Add a focus keyword to run this check.';

        // ---- Focus keyword ----
        const inTitle = hasKeyword && countPhrase(seoTitle, keyword) > 0;
        add('Focus keyword', 'kw-title', 10,
            !hasKeyword ? 'fail' : inTitle ? 'pass' : 'fail',
            'Focus keyword in the SEO title',
            hasKeyword ? 'Use the exact focus keyword in the SEO title.' : needKeyword);

        const titleIndex = normalise(seoTitle).indexOf(keyword);
        add('Focus keyword', 'kw-title-start', 4,
            !hasKeyword || !inTitle ? 'fail' : titleIndex <= normalise(seoTitle).length * 0.5 ? 'pass' : 'warn',
            'Focus keyword near the start of the title',
            hasKeyword ? 'Titles that open with the keyword tend to get more clicks.' : needKeyword);

        add('Focus keyword', 'kw-desc', 8,
            hasKeyword && countPhrase(metaDescription, keyword) > 0 ? 'pass' : 'fail',
            'Focus keyword in the meta description',
            hasKeyword ? 'Mention the focus keyword once in the meta description.' : needKeyword);

        const slugHasKeyword = hasKeyword && slugify(keyword).split('-').every(part => slug.split('-').includes(part));
        add('Focus keyword', 'kw-slug', 7,
            slugHasKeyword ? 'pass' : 'fail',
            'Focus keyword in the URL',
            hasKeyword ? `Include “${slugify(keyword)}” in the URL slug.` : needKeyword);

        add('Focus keyword', 'kw-intro', 8,
            hasKeyword && countPhrase(intro, keyword) > 0 ? 'pass' : 'fail',
            'Focus keyword in the introduction',
            hasKeyword ? 'Use the focus keyword in the first paragraph.' : needKeyword);

        let densityStatus = 'fail';
        if (hasKeyword && keywordCount > 0) {
            if (density >= 0.5 && density <= 2.5) densityStatus = 'pass';
            else if (density < 0.5 || density <= 3.5) densityStatus = 'warn';
        }
        add('Focus keyword', 'kw-density', 8, densityStatus,
            hasKeyword
                ? `Keyword density ${density.toFixed(1)}% (used ${keywordCount} time${keywordCount === 1 ? '' : 's'})`
                : 'Keyword density',
            !hasKeyword ? needKeyword
                : density > 2.5 ? 'Use the keyword less often; aim for 0.5-2.5%. Over-use reads as spam.'
                : 'Aim for 0.5-2.5%: use the keyword naturally a few more times.');

        add('Focus keyword', 'kw-heading', 6,
            hasKeyword && headings.some(h => countPhrase(h.textContent, keyword) > 0) ? 'pass' : 'fail',
            'Focus keyword in a subheading',
            hasKeyword ? 'Use the focus keyword in at least one H2 or H3.' : needKeyword);

        add('Focus keyword', 'kw-alt', 3,
            !images.length ? 'na'
                : hasKeyword && images.some(img => countPhrase(img.getAttribute('alt') || '', keyword) > 0) ? 'pass' : 'warn',
            'Focus keyword in an image alt text',
            'Describe one image with alt text that includes the keyword.');

        const used = hasKeyword && (input.otherKeywords || []).map(normalise).includes(keyword);
        add('Focus keyword', 'kw-unique', 3,
            !hasKeyword ? 'fail' : used ? 'fail' : 'pass',
            used ? 'Focus keyword already used in another article' : 'Focus keyword not used in another article',
            hasKeyword ? 'Two articles on one keyword compete with each other; pick a different angle.' : needKeyword);

        // ---- Title & description ----
        const titleLength = seoTitle ? fullTitle.length : 0;
        add('Title & description', 'title-length', 6,
            titleLength >= 30 && titleLength <= 60 ? 'pass'
                : (titleLength >= 20 && titleLength < 30) || (titleLength > 60 && titleLength <= 70) ? 'warn' : 'fail',
            `SEO title is ${titleLength} characters`,
            `Aim for 30-60 characters, including “${TITLE_SUFFIX.trim()}”. Longer titles get cut off in Google.`);

        const descLength = metaDescription.length;
        add('Title & description', 'desc-length', 6,
            descLength >= 120 && descLength <= 160 ? 'pass'
                : (descLength >= 70 && descLength < 120) || (descLength > 160 && descLength <= 180) ? 'warn' : 'fail',
            `Meta description is ${descLength} characters`,
            'Aim for 120-160 characters that make someone want to click.');

        add('Title & description', 'slug-length', 3,
            !slug ? 'fail' : slug.length <= 75 ? 'pass' : 'warn',
            `URL is ${slug.length} characters`,
            'Keep the slug short and readable (under 75 characters).');

        // ---- Content ----
        add('Content', 'content-length', 8,
            wordCount >= 600 ? 'pass' : wordCount >= 300 ? 'warn' : 'fail',
            `Article is ${wordCount.toLocaleString()} words`,
            'Articles of 600+ words have room to answer the question properly.');

        add('Content', 'internal-links', 6,
            internalLinks.length ? 'pass' : 'fail',
            `${internalLinks.length} internal link${internalLinks.length === 1 ? '' : 's'}`,
            'Link to a related service, case study or article on this site.');

        add('Content', 'external-links', 3,
            externalLinks.length ? 'pass' : 'warn',
            `${externalLinks.length} external link${externalLinks.length === 1 ? '' : 's'}`,
            'Cite at least one trusted source (a study, Google documentation, statistics).');

        add('Content', 'featured-image', 4,
            input.featuredImage ? 'pass' : 'fail',
            input.featuredImage ? 'Featured image set' : 'No featured image',
            'Add a featured image; it is used on blog cards and when the article is shared.');

        // ---- Readability ----
        add('Readability', 'subheadings', 4,
            wordCount <= 300 ? (wordCount ? 'pass' : 'fail')
                : !headings.length ? 'fail' : longestSection > 350 ? 'warn' : 'pass',
            headings.length ? `${headings.length} subheading${headings.length === 1 ? '' : 's'}` : 'No subheadings',
            'Break the article up with an H2 or H3 at least every 300 words.');

        const longestParagraph = paragraphs.length ? Math.max(...paragraphs) : 0;
        add('Readability', 'paragraphs', 3,
            !paragraphs.length ? 'na' : longestParagraph <= 150 ? 'pass' : longestParagraph <= 200 ? 'warn' : 'fail',
            paragraphs.length ? `Longest paragraph is ${longestParagraph} words` : 'Paragraph length',
            'Keep paragraphs under 150 words so they are easy to scan on a phone.');

        const scored = checks.filter(c => c.status !== 'na');
        const total = scored.reduce((sum, c) => sum + c.weight, 0);
        const earned = scored.reduce((sum, c) => sum + (c.status === 'pass' ? c.weight : c.status === 'warn' ? c.weight / 2 : 0), 0);
        const score = total ? Math.round((earned / total) * 100) : 0;

        return {
            score,
            checks,
            stats: {
                wordCount,
                readingMinutes: readingTime(wordCount),
                keywordCount,
                density,
                internalLinks: internalLinks.length,
                externalLinks: externalLinks.length,
                images: images.length
            }
        };
    }

    function rating(score) {
        if (score >= 80) return { key: 'good', label: 'Good' };
        if (score >= 50) return { key: 'ok', label: 'Needs work' };
        return { key: 'poor', label: 'Poor' };
    }

    window.SeoAnalyzer = { analyze, countWords, readingTime, rating, slugify, TITLE_SUFFIX, SITE_HOST };
})();
