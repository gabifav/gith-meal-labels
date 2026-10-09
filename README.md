# GITH Meal Labels

## Enable shared meals

1. In Supabase Authentication → Sign In / Providers, enable Anonymous Sign-Ins.
2. Open SQL Editor, create a query, paste the complete contents of [supabase-setup.sql](./supabase-setup.sql), and click Run. Run this initial migration once.
3. Refresh the meal app, enter a device name, and choose Create shared workspace. This device becomes its admin.
4. Use Connect another device to generate a QR code and link. Each invitation expires in 15 minutes and can be used once. Joined devices are contributors.
5. Optionally use Import local meals & photos once on the admin device. Existing local data is retained; repeating the import creates duplicates.

Meal name is required. Meal count, dietaries, cook name and photo are optional. A missing count generates no labels. Tuesday/Friday submissions feed the existing Avery print/export controls.

Contributors can submit and edit their own entries. Only admins can remove entries or disconnect contributor devices. These rules are enforced in the database. QR invitations grant contributor access, never admin access. Updates use version checks to reject conflicting edits and refresh every five seconds while the app is visible. Online access is needed to save; failed saves retain the form for retry.

Shared mode covers meal submissions, photos, counts, dietaries and cook names. The older local cook-arrival tracker, packing checklist and calculators are separate local features and are hidden in shared mode.

Device identity is stored in this browser. Clearing browser data loses that identity; the device needs another invitation. Keep the admin browser data intact. Supabase administrators can restore admin access through the database if needed. Recoverable account login is not implemented yet.

Photos are resized and saved with the entry in the access-controlled database. This is intended for a small meal guide. The Supabase publishable key is public client configuration; no service-role or secret key belongs in this repository.

Validation: JavaScript syntax checked. Live two-device and database policy tests require completing the Supabase setup and have not yet been run.
