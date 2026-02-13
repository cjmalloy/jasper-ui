# Jasper-UI
Reference client for Jasper KM.

[![Build & Test](https://github.com/cjmalloy/jasper-ui/actions/workflows/test.yml/badge.svg)](https://cjmalloy.github.io/jasper-ui/reports/latest-vitest)
[![Playwright](https://github.com/cjmalloy/jasper-ui/actions/workflows/playwright.yml/badge.svg)](https://cjmalloy.github.io/jasper-ui/reports/latest-playwright)
[![Artifact Hub](https://img.shields.io/endpoint?url=https://artifacthub.io/badge/repository/jasper)](https://artifacthub.io/packages/helm/jasper/jasper-ui)

Jasper-UI is the reference client for the
[Jasper Knowledge Management Server](https://github.com/cjmalloy/jasper)

## Quickstart
To start the server, client and database with a single admin user, run
the [quickstart](https://github.com/cjmalloy/jasper-ui/blob/master/quickstart/docker-compose.yaml)
docker compose file.

## Knowledge Management Client
As the reference client for the jasper protocol this project is designed to expose all
features of the jasper protocol with a user experience supporting devs and power users.

This client allows you to expressively annotate links with tags and your own ontology.
It can be left unmodded to act as a general purpose database or admin tool.
With modding single purpose UIs can be derived for prototyping, one-off use, or micro-frontends.
Modding can also augment existing general purpose functionality. See `src/app/mods` for bundled mods.
Other mod distributions may be compatible with this client or require a different client.
The same network can be used by multiple clients and unsupported features are silently ignored.

General Purpose Usage:
* RSS Reader
* AI Chat
* Bulletin Board
* Discussion Forum
* Wiki / Knowledge Base
* Business Workflow Automation
* Continuous Offsite Backups

## Features

### Text Editor
Markdown editor with support for rendering both markdown and HTML.
* Use `#tag` to create a tag link. Add a space for the usual markdown H1 "# Title".
* Any links in markdown will automatically be added to either sources or alternate URLs
* Use `[1]` or `[[1]]` to reference existing sources. The number will be the 1-based index of the source.
* Use `[alt1]` or `[[alt1]]` to reference alternate URLs. Use `[alt1](url)` to add an alternate URL. The
  number will be the 1-based index of the alternate URLs.
* Using `+user/charlie` with the inbox plugin installed will add `plugin/inbox/user/charlie`
  to the tags. Use `#+user/charlie` instead to simply link to the user without notifying them.
* Use `^` to create superscripts. Use in combination with source references for standard reference style such
  as `^[1]` or `^[[1]]`.
* Any links to a ref or tag will render a toggle button to expand inline (any link that starts
  with `/ref/` or `/tag/`, with or without the server host and base path).
* Links of the form `![=](www.example.com)` will add a ref entry inline.
* Links of the form `![](www.example.com)` will embed the contents of the Ref if it exists, or attempt to embed
  the url directly if it is an image, audio, video, or embeddable sites.
* Links of the form `![+](www.example.com)` will add a toggle button that will expand to show the contents
  of the Ref if it exists, or attempt to show the content directly if it is an image, audio, video, and embeddable
  sites.
* Links of the form `![](/tag/query)` will add results of a tag query inline.
### Tag Query Page
* Perform any tag query while performing a full text search and multi-column sort
* Displays title from tag Ext if present
* Displays sidebar markdown from tag Ext if present
* Displays pinned Refs from tag Ext if present
* Adds Modmail button that sends a DM to `plugin/inbox/tag`
### Mods
1. **Root Mod:**
   1. **Pinned links:** Display these links at the top of this tag's page.
   2. **Sidebar:** (optional) Custom markdown content for the sidebar. LaTeX and emojis are
   supported if plugins are installed.
   3. **Themes:** (optional) Set a custom theme for a tag page. Will remain active until a
   different tag page is visited.
2. **User:** (matches `user/`) Store user generated data:
   1. Inbox: last notified time (for use with the inbox plugin)
   2. Subscriptions: List of tags to show on your home page
   3. Themes: (optional) Override the theme for the entire site. Will cause custom tag themes
   to be ignored.
3. **Home Page:** Enables a home page where you can subscribe to various tags or queries and
see them on a personalized dashboard.
4. **Inbox:** Enables notifications when installed. You receive a notification when someone posts a
response to yours. Activates the envelope icon button in the settings area of the client.
Requires the inbox field in the user template. When posting a response the client will add (for
example with `+user/charlie`) `plugin/inbox/user/charlie` to the tags. This will cause it to show up
in `+user/charlie`'s notifications. Users also receive notifications for all tags they have write
access to (tag modmail). This tag is also the convention by which you may address a Ref "To:"
another user. Also includes an outbox plugin for remote notifications and a DM template for
private direct messages.
5. **Comment:** Enables comments and comment threads when installed. Allows sorting Refs by number
of comments. Comments are created with `plugin/comment` and `internal` tags. (the `internal` tag
prevents the comment from showing up on `@*`). Adds a deleted field to the ref to mark the
comment as deleted. This is used to prevent breaking a comment thread by actually removing a
node when a comment is deleted.
6. **Thread:** Merges similar Refs tagged `plugin/thread` into discussion threads.
7. **Delete Notice:** Marks Refs as deleted without actually removing them, preserving comment
thread structure.
8. **Thumbnail:** Enables the Ref thumbnail when installed. When a Ref is tagged `plugin/thumbnail`,
the Ref has an image that can be used as a thumbnail. Adds optional url, width, height, and time
fields to the Ref. If the url field is not specified, the url of the Ref will be the image
thumbnail.
9. **LaTeX:** Enables KaTeX processing on the Ref comment markdown. Use `$` for inline math
and `$$` for block math. KaTeX support for sidebar content is always enabled if this plugin
is installed. Does not add data to a Ref.
10. **Code:** Edit and view code with syntax highlighting using the Monaco editor (the same
editor as VS Code), supporting multiple programming languages.
11. **QR:** Enables the QR embed when installed. When the `plugin/qr` is applied to a Ref, the Ref has
a URL to be converted into a QR code. The QR code is shown when the embed toggle is pressed. Adds
optional URL field to the Ref to use for the QR code, if this is unspecified the URL of the Ref
will be used.
12. **Embed:** Enables the iframe embed when installed. When the `plugin/embed` is applied to a Ref,
the Ref has a URL that can be used in an iframe. The iframe is shown when the embed toggle is
pressed. Adds optional URL field to the Ref to use for the iframe, if this is unspecified the
URL of the Ref will be used. Currently implemented for:
    1. YouTube
    2. X/Twitter
    3. BitChute
13. **Audio:** Enables the audio embed when installed. When the `plugin/audio` is applied to a Ref,
the Ref has a URL that points to an audio file. The audio player is shown when the embed toggle
is pressed. Adds optional URL field to the Ref to use for the audio file, if this is unspecified
the URL of the Ref will be used. This plugin will be suggested when
you submit a link ending in an audio file extension.
14. **Video:** Enables the video embed when installed. When the `plugin/video` is applied to a Ref,
the Ref has a URL that points to a video file. The video player is shown when the embed toggle
is pressed. Adds optional URL field to the Ref to use for the video file, if this is unspecified
the URL of the Ref will be used. This plugin will be suggested when
you submit a link ending in a video file extension.
15. **Image:** Enables the image embed when installed. When the `plugin/image` is applied to a Ref,
the Ref has a URL that points to an image file. The image is shown when the embed toggle is
pressed. Adds optional URL field to the Ref to use for the image file, if this is unspecified
the URL of the Ref will be used. Also provides an image gallery template with a responsive grid
layout. This plugin will be suggested when you submit a link ending in an image file extension.
16. **PDF:** Adds an action button to open the PDF version of a Ref.
17. **Playlist:** Create a playlist from the list of sources on a Ref.
18. **File:** Allow storing user files on the server using a file cache.
19. **Wiki:** Enables adding Wiki Refs when installed. When creating a wiki the URL will be
`wiki://Page_name`. You can link to a Wiki page using the double `[[bracket syntax]]` in all
markdown fields. Does not add data to the Ref.
20. **Blog:** View and organize collections of blog posts with tag-based filtering and
title/body formatting.
21. **Chat:** Real-time chat rooms where multiple users can message each other. Includes chatroom
embeds, a user lobby for tracking online users, and optional video call support.
22. **Kanban:** Organize tasks on a visual board with customizable columns (To Do, In Progress,
Done), swim lanes (by team or owner), and priority badges with drag-and-drop between lanes.
23. **Lens:** Embed query results as visual cards in a grid layout. Can be used to display
related content directly inside a Ref.
24. **Person:** Adds filtering and stylizing to support people-oriented content semantics.
25. **Repost:** Re-submit a URL which has already been submitted by another user. The first
source of this Ref is the URL to be reposted.
26. **Hide:** Mark Refs as hidden for the current user.
27. **Save:** Save Refs to a personal list for the current user.
28. **Mark as Read:** Track read status for Refs across multiple sessions.
29. **AI:** Send Refs to an AI for responses. Includes support for DALL·E image generation,
a Navi chat assistant, automatic summarization, and translation. Configurable LLM settings
with optional web search context.
30. **Delta:** Apply server-side scripts to transform Refs. Includes a scheduler for running
scripts on configurable intervals.
31. **RSS/Atom Feed:** Import entries from an RSS or Atom feed. The feed will be scraped on an
interval you specify.
32. **Remote Origin:** Replicate a remote Jasper instance. The remote origin will be scraped
on an interval you specify. If the remote is also set up to replicate from this instance, you
may communicate with remote users. Supports push and pull modes.
33. **Scrape:** Configure CSS selectors for scraping websites.
34. **Email:** Render e-mail specific formatting in Refs.
35. **Cache:** Cache remote resources locally. Includes recycle bin support: if you delete a Ref
its cached file will not be removed from storage right away, and restoring the Ref before the
cache is cleared also recovers the cached file.
36. **YT-DLP:** Download and cache videos using YT-DLP.
37. **MarkItDown:** Convert documents to Markdown using Microsoft MarkItDown. Supports PDF,
Word, Excel, PowerPoint, images (with OCR), audio (transcription), HTML, and more.
38. **HTML to Markdown:** Add a button to the editor to convert HTML content into Markdown.
39. **Mod Store:** Install and share mods with other users.
40. **Mod Tools:** Moderate content with approval workflows, NSFW tagging, and user reporting.
Adds a modlist tab to the inbox for reviewing unmoderated posts.
41. **Themes:** Add custom themes to the global theme list. Includes Terminal and Night themes.
42. **Fullscreen:** Fullscreen the viewer when an embed is shown.
43. **Seamless:** Remove the white border from the comment markdown for a cleaner display.
44. **GDPR:** Activates a GDPR-compliant cookie consent banner.
45. **Chess:** Play chess games with move tracking, board flip, and an AI opponent. Includes an
integrated chatroom for game commentary.
46. **Backgammon:** Play backgammon with piece dragging, dice rolling, game replay controls, and
customizable player names.

## Coming Soon
1. **Voting:** Enables voting and sorting by vote when installed. Requires additions to the user
template to hold votes. This adds two new sort fields to the UI: Top and Hot. Top sorts by vote
total, and Hot applies an exponential time decay when sorting. If the inbox plugin is enabled
there is a tab on the index page to view the refs you voted on. Can be configured to allow
positive or both positive and negative votes. Voting on a Ref adds it to a list in your user
extension. Does not add data to a Ref.
2. **Graph:** Create and visualize relationship graphs to show connections and hierarchies
between items.
3. **Folder:** Desktop-like file browser interface where you can arrange files and subfolders
freely on a canvas with drag-and-drop positioning.
4. **Notebook:** Keep private notes in a notebook with column layouts and priority badges
(Reminder, Important).
5. **Work Queue:** Manage workflows with task assignment, tracking, and invoicing. Includes
invoice support for paying workers with QR invoices and workflow status tracking (rejected,
disputed, paid).
6. **To Do List:** Create and manage to-do lists with checkable items.
7. **Table:** Create and edit spreadsheet-style tables with CSV data in Refs.
8. **Poll:** Create multiple-choice polls and view results. Voting is done by adding a Ref
response for each poll option.
9. **Archive:** Archive Refs for long-term storage.
10. **HTML Editor:** Format Ref comments as HTML instead of Markdown.
11. **Origin Tunnel:** Create an SSH tunnel for remote origin connections.
12. **Geo:** Display GeoJSON features on interactive maps. Supports Point, LineString, Polygon,
and multi-geometry types.
13. **Chart:** Render tabular data as a graph in the embed viewer. When the `plugin/chart` is
applied to a Ref, add fields to define the chart type, labels, and data location. Adds an
optional field to the Ref to use for the tabular data, if this is unspecified the URL of the
Ref will be used to point to a TSV file.
14. **Analytics:** Enables engagement tracking when installed. Reports links clicked, Refs expanded,
Ref action taken, Refs viewed, and queries searched. Adds data to the Ref to override analytic
tracking for that ref.
15. **GeoPackage:** Display GeoPackage data on interactive maps. When a Ref is tagged
`plugin/geopackage`, the map is shown when the embed toggle is pressed. Adds an optional field
to the Ref to use for the GeoPackage, if this is unspecified the URL of the Ref will be used
to point to a GeoPackage file.

## Deployment
Jasper-UI is available in the following distributions:
 - [Docker image](https://github.com/users/cjmalloy/packages/container/package/jasper-ui) 
 - [Helm chart](https://artifacthub.io/packages/helm/jasper/jasper-ui)
 - [Zip](https://github.com/cjmalloy/jasper-ui/releases/latest)

Config settings are loaded at runtime from assets/config.json. When using a docker image, a config
file will be generated from environment variables:

| Config field     | Docker Env               | Description                                                                                       | Example Value                                                                                           |
|------------------|--------------------------|---------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------|
| `title`          | `JASPER_TITLE`           | Name to display in the title bar.                                                                 | `Jasper`                                                                                                |
| `version`        | `JASPER_VERSION`         | Version string to display as a tooltip in the footer.                                             | `v1.0.0`                                                                                                |
| `api`            | `JASPER_API`             | URL of the API server (no trailing slash)                                                         | `//jasperkm.info`                                                                                       |
|                  | `JASPER_API_PROXY`       | Backend host to proxy on `/api`. Sets `JASPER_API` to `.`                                         | `http://web:80`                                                                                         |
| `logout`         | `JASPER_LOGOUT`          | Optional URL to log out.                                                                          | `//jasperkm.info/oauth2/sign_out?rd=https%3A%2F%2Fauth.jasperkm.info%2Fauthn%2Fauthentication%2Flogout` |
| `login`          | `JASPER_LOGIN`           | Optional URL to log in. A redirect (`?rd=`) will be appended with the current page.               | `//jasperkm.info/oauth2/sign_in`                                                                        |
| `signup`         | `JASPER_SIGNUP`          | Optional URL to sign up.                                                                          | `https://auth.jasperkm.info/authn/registration/form`                                                    |
| `scim`           | `JASPER_SCIM`            | Enable SCIM user management interface.                                                            | `false`                                                                                                 |
| `websockets`     | `JASPER_WEBSOCKETS`      | Enable websocket STOMP connections.                                                               | `false`                                                                                                 |
| `support`        | `JASPER_SUPPORT`         | Optional tag to send help requests to.                                                            | `false`                                                                                                 |
| `allowedSchemes` | `JASPER_ALLOWED_SCHEMES` | Allow clickable links for certain schemas.                                                        | `["http:", "https:", "ftp:", "tel:", "mailto:"]`                                                        |
| `modSeals`       | `JASPER_MOD_SEALS`       | Seals which may only be added via ROLE_MOD or above.                                              | `["seal", "_seal", "+seal", "_moderated"]`                                                              |
| `editorSeals`    | `JASPER_EDITOR_SEALS`    | Seals which may only be added via ROLE_EDITOR or above.                                           | `["plugin/qc"]`                                                                                         |
| `maxPlugins`     | `JASPER_MAX_PLUGINS`     | Maximum number of plugins to load before giving up and writing an error to the console.           | `1000`                                                                                                  |
| `maxTemplates`   | `JASPER_MAX_TEMPLATES`   | Maximum number of templates to load before giving up and writing an error to the console.         | `1000`                                                                                                  |
| `maxOrigins`     | `JASPER_MAX_ORIGINS`     | Maximum number of origins to load before giving up and writing an error to the console.           | `1000`                                                                                                  |
| `fetchBatch`     | `JASPER_FETCH_BATCH`     | Batch size for fetching plugins, templates, and origins.                                          | `50`                                                                                                    |
| `token`          | `JASPER_TOKEN`           | Set client bearer token.                                                                          |                                                                                                         |
| `prefetch`       | `JASPER_PREFETCH`        | Prefetch proxied urls. Needed when not using cookies as image requests will not be authenticated. | `false`                                                                                                 |
|                  | `BASE_HREF`              | Set the base href for the SPA.                                                                    | `/j/`                                                                                                   |
|                  | `JASPER_LOCALE`          | One of 'en', or 'ja'. Default is 'en'.                                                            | `ja'`                                                                                                   |
|                  | `CSP_DEFAULT_SRC`        | Additional URLS to add to the default content security policy.                                    | `https://accounts.google.com https://www.googleapis.com`                                                |
|                  | `CSP_SCRIPT_SRC`         | Additional URLS to add to the script-src content security policy.                                 |                                                                                                         |
|                  | `CSP_STYLE_SRC`          | Additional URLS to add to the style-src content security policy.                                  |                                                                                                         |
|                  | `CSP_CONNECT_SRC`        | Additional URLS to add to the connect-src content security policy.                                |                                                                                                         |
|                  | `CSP_FONT_SRC`           | Additional URLS to add to the font-src content security policy.                                   |                                                                                                         |

## Developing
This project was generated with [Angular CLI](https://github.com/angular/angular-cli) version 13.3.0.

### Development server

Run `ng serve` for a dev server. Navigate to `http://localhost:4200/`. The
application will automatically reload if you change any of the source files.

### Code scaffolding

Run `ng generate component component-name` to generate a new component.
You can also use
`ng generate directive|pipe|service|class|guard|interface|enum|module`.

### Localizing

To update the localization file after new text is added run
`ng extract-i18n --output-path src/locale`.
Run
`xmlstarlet ed -N x="urn:oasis:names:tc:xliff:document:1.2" -d "//x:context-group" src/locale/messages.xlf > src/locale/messages.<locale here>.xlf`
to generate a new translation file. Then add it to the `locales` array in `angular.json`.

### Build

Run `ng build` to build the project. The build artifacts will be stored in the
`dist/` directory.

### Running unit tests

Run `ng test` to execute the unit tests via [Karma](https://karma-runner.github.io).

### Running end-to-end tests

Run `ng e2e` to execute the end-to-end tests via a platform of your choice. To
use this command, you need to first add a package that implements end-to-end
testing capabilities.

### Further help

To get more help on the Angular CLI use `ng help` or go check out the
[Angular CLI Overview and Command Reference](https://angular.io/cli) page.
