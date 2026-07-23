# Brand assets

Drop the real logo file here (e.g. `logo.png` or `logo.svg`), then set
`NEXT_PUBLIC_LOGO_URL` in `.env.local` to its public path, e.g.:

```
NEXT_PUBLIC_LOGO_URL=/brand/logo.png
```

`<Logo>` (`src/components/branding/logo.tsx`) picks it up automatically -
no other code changes needed. Leave the env var unset to keep the plain
text wordmark.

Product name, tagline and colour palette are configured separately in
`src/lib/settings.ts`.
