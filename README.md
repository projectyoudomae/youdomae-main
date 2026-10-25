# youdomae-main

## Cloudflare Pages and D1

Posts and accounts are stored in D1 through the Pages Function API in `functions/api`. The Pages project already has the D1 binding named `DB`.

1. In **Workers & Pages → your Pages project → Settings → Variables and Secrets**, add `ADMIN_PASSWORD` as a secret. Set it to the existing administrator password. It is only used to create the first administrator record in D1; later logins are checked against the salted password hash stored in D1.
2. Apply the schema to the bound D1 database (for example, with `npx wrangler d1 execute <DATABASE_NAME> --remote --file=./schema.sql`). This adds the accounts and sessions tables alongside the existing posts table.
3. Deploy the project as a Cloudflare Pages project with Functions enabled. The static page and the `functions/` directory must be deployed together.

The page imports posts already saved in the current browser into D1 when it first connects. Posts, photos, comments, and like counts are then shared with visitors to the same deployment. New account registrations, administrator credentials, and expiring login sessions are stored in D1; passwords use salted PBKDF2 hashes and session tokens are stored as hashes. On the administrator's first login after deployment, the existing administrator account is created in D1 and assigned the admin role. Photos are limited to 1.2 MB after compression to fit D1 row limits. Videos remain in the author's browser; sharing video files requires an R2 bucket and is not configured here. Accounts previously registered only in a browser are not migrated.