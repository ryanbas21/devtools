# Privacy Policy — OIDC Devtool

**Last updated:** May 10, 2026

## Overview

OIDC Devtool is a Chrome DevTools extension that helps developers inspect and debug OIDC/OAuth2 authentication flows. **All data stays in your browser — nothing is transmitted to external servers.**

## What Data Is Collected

When the DevTools panel is open, the extension observes and captures:

- **Network requests** — URLs, HTTP methods, status codes, headers, and response bodies for authentication-related requests (e.g. token endpoints, authorization endpoints, OIDC discovery)
- **Authentication data** — OAuth2/OIDC tokens, authorization codes, client IDs, grant types, PKCE parameters, and flow state
- **SDK events** — If the host application uses the optional `@wolfcola/devtools-bridge` package, the extension captures SDK node transitions, configuration, and flow metadata
- **Session data** — Changes to cookies and localStorage keys related to authentication
- **Web history** — URLs of network requests observed during authentication flows

## How Data Is Stored

- All data is stored **locally in your browser** using `chrome.storage.local`
- Up to 5 user-initiated flow snapshots are stored locally
- No data is synced to the cloud, sent to analytics services, or transmitted to any external server

## How Data Is Used

Captured data is used solely to:

- Display authentication flow timelines, network details, and diagnostics in the DevTools panel
- Identify CORS issues, missing OIDC parameters, and other auth misconfigurations
- Allow developers to export flow data for debugging purposes

## Data Export and Redaction

When you export flow data (JSON or Markdown), sensitive fields are **automatically redacted**, including:

- Bearer tokens, access tokens, refresh tokens, and ID tokens
- Authorization codes
- Cookies and Set-Cookie headers
- Passwords, secrets, and credential callback values

Exported files are written to your clipboard — they are not uploaded anywhere.

## What Data Is NOT Collected

- No personally identifiable information (names, emails, addresses)
- No analytics, telemetry, or usage tracking
- No data is sent to any external server, API, or third party
- No user accounts or sign-in required

## Permissions Explained

| Permission | Why It's Needed |
|---|---|
| `storage` | Store captured flow data and snapshots locally in the browser |
| `clipboardWrite` | Copy exported flow data to the clipboard |
| `clipboardRead` | Paste imported flow data into the panel for analysis |
| `host_permissions (<all_urls>)` | Observe authentication network requests across all origins, since OIDC flows involve redirects between multiple domains |

## Third-Party Services

This extension does not integrate with, send data to, or receive data from any third-party services.

## Changes to This Policy

Updates to this privacy policy will be reflected in this document with an updated date.

## Contact

If you have questions about this privacy policy, please open an issue at [https://github.com/ryanbas21/devtools/issues](https://github.com/ryanbas21/devtools/issues).
