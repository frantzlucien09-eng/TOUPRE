/*
# Add image support to messages

## Overview
Adds an optional `image_url` column to the `messages` table so vendors and
customers can send photos in chat (e.g. a vendor showing another product color).

## Changes to `messages`
1. `image_url` (text, nullable) — public URL of an uploaded chat image.
2. New index on `sender_id` for faster conversation queries.
3. Composite index on (recipient_id, read) for unread-count queries.

## Security
- No policy changes needed — existing RLS policies already cover the new column.
- Images are uploaded to the existing `product-media` bucket (reused for chat
  photos) under a `chat/<vendor_id>/` path namespace.

## Notes
- `image_url` is nullable so existing text-only messages remain valid.
- The frontend enforces that a message has either a body or an image_url.
*/

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS image_url text;

CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient_read ON messages(recipient_id, read);
