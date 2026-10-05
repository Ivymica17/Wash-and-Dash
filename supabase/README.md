# Supabase setup

1. Create a Supabase project.
2. In the Supabase SQL Editor, run `setup.sql`.
3. Before the first admin signs up, authorize their email:

   ```sql
   insert into public.admin_users (email)
   values ('owner@example.com');
   ```

   Add each additional admin email the same way before they sign up. The signup form only grants dashboard access to allowlisted email addresses.
4. Copy the project's URL and anon/publishable key from **Project Settings > API** into `js/supabase-config.js`. Never put a service-role key in frontend code.
5. In **Authentication > URL Configuration**, set the Site URL to the deployed website URL and add local development URLs to the Redirect URLs list.
6. Open the site, choose **Admin login > Sign up**, and register using the authorized email. Confirm the email if confirmation is enabled, then log in. The same account works on other devices.

Bookings, availability, tracking status, and admin changes are shared through Supabase. Existing bookings and admin accounts saved in a browser before this connection are not migrated automatically.