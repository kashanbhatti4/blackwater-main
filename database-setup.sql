-- ========================================================
-- Blackwater Blog CMS - Complete Database Setup
-- 1-Click Import for Hostinger phpMyAdmin
-- ========================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 1. Table: admins
CREATE TABLE IF NOT EXISTS `admins` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `username` VARCHAR(100) NOT NULL UNIQUE,
    `email` VARCHAR(255) NOT NULL UNIQUE,
    `password_hash` VARCHAR(255) NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Table: categories
CREATE TABLE IF NOT EXISTS `categories` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(100) NOT NULL,
    `slug` VARCHAR(100) NOT NULL UNIQUE,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Table: blogs
CREATE TABLE IF NOT EXISTS `blogs` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `title` VARCHAR(255) NOT NULL,
    `slug` VARCHAR(255) NOT NULL UNIQUE,
    `excerpt` TEXT NULL,
    `content` LONGTEXT NOT NULL,
    `featured_image` VARCHAR(500) NULL,
    `category_id` INT NULL,
    `category_name` VARCHAR(100) NULL,
    `status` ENUM('draft', 'published') NOT NULL DEFAULT 'draft',
    `reading_time` VARCHAR(50) DEFAULT '5 min',
    `meta_title` VARCHAR(255) NULL,
    `meta_description` TEXT NULL,
    `published_at` DATETIME NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_blogs_slug` (`slug`),
    INDEX `idx_blogs_status_published` (`status`, `published_at`),
    CONSTRAINT `fk_blogs_category` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Table: tags
CREATE TABLE IF NOT EXISTS `tags` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(100) NOT NULL,
    `slug` VARCHAR(100) NOT NULL UNIQUE,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Table: blog_tags
CREATE TABLE IF NOT EXISTS `blog_tags` (
    `blog_id` INT NOT NULL,
    `tag_id` INT NOT NULL,
    PRIMARY KEY (`blog_id`, `tag_id`),
    INDEX `idx_blog_tags_tag` (`tag_id`),
    CONSTRAINT `fk_blog_tags_blog` FOREIGN KEY (`blog_id`) REFERENCES `blogs` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_blog_tags_tag` FOREIGN KEY (`tag_id`) REFERENCES `tags` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Seed Active Admin User
-- Username: admin | Password: AdminPassword2026!
-- --------------------------------------------------------
INSERT INTO `admins` (`id`, `username`, `email`, `password_hash`) 
VALUES (1, 'admin', 'admin@bwdigitalmarketing.ie', '$2b$10$8SGNa8.aoh5noQHmNJ.jdul/2hEVn8esqWPOrmJIwpBa5ZZqSdXwa')
ON DUPLICATE KEY UPDATE `password_hash` = VALUES(`password_hash`);

-- --------------------------------------------------------
-- Seed Default Categories
-- --------------------------------------------------------
INSERT INTO `categories` (`id`, `name`, `slug`) VALUES
(1, 'Paid Ads', 'paid-ads'),
(2, 'SEO', 'seo'),
(3, 'Web Design', 'web-design'),
(4, 'AI Search', 'ai-search'),
(5, 'Creative Strategy', 'creative-strategy')
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

-- --------------------------------------------------------
-- Seed Initial 4 Blog Posts
-- --------------------------------------------------------
INSERT INTO `blogs` (`id`, `title`, `slug`, `excerpt`, `content`, `featured_image`, `category_id`, `category_name`, `status`, `reading_time`, `meta_title`, `meta_description`, `published_at`) VALUES
(1, 'Why Irish SMEs Waste 40% of Their Google Ads Budget', 'why-irish-smes-waste-40-of-their-google-ads-budget', 'Discover where Irish SMEs lose money on Google Ads, from poor targeting to weak tracking, and how better campaign management can improve your return.', '<p>Google Ads can be one of the fastest ways for an Irish SME to generate leads and sales. But without careful management, a significant part of that budget can disappear into clicks that never turn into customers.</p><p>The problem is rarely Google Ads itself. It is usually how campaigns are set up, measured and managed.</p><h3>Broad targeting attracts the wrong clicks</h3><p>One of the most common problems is targeting searches that are too broad. An account may generate plenty of traffic, but traffic alone does not pay the bills.</p><h3>Poor conversion tracking hides what works</h3><p>Clicks and impressions only tell part of the story. If phone calls, contact forms, purchases or bookings are not being tracked correctly, it becomes difficult to know which campaigns are actually generating revenue.</p>', 'https://res.cloudinary.com/di3rmgxjc/image/upload/v1786212166/image-mockup_lg5who.png', 1, 'Paid Ads', 'published', '6 min', 'Why Irish SMEs Waste 40% of Their Google Ads Budget', 'Discover where Irish SMEs lose money on Google Ads, from poor targeting to weak tracking.', NOW()),

(2, 'Local SEO Ireland 2026: What Moves the Map Pack', 'local-seo-ireland-2026-what-moves-the-map-pack', 'See what moves Google Maps rankings in 2026, from Google Business Profile categories and reviews to local links, website relevance and Cork proximity.', '<p>If you are working on local SEO Ireland or local SEO Cork, the goal is not traffic for its own sake. You want to appear when a potential customer nearby searches for what you sell, then turn that visibility into a call, booking, visit or enquiry.</p><p>In 2026, the map pack remains one of the most valuable parts of Google Search for a local business.</p><h3>Relevance starts with your Google Business Profile</h3><p>Your primary category should describe what the business actually is, not simply a service you want to rank for.</p>', 'https://res.cloudinary.com/sq3dikgp/image/upload/v1787166168/clientlogo5.png', 2, 'SEO', 'published', '9 min', 'Local SEO Ireland 2026: What Moves the Map Pack', 'See what moves Google Maps rankings in 2026, from Google Business Profile categories and reviews to local links.', NOW()),

(3, 'Why Your Fast Website Still Needs a Better Landing Page', 'why-your-fast-website-still-needs-a-better-landing-page', 'A fast website can still lose leads. Learn why your landing page is not converting and how to fix messaging, CTAs, forms, trust and mobile experience.', '<p>You fixed the speed problem. The page loads quickly, the mobile score looks healthy, and nobody is waiting for a hero image to appear. Yet the form is quiet.</p><p>A fast website removes friction, but it does not create motivation. Your landing page still has to explain the offer, match the visitor intent, build trust and make the next action feel easy.</p>', 'https://res.cloudinary.com/sq3dikgp/image/upload/v1787166495/clientlogo14.png', 3, 'Web Design', 'published', '5 min', 'Why Your Fast Website Still Needs a Better Landing Page', 'A fast website can still lose leads. Learn why your landing page is not converting and how to fix messaging.', NOW()),

(4, 'AI Overview: How Search Changes Before People Buy', 'ai-overview-how-search-changes-before-people-buy', 'AI Overview is changing how people search before buying. Learn why longer, detailed queries are reshaping SEO, content and purchase decisions in 2026.', '<p>For years, search marketing trained us to think in keywords. Someone wanted an accountant, running shoes or project management software, so they typed a short phrase into Google. That behaviour is not disappearing. But artificial intelligence is giving people another way to search before they buy.</p><p>The query starts to look less like a keyword and more like a buying brief.</p>', 'https://res.cloudinary.com/sq3dikgp/image/upload/v1787166170/clientlogo13.png', 4, 'AI Search', 'published', '7 min', 'AI Overview: How Search Changes Before People Buy', 'AI Overview is changing how people search before buying.', NOW())
ON DUPLICATE KEY UPDATE `title` = VALUES(`title`);

SET FOREIGN_KEY_CHECKS = 1;
