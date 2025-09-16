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
Jasper-UI includes a comprehensive set of mods that extend functionality. Mods are organized into several categories:

#### Core Framework Templates
1. **Root Template** (⚓️): Provides foundational features for all tag pages including pinned links, custom sidebar markdown, custom themes, and basic filters for schemes and privacy.
2. **User Template** (🧑️): Manages user data including subscriptions, bookmarks, alarms, inbox settings, and personal preferences.
3. **Home Page** (🏡️): Enables a customizable home page where users can subscribe to tags and queries.
4. **Internal Template** (⚙️): Handles internal refs that should be hidden by default.

#### Communication & Collaboration
5. **Mailbox/Inbox System** (📮️): Comprehensive messaging system with inbox (`plugin/inbox`) and outbox (`plugin/outbox`) plugins plus DM template for private direct messages.
6. **Comment System** (💬️): Enables threaded comments with `plugin/comment` and `internal` tags for rich discussion.
7. **Threads** (🧵️): Advanced threaded discussion system with `plugin/thread` for organizing conversations.
8. **Chat** (🗨️): Real-time chat rooms with live messaging capabilities.
9. **Moderation Tools** (🛡️): Comprehensive moderation system with reporting (`plugin/user/report`), approval (`plugin/user/approve`), and moderated tag (`_moderated`) for content management.
10. **Thanks Template** (🙂️): Quick thanks responses to posts.

#### Media & Content
11. **Image** (🖼️): Display and embed images with support for PNG, JPG, GIF, SVG, WebP formats.
12. **Video** (🎞️): Video player with support for MP4, WebM, OGV, M3U8 and other formats.
13. **Audio** (📻️): Audio player supporting MP3, AAC, FLAC, OGG, WAV formats.
14. **PDF** (📄️): PDF viewer and processor with action buttons.
15. **Thumbnail** (⭕️): Thumbnail generation and display for refs.
16. **Embed** (🔭️): IFrame embedding for external content with configurable dimensions.
17. **QR Code** (🔲): Generate and scan QR codes from URLs.

#### Content Creation & Editing
18. **Wiki System** (📔️): Full wiki functionality with `wiki:` scheme and `[[bracket syntax]]` for linking.
19. **Code Editor** (🗒️): Monaco editor (VS Code-like) for syntax-highlighted code editing.
20. **HTML Editor** (📐️): Rich HTML editing capabilities.
21. **LaTeX** (💲️): KaTeX processing for mathematical notation in markdown.
22. **Table** (📏️): Spreadsheet functionality with CSV data support.
23. **Editor Extensions**: Various editing tools and formatters.

#### Organization & Workflow
24. **Kanban Boards** (📋️): Full kanban board implementation with customizable columns, swim lanes, and badges.
25. **Graph View** (🎇️): Knowledge graph visualization for exploring connections.
26. **Work Queues** (🚧️): Task management with bounties and workflow automation.
27. **Folder System** (📁): Hierarchical organization of content.
28. **Archive** (📦): Content archiving and organization.

#### User Experience & Interaction
29. **Voting System** (⬆️): Upvote/downvote functionality with Top and Hot sorting algorithms.
30. **Polls** (🗳️): Create multiple-choice polls with voting and results visualization.
31. **Save/Hide/Read** (⭕️/🙈️/☑️): Personal content management - save refs to lists, hide unwanted content, mark as read.
32. **Repost** (↪️): Re-submit URLs with fresh comment sections.
33. **Delete System** (🗑️): Soft delete with recycle bin functionality.

#### AI & Automation
34. **AI Generation** (✨️): Comprehensive AI integration including:
    - AI Query (`plugin/delta/ai`): Send refs to AI for responses
    - DALL-E Integration: AI image generation
    - Summary Generation: Automatic content summarization  
    - Translation: Multi-language translation
    - AI Navigation: Smart content discovery
35. **Scripting** (➰️): Server-side script execution with scheduling (`+plugin/cron`, `+plugin/user/run`).

#### Data & Integration
36. **RSS/Feed Reader** (🗞️): RSS and Atom feed processing and display.
37. **Web Scraping** (🪝): Configurable web scraping with CSS selectors.
38. **oEmbed** (📡️): Rich embed support for various platforms.
39. **Cache System** (💾): Intelligent caching for performance.

#### System & Administration  
40. **System Tools** (📟️): System information, statistics, and administrative functions.
41. **Mod Management** (🎁️): Install and manage mods dynamically.
42. **Secret Management** (🔑️): Secure storage of sensitive data with opaque tags.
43. **GDPR Compliance** (⚠️): Privacy controls and cookie consent.
44. **Origin Management**: Multi-server federation and origin handling.
45. **Debug Tools**: Development and troubleshooting utilities.

#### Specialized Applications
46. **Games**: Chess (♟️) and Backgammon implementations.
47. **Playlist Management** (🎵): Audio/video playlist organization.
48. **Notes System** (📝): Advanced note-taking with organization.
49. **Blog Template** (📰): Blog-style content presentation.
50. **Email Integration** (📧): Email processing and handling.
51. **Fullscreen Mode**: Distraction-free viewing.
52. **Picture-in-Picture** (📺): Floating video/media windows.
53. **Theme System** (🎨): Dynamic theming and customization.

Many of these mods work together synergistically. For example, the AI system can work with images, PDFs, and code, while the kanban system integrates with user management and notification systems.

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
