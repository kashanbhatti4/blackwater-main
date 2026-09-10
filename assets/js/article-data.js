const articles = [
    {
        id: "01",
        title: "Why Irish SMEs waste 40% of their Google Ads budget",
        category: "Paid Ads",
        readingTime: "6 min",
        image: "https://res.cloudinary.com/di3rmgxjc/image/upload/v1786212166/image-mockup_lg5who.png",
        excerpt: "A deep dive into common pitfalls and how to optimize your ad spend for better returns.",
        body: `
            <img src="https://res.cloudinary.com/di3rmgxjc/image/upload/v1786212166/image-mockup_lg5who.png" alt="Google Ads Example" style="width: 100%; height: auto; border-radius: 8px; margin-bottom: 40px; border: 1px solid #2A2B25;">
            
            <h3 class="u-text-style-h3" style="color: #FFFCE1; margin-top: 48px; margin-bottom: 24px;">The Hidden Costs of Poor Account Structure</h3>
            <p>Many Irish SMEs struggle with Google Ads because their accounts are poorly structured from day one. Instead of targeting specific intent-based keywords, they cast a wide net and end up paying for irrelevant clicks.</p>
            <p>In our experience auditing over 50 local business accounts, the average wasted spend sits right around 40%. This isn't just inefficient—it's actively harming your ability to scale.</p>
            
            <h3 class="u-text-style-h3" style="color: #FFFCE1; margin-top: 48px; margin-bottom: 24px;">How to fix it</h3>
            <ul>
                <li>Segment campaigns by intent, not just product category.</li>
                <li>Implement aggressive negative keyword lists.</li>
                <li>Match landing pages perfectly to the search term.</li>
            </ul>
        `
    },
    {
        id: "02",
        title: "Local SEO in 2026: what actually moves the map pack",
        category: "SEO",
        readingTime: "9 min",
        image: "https://res.cloudinary.com/sq3dikgp/image/upload/v1787166168/clientlogo5.png",
        excerpt: "Explore the new ranking factors that are defining local search visibility today.",
        body: `
            <h3 class="u-text-style-h3" style="color: #FFFCE1; margin-top: 48px; margin-bottom: 24px;">Moving Beyond Basic Citations</h3>
            <p>If you think building a few directory links is enough to rank in the local map pack in 2026, you're already behind. Google's local algorithm has shifted dramatically towards behavioral signals and real-world entities.</p>
            
            <video src="https://res.cloudinary.com/sq3dikgp/video/upload/v1787166866/No._2_Clarity_Investigations_Hero.mp4" autoplay loop muted playsinline style="width: 100%; border-radius: 8px; margin: 40px 0; border: 1px solid #2A2B25;"></video>
            
            <p>We've analyzed the top 3 results across 100 competitive local niches and found that proximity is no longer the only king. Relevance, driven by semantic content on your local landing pages and robust Google Business Profile engagement, is taking over.</p>
            
            <h3 class="u-text-style-h3" style="color: #FFFCE1; margin-top: 48px; margin-bottom: 24px;">Key Takeaways</h3>
            <ul>
                <li>Encourage detailed, keyword-rich reviews from customers.</li>
                <li>Post consistently to your GBP with high-quality, relevant updates.</li>
                <li>Ensure your local pages answer specific user queries comprehensively.</li>
            </ul>
        `
    },
    {
        id: "03",
        title: "Your website is fast. Your landing page isn't converting.",
        category: "Web Design",
        readingTime: "5 min",
        image: "https://res.cloudinary.com/sq3dikgp/image/upload/v1787166495/clientlogo14.png",
        excerpt: "Speed is just one part of the equation. Discover why fast pages still fail to convert.",
        body: `
            <video src="https://res.cloudinary.com/sq3dikgp/video/upload/v1787166864/No._1_Frameless_Hero.mp4" autoplay loop muted playsinline style="width: 100%; border-radius: 8px; margin-bottom: 40px; border: 1px solid #2A2B25;"></video>
            
            <h3 class="u-text-style-h3" style="color: #FFFCE1; margin-top: 48px; margin-bottom: 24px;">The Speed Myth</h3>
            <p>We've all heard it: a 1-second delay in page load time equals a 7% drop in conversions. So you spent thousands optimizing your core web vitals, compressing images, and moving to a headless setup. Your site loads in 0.8 seconds.</p>
            <p>And yet, conversions haven't moved an inch.</p>
            <p>Why? Because a fast page that fails to address the user's core problem is just a fast way to bounce. Speed is a prerequisite, not a differentiator.</p>
            
            <img src="https://res.cloudinary.com/sq3dikgp/image/upload/v1787166495/clientlogo14.png" alt="Client Logo" style="max-width: 200px; display: block; margin: 40px auto; opacity: 0.8;">
            
            <h3 class="u-text-style-h3" style="color: #FFFCE1; margin-top: 48px; margin-bottom: 24px;">What actually matters</h3>
            <p>Once you hit the threshold of "fast enough" (usually around 2.5 seconds LCP), your focus must shift entirely to messaging, clarity, and friction reduction. A slower page with a compelling offer will always beat a lightning-fast page with a confusing hero section.</p>
        `
    },
    {
        id: "04",
        title: "How AI search is changing what people type before they buy",
        category: "AI Search",
        readingTime: "7 min",
        image: "https://res.cloudinary.com/sq3dikgp/image/upload/v1787166170/clientlogo13.png",
        excerpt: "An analysis of evolving search behavior in the era of generative AI.",
        body: `
            <h3 class="u-text-style-h3" style="color: #FFFCE1; margin-top: 48px; margin-bottom: 24px;">The Death of the Keyword Fragment</h3>
            <p>For two decades, we were trained to search like cavemen: "plumber dublin cheap." Now, with AI-driven search experiences becoming the norm, users are returning to natural language.</p>
            
            <img src="https://res.cloudinary.com/di3rmgxjc/image/upload/v1786212166/image-mockup_lg5who.png" alt="Search Example" style="width: 100%; height: auto; border-radius: 8px; margin: 40px 0; border: 1px solid #2A2B25;">
            
            <p>They are asking complex, multi-part questions. They want synthesis, not just a list of blue links. This shift changes everything about how we structure content for discovery.</p>
            
            <h3 class="u-text-style-h3" style="color: #FFFCE1; margin-top: 48px; margin-bottom: 24px;">Adapting to the New Reality</h3>
            <p>To capture this new type of intent, content must become more conversational and comprehensive. You need to answer the immediate question, anticipate the follow-up, and provide a clear path forward—all on the same page.</p>
        `
    }
];

// If we're in a modular environment, export it. Otherwise, attach to window.
if (typeof module !== 'undefined' && module.exports) {
    module.exports = articles;
} else {
    window.journalArticles = articles;
}
