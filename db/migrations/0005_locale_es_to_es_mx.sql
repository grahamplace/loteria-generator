-- Migrate stored locale values from 'es' to 'es-MX' to match the new locale token
UPDATE "user_profiles" SET "locale" = 'es-MX' WHERE "locale" = 'es';
