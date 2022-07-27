# JasperUi
Reference client for Jasper KMS.

[![Build & Test](https://github.com/cjmalloy/jasper-ui/actions/workflows/docker-image.yml/badge.svg)](https://github.com/cjmalloy/jasper-ui/actions/workflows/docker-image.yml)

JasperUI is the reference client for the
[Jasper Knowledge Management System](https://github.com/cjmalloy/jasper)

## Quickstart
To start the server, client and database with a single admin user, run
the [quickstart](https://github.com/cjmalloy/jasper-ui/blob/master/quickstart/docker-compose.yaml)
docker compose file.

## Features

### Text Editor
Markdown editor with support for rendering both markdown and HTML.
* Use `#tag` to create a tag link `[tag](/tag/politics)` (add a space for the usual markdown
H1 "# Title")
* Use `^[1]` to reference sources. Use `^[1](url)` to add source.
* Use `^[alt1]` to reference alternate URLs. Use `^[alt1](url)` to add an alternate URL.
* Using `#+user/charlie` with the inbox plugin installed will add `plugin/inbox/user/charlie`
to the tags. Will remove `#+user/` prefix when displaying.
### Tag Query Page
* Perform any tag query while performing a full text search and multi-column sort
* Displays title from tag Ext if present
* Displays sidebar markdown from tag Ext if present
* Displays pinned Refs from tag Ext if present
* Adds Modmail button that sends a DM to `plugin/inbox/tag`
### Home Page
* Query all tags in users Ext subscriptions
### Templates
1. Default template: (matches all tags):
   1. **Pinned links:** Display these links at the top of this tag's page.
   2. **Sidebar:** (optional) Custom markdown content for the sidebar. LaTeX and emojis are
   supported if plugins are installed.
   3. **Themes:** (optional) Set a custom theme for a tag page. Will remain active until a
   different tag page is visited.
2. User: (matches `user/`) Store user generated data:
   1. Inbox: last notified time (for use with the inbox plugin)
   2. Subscriptions: List of tags to show on your home page
   3. Themes: (optional) Override the theme for the entire site. Will cause custom tag themes
   to be ignored.
3. Queue: (matches `queue/`) Work Queue for assigning or tracking work and paying workers. Requires
the invoice plugin to pay workers. Adds data:
   1. Approvers: list of user tags to send invoices to
   2. Bounty: (optional) payment for responses to items in the queue.
   3. Max Age: (optional) max age Refs in the queue to be considered active. Refs in the queue
   older than this will have an expired icon when viewed from the queue tag page.
### Plugins
1. **Inbox:** Enables notifications when installed. You receive a notification when someone posts a
response to yours. Activates the envelope icon button in the settings area of the client.
Requires the inbox field in the user template. When posting a response the client will add (for
example with `+user/charlie`) `plugin/inbox/user/charlie` to the tags. This will cause it to show up
in `+user/charlie`'s notifications. Users also receive notifications for all tags they have write
access to (tag modmail). This tag is also the convention by which you may address a Ref "To:"
another user. Does not add data to a Ref. Does not generate metadata.
2. **Comment:** Enables comments and comment threads when installed. Allows sorting Refs by number
of comments. Comments are created with `plugin/comment` and `internal` tags. (the `internal` tag
prevents the comment from showing up on `@*`). Adds a deleted field to the ref to mark the
comment as deleted. This is used to prevent breaking a comment thread by actually removing a
node when a comment is deleted. Generates count metadata in parent.
3. **Thumbnail:** Enables the Ref thumbnail when installed. When a Ref is tagged `plugin/thumbnail`,
the Ref has an image that can be used as a thumbnail. Adds optional url, width, height, and time
fields to the Ref. If the url field is not specified, the url of the Ref will be the image
thumbnail. Does not generate metadata.
4. **Latex:** Enables KaTeX processing on the Ref comment markdown. Does not add data to a Ref.
Does not generate metadata. KaTeX support for sidebar content is always enabled if this plugin
is installed.
5. **Emoji:** Enables emoji support in the Ref comment markdown. Does not add data to a Ref. Does
not generate metadata. Emoji support for sidebar content is always enabled if this plugin is
installed.
6. **Graph:** Enable the knowledge graph tab in the client UI when this is installed. Adds data
to refs to override how they are graphed.
7. **Invoice:** Enables invoice support in the client when installed. When invoices are created they
will be tagged `plugin/invoice`. When the inbox plugin is installed there is a tab on the inbox
page to show invoices addressed to you. Requires the QR plugin to send QR invoices. If the Work
Queue template is installed, any invoices can include a Work Queue to address the invoice to all
work queue approvers. Does not add data to a Ref. Generates count metadata in any sourced Refs.
8. **Invoice/Rejected:** Used by the invoice plugin to mark responses to an invoice. Does not add
data to a Ref. Generates count metadata in any sourced Refs.
9. **Invoice/Disputed:** Used by the invoice plugin to mark responses to an invoice. Does not add
data to a Ref. Generates count metadata in any sourced Refs.
10. **Invoice/Paid:** Used by the invoice plugin to mark responses to an invoice. Does not add data
to a Ref. Generates count metadata in any sourced Refs.
11. **QR:** Enables the QR embed when installed. When the `plugin/qr` is applied to a Ref, the Ref has
a URL to be converted into a QR code. The QR code is shown when the embed toggle is pressed. Adds
optional URL field to the Ref to use for the QR code, if this is unspecified the URL of the Ref
will be used. Does not generate metadata.
12. **Embed:** Enables the iframe embed when installed. When the plugin/embed is applied to a Ref,
the Ref has a URL that can be used in an iframe. The iframe is shown when the embed toggle is
pressed. Adds optional URL field to the Ref to use for the iframe, if this is unspecified the
URL of the Ref will be used. Does not generate metadata. Currently implemented for:
    1. YouTube
    2. Twitter
    3. BitChute
13. **Audio:** Enables the audio embed when installed. When the `plugin/audio` is applied to a Ref,
the Ref has a URL that points to an audio file. The audio player is shown when the embed toggle
is pressed. Adds optional URL field to the Ref to use for the audio file, if this is unspecified
the URL of the Ref will be used. Does not generate metadata. This plugin will be suggested when
you submit a link ending in an audio file extension.
14. **Video:** Enables the video embed when installed. When the `plugin/video` is applied to a Ref,
the Ref has a URL that points to a video file. The video player is shown when the embed toggle
is pressed. Adds optional URL field to the Ref to use for the video file, if this is unspecified
the URL of the Ref will be used. Does not generate metadata. This plugin will be suggested when
you submit a link ending in a video file extension.
15. **Image:** Enables the image embed when installed. When the `plugin/image` is applied to a Ref,
the Ref has a URL that points to an image file. The image is shown when the embed toggle is
pressed. Adds optional URL field to the Ref to use for the image file, if this is unspecified
the URL of the Ref will be used. Does not generate metadata. This plugin will be suggested when
you submit a link ending in an image file extension.
16. **Wiki:** Enables adding Wiki Refs when installed. When creating a wiki the URL will be
`wiki://Page_name`. You can link to a Wiki page using the double `[[bracket syntax]]` in all
markdown fields. Does not add data to the Ref. Does not generate metadata.

## Coming Soon
### Templates
1. **Delta:** (matches `delta/`) Apply a server side script to transform this Ref into a new Ref.
Adds data to the tag Ext to contain the code or service reference and config.
### Plugins
1. **Table:** Enabled the table embed when installed. When the `plugin/table` is applied to a Ref,
the Ref contains tabular data. The tabular data is shown when the embed toggle is pressed. Adds
an optional field to the Ref to use for the tabular data, if this is unspecified the URL of the
Ref will be used to point to a TSV file. Does not generate metadata.
2. **Chart:** Enabled the graph embed when installed. When the `plugin/chart` is applied to a Ref, the
Ref contains tabular data. The tabular data rendered in a graph is shown when the embed toggle is
pressed. Adds fields to the ref for defining the chart type, labels, and location of the data in
the table. Adds an optional field to the Ref to use for the tabular data, if this is unspecified
the URL of the Ref will be used to point to a TSV file. Does not generate metadata.
3. **Voting:** Enables voting and sorting by vote when installed. Requires additions to the user
template to hold votes. This adds two new sort fields to the UI: Top and Hot. Top sorts by vote
total, and Hot applies an exponential time decay when sorting. If the inbox plugin is enabled
there is a tab on the index page to view the refs you voted on. Can be configured to allow
positive or both positive and negative votes. Voting on a Ref adds it to a list in your user
extension. Does not add data to a Ref. Does not generate metadata.
4. **Analytics:** Enables engagement tracking when installed. Reports links clicked, Refs expanded,
Ref action taken, Refs viewed, and queries searched. Adds data to the Ref to override analytic
tracking for that ref. Does not generate metadata.
5. **Poll:** Enables polls in the embeds when installed. When a Ref is tagged `plugin/poll` data is
added to specify the options and their description text. Voting is done by adding a Ref response
tagged with `plugin/poll/response/tag` and the response field, with tag being the response to the
poll. The `poll/response` plugin will generate metadata, but the poll plugin will not.
6. **Geo:** Enables a map in the embeds that displays GeoJson when installed. When a Ref is tagged
`plugin/geo`, the Ref includes some GeoJson. The map is shown when the embed toggle is pressed.
Adds an optional field to the Ref to use for the GeoJson, if this is unspecified the URL of the
Ref will be used to point to a GeoJson file. Does not generate metadata.
7. **GeoPackage:** Enables a map in the embeds that displays GeoPackage when installed. When a
Ref is tagged `plugin/geopackage`, the Ref includes some GeoPackage. The map is shown when the
embed toggle is pressed. Adds an optional field to the Ref to use for the GeoPackage, if this
is unspecified the URL of the Ref will be used to point to a GeoPackage file. Does not generate
metadata.

## Developing
This project was generated with [Angular CLI](https://github.com/angular/angular-cli) version 13.3.0.

### Development server

Run `ng serve` for a dev server. Navigate to `http://localhost:4200/`. The application will automatically reload if you change any of the source files.

### Code scaffolding

Run `ng generate component component-name` to generate a new component. You can also use `ng generate directive|pipe|service|class|guard|interface|enum|module`.

### Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory.

### Running unit tests

Run `ng test` to execute the unit tests via [Karma](https://karma-runner.github.io).

### Running end-to-end tests

Run `ng e2e` to execute the end-to-end tests via a platform of your choice. To use this command, you need to first add a package that implements end-to-end testing capabilities.

### Further help

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI Overview and Command Reference](https://angular.io/cli) page.
