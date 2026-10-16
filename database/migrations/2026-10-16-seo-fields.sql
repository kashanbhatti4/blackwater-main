-- Focus keyword and SEO score for the admin editor's SEO analysis.
-- The blogs API adds these columns automatically on first use; run this by hand only
-- if the database user isn't allowed to ALTER tables.
ALTER TABLE `blogs`
    ADD COLUMN `focus_keyword` VARCHAR(255) NULL AFTER `meta_description`,
    ADD COLUMN `seo_score` TINYINT UNSIGNED NULL AFTER `focus_keyword`;
