# Jasper-UI
Reference client for Jasper KM.

[![Build & Test](https://github.com/cjmalloy/jasper-ui/actions/workflows/test.yml/badge.svg)](https://cjmalloy.github.io/jasper-ui/reports/latest-karma)
[![Cypress](https://github.com/cjmalloy/jasper-ui/actions/workflows/cypress.yml/badge.svg)](https://cjmalloy.github.io/jasper-ui/reports/latest-cypress)
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
1. **⚓️ Root Mod** (`rootMod`): Foundational features for tag pages including pinned links, sidebar markdown, themes, privacy controls, and basic scheme filters.
2. **🧑️ User Mod** (`userMod`): User data management including subscriptions, bookmarks, alarms, and personal preferences.
3. **🏡️ Home Mod** (`homeMod`): Customizable home page for subscribed tags and queries.
4. **📮️ Mailbox Mod** (`mailboxMod`): Complete messaging system with inbox, outbox plugins, and DM template for private messages.
5. **💬️ Comment Mod** (`commentMod`): Threaded comment system with built-in support for discussions.
6. **🧵️ Thread Mod** (`threadMod`): Advanced threaded discussion organization.
7. **🗨️ Chat Mod** (`chatMod`): Real-time chat room functionality.
8. **🛡️ Modlist Mod** (`modlistMod`): Moderation tools with reporting, approval, and content management.
9. **🙂️ Thanks Mod** (`thanksMod`): Quick thanks responses to posts.
10. **🖼️ Image Mod** (`imageMod`): Image display and embedding with multiple format support.
11. **🎞️ Video Mod** (`videoMod`): Video player for multiple formats.
12. **📻️ Audio Mod** (`audioMod`): Audio player for various audio formats.
13. **📄️ PDF Mod** (`pdfMod`): PDF viewing and processing.
14. **⭕️ Thumbnail Mod** (`thumbnailMod`): Thumbnail generation and display.
15. **🔭️ Embed Mod** (`embedMod`): IFrame embedding for external content.
16. **🔲 QR Mod** (`qrMod`): QR code generation and scanning.
17. **📡️ OEmbed Mod** (`oembedMod`): Rich embed support for various platforms.
18. **📔️ Wiki Mod** (`wikiMod`): Full wiki functionality with bracket syntax linking.
19. **🗒️ Code Mod** (`codeMod`): Monaco code editor with syntax highlighting.
20. **📐️ HTML Mod** (`htmlMod`): Rich HTML editing capabilities.
21. **💲️ LaTeX Mod** (`latexMod`): KaTeX mathematical notation processing.
22. **📏️ Table Mod** (`tableMod`): Spreadsheet functionality with CSV support.
23. **⬇️ HTML to Markdown Mod** (`htmlToMarkdownMod`): Convert HTML content to Markdown format.
24. **📋️ Kanban Mod** (`kanbanMod`): Kanban board implementation with customizable columns and swim lanes.
25. **🎇️ Graph Mod** (`graphMod`): Knowledge graph visualization.
26. **🚧️ Queue Mod** (`queueMod`): Work queue task management with bounties.
27. **📁 Folder Mod** (`folderMod`): Hierarchical content organization.
28. **📦 Archive Mod** (`archiveMod`): Content archiving and organization.
29. **📝 Notes Mod** (`notesMod`): Advanced note-taking system.
30. **📰 Blog Mod** (`blogMod`): Blog-style content presentation.
31. **✅ Todo Mod** (`todoMod`): Task management functionality.
32. **⬆️ Vote Mod** (`voteMod`): Voting system with upvote/downvote functionality.
33. **🗳️ Poll Mod** (`pollMod`): Multiple-choice polls with results visualization.
34. **⭕️ Save Mod** (`saveMod`): Save refs to personal lists.
35. **🙈️ Hide Mod** (`hideMod`): Hide unwanted content.
36. **☑️ Read Mod** (`readMod`): Mark content as read across sessions.
37. **↪️ Repost Mod** (`repostMod`): Re-submit URLs with fresh comment sections.
38. **🗑️ Delete Mod** (`deleteMod`): Soft delete with recycle bin functionality.
39. **✨️ AI Mod** (`aiMod`): Core AI query functionality for sending refs to AI.
40. **👨️‍🎨️ DALL-E Mod** (`dalleMod`): AI image generation integration.
41. **✂️ Summary Mod** (`summaryMod`): Automatic content summarization.
42. **🌐 Translate Mod** (`translateMod`): Multi-language translation.
43. **🧭 Navi Mod** (`naviMod`): AI navigation and content discovery.
44. **➰️ Script Mod** (`scriptMod`): Server-side script execution and scheduling.
45. **🗞️ Feed Mod** (`feedMod`): RSS and Atom feed processing.
46. **🪝 Scrape Mod** (`scrapeMod`): Web scraping with CSS selectors.
47. **💾 Cache Mod** (`cacheMod`): Intelligent caching for performance.
48. **📎 File Mod** (`fileMod`): File upload and management.
49. **📧️ Email Mod** (`emailMod`): Email processing and integration.
50. **📟️ System Mod** (`systemMod`): System information and administrative functions.
51. **🎁️ Mod Mod** (`modMod`): Dynamic mod installation and management.
52. **🔑️ Secret Mod** (`secretMod`): Secure storage with opaque tags.
53. **⚠️ GDPR Mod** (`gdprMod`): Privacy controls and cookie consent.
54. **🌍 Remote Origin Mod** (`remoteOriginMod`): Multi-server federation.
55. **🐛 Debug Mod** (`debugMod`): Development and troubleshooting tools.
56. **❌ Error Mod** (`errorMod`): Error handling and reporting.
57. **🎨 Theme Mod** (`themesMod`): Dynamic theming and customization.
58. **🖥️ Fullscreen Mod** (`fullscreenMod`): Distraction-free viewing mode.
59. **🪟 PiP Mod** (`pipMod`): Picture-in-picture floating windows.
60. **📱 Seamless Mod** (`seamlessMod`): Enhanced mobile and tablet experience.
61. **🔍 Lens Mod** (`lensMod`): Custom viewing modes and lenses.
62. **♟️ Chess Mod** (`chessMod`): Chess game implementation.
63. **🎲 Backgammon Mod** (`backgammonMod`): Backgammon game implementation.
64. **🎵 Playlist Mod** (`playlistMod`): Audio/video playlist organization.
65. **👤 Person Mod** (`personMod`): Contact and identity management.
66. **📄 Snippet Mod** (`snippetMod`): Code snippet management.
67. **🔬 Experiments Mod** (`experimentsMod`): Experimental features and testing.
68. **🚫 Banlist Mod** (`banlistMod`): Content filtering and blocking.
69. **🔺 Ninja Triangle Mod** (`ninjaTriangleMod`): Specialized triangle game implementation.

## Advanced Features & Experimental Mods
Several mods are marked as experimental or provide advanced functionality:

1. **Analytics:** Engagement tracking for links clicked, Refs expanded, actions taken, and search queries.
2. **Geo/GeoPackage:** Map embeds for displaying GeoJSON and GeoPackage geographic data.
3. **Chart:** Graph rendering from tabular data with customizable chart types and labels.
4. **Invoice System:** Invoice creation and management, integrates with QR codes and work queues.
5. **Delta Scripts:** Server-side transformations to process Refs through custom scripts.
6. **File Management:** Advanced file upload, processing, and organization capabilities.
7. **Person Templates:** Contact and identity management for individuals.
8. **Lens System:** Custom viewing modes beyond kanban and chat.
9. **Seamless Mode:** Enhanced UX for mobile and tablet experiences.

Note: Some experimental features may require additional server-side configuration or may have limited functionality in certain deployments.

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
