-- Initial seed data for Blackwater Blog CMS

-- Default Admin User (Username: admin, Email: admin@blackwater.com, Password: admin123)
-- Password hash generated with bcrypt (salt 10) for 'admin123'
INSERT INTO `admin_users` (`username`, `email`, `password_hash`) 
VALUES ('admin', 'admin@blackwater.com', '$2b$10$ztwkLNeta54.bYvn3ukdPOmXQGRZQgdqjndzMUcH07TJIcJrvewqi')
ON DUPLICATE KEY UPDATE `password_hash`='$2b$10$ztwkLNeta54.bYvn3ukdPOmXQGRZQgdqjndzMUcH07TJIcJrvewqi';


-- Default Categories
INSERT INTO `categories` (`name`, `slug`) VALUES
('Paid Ads', 'paid-ads'),
('SEO', 'seo'),
('Web Design', 'web-design'),
('AI Search', 'ai-search'),
('Strategy', 'strategy')
ON DUPLICATE KEY UPDATE `name`=`name`;

-- Default Tags
INSERT INTO `tags` (`name`, `slug`) VALUES
('Google Ads', 'google-ads'),
('Local SEO', 'local-seo'),
('Conversion Rate', 'conversion-rate'),
('Digital Strategy', 'digital-strategy'),
('Content Marketing', 'content-marketing')
ON DUPLICATE KEY UPDATE `name`=`name`;
