import { $localize } from '@angular/localize/init';
import { DateTime } from 'luxon';
import { Plugin } from '../model/plugin';
import { Ref } from '../model/ref';
import { Mod } from '../model/tag';

export const scrapePlugin: Plugin = {
  tag: '+plugin/scrape',
  name: $localize`🪝 Scrape`,
  config: {
    mod: $localize`🪝 Scrape`,
    default: true,
    generated: $localize`Generated by jasper-ui ${DateTime.now().toISO()}`,
    settings: $localize`scrape`,
    submit: $localize`🪝 scrape`,
    genId: true,
    internal: true,
    icons: [{ label: $localize`🪝`, order: 3 }],
    editorButtons: [
      { label: $localize`🪝`, title: $localize`Scrape Webpage`, event: 'scrape', scheme: 'http:', global: true },
      { label: $localize`🪝`, title: $localize`Scrape Webpage`, event: 'scrape', scheme: 'https:', global: true },
    ],
    description: $localize`Configure CSS classes for scraping websites.`,
    hasDefaults: true,
    defaultsConfirm: $localize`Warning!
 This will load in the default scrape config to be used when a site-specific config cannot be found.
 If you have customized the default scrape config your changes will be overwritten.`,
    form: [{
      key: 'schemes',
      type: 'urls',
      props: {
        label: $localize`Schemes: `,
        addText: $localize`+ Add scheme`,
      },
      fieldArray: {
        props: {
          label: $localize`🔗️*`,
        }
      },
    }, {
      key: 'removeSelectors',
      type: 'list',
      props: {
        label: $localize`Remove Selectors: `,
        addText: $localize`+ Add remove selector`,
      },
      fieldArray: {
        type: 'string',
        props: {
          label: $localize`🎯️`,
        }
      },
    }, {
      key: 'oembedJson',
      type: 'boolean',
      props: {
        label: $localize`oEmbed: `,
      },
    }, {
      key: 'ldJson',
      type: 'boolean',
      props: {
        label: $localize`Linked Data: `,
      },
    }, {
      key: 'openGraph',
      type: 'boolean',
      props: {
        label: $localize`Open Graph: `,
      },
    }, {
      key: 'text',
      type: 'boolean',
      props: {
        label: $localize`Text: `,
      },
    }, {
      key: 'textSelectors',
      type: 'list',
      expressions: { hide: '!formState.config.text' },
      props: {
        label: $localize`Text Selectors: `,
        addText: $localize`+ Add text selector`,
      },
      fieldArray: {
        type: 'string',
        props: {
          label: $localize`🎯️`,
        }
      },
    }, {
      key: 'publishedSelectors',
      type: 'list',
      props: {
        label: $localize`Published Selectors: `,
        addText: $localize`+ Add published selector`,
      },
      fieldArray: {
        type: 'string',
        props: {
          label: $localize`🎯️`,
        }
      },
    }, {
      key: 'imageSelectors',
      type: 'list',
      props: {
        label: $localize`Image Selectors: `,
        addText: $localize`+ Add image selector`,
      },
      fieldArray: {
        type: 'string',
        props: {
          label: $localize`🎯️`,
        }
      },
    }, {
      key: 'videoSelectors',
      type: 'list',
      props: {
        label: $localize`Video Selectors: `,
        addText: $localize`+ Add video selector`,
      },
      fieldArray: {
        type: 'string',
        props: {
          label: $localize`🎯️`,
        }
      },
    }, {
      key: 'audioSelectors',
      type: 'list',
      props: {
        label: $localize`Audio Selectors: `,
        addText: $localize`+ Add audio selector`,
      },
      fieldArray: {
        type: 'string',
        props: {
          label: $localize`🎯️`,
        }
      },
    }, {
      key: 'thumbnailSelectors',
      type: 'list',
      props: {
        label: $localize`Thumbnail Selectors: `,
        addText: $localize`+ Add thumbnail selector`,
      },
      fieldArray: {
        type: 'string',
        props: {
          label: $localize`🎯️`,
        }
      },
    }],
    advancedForm: [{
      key: 'removeAfterSelectors',
      type: 'list',
      props: {
        label: $localize`Remove Inside Text Selectors: `,
        addText: $localize`+ Add after selector`,
      },
      fieldArray: {
        type: 'string',
        props: {
          label: $localize`🎯️`,
        }
      },
    }, {
      key: 'removeStyleSelectors',
      type: 'list',
      props: {
        label: $localize`Remove Style Selectors: `,
        addText: $localize`+ Add remove style selector`,
      },
      fieldArray: {
        type: 'string',
        props: {
          label: $localize`🎯️`,
        }
      },
    }, {
      key: 'imageFixRegex',
      type: 'list',
      props: {
        label: $localize`Image Fix RegEx: `,
        addText: $localize`+ Add regex`,
        title: $localize`Will delete any matches from image URLs`,
      },
      fieldArray: {
        type: 'string',
        props: {
          label: $localize`🎯️`,
        }
      },
    }],
  },
  defaults: {
    text: true,
    oembedJson: true,
    ldJson: true,
    openGraph: true,
  },
  schema: {
    optionalProperties: {
      schemes: { elements: { type: 'string' } },
      text: { type: 'boolean' },
      oembedJson: { type: 'boolean' },
      ldJson: { type: 'boolean' },
      openGraph: { type: 'boolean' },
      removeSelectors: { elements: { type: 'string' } },
      textSelectors: { elements: { type: 'string' } },
      removeAfterSelectors: { elements: { type: 'string' } },
      publishedSelectors: { elements: { type: 'string' } },
      removeStyleSelectors: { elements: { type: 'string' } },
      imageFixRegex: { elements: { type: 'string' } },
      imageSelectors: { elements: { type: 'string' } },
      videoSelectors: { elements: { type: 'string' } },
      audioSelectors: { elements: { type: 'string' } },
      thumbnailSelectors: { elements: { type: 'string' } },
    },
  }
};

export const catchAll: Ref = {
  url: 'config:scrape-catchall',
  title: $localize`Default Web Scrape Config`,
  tags: ['public', 'internal', '+plugin/scrape'],
  plugins: {
    '+plugin/scrape': {
      text: true,
      oembedJson: true,
      ldJson: true,
      openGraph: true,
      textSelectors: [
        'span[itemprop=articleBody]',
        'section.content__body',
        '.article-body__content',
        '.article__content',
        '.article__content-body',
        '.article-body',
        '.details>.details-body',
        '.f_blog_body',
        '.caas-body',
        'article .crawler',
        '.fl-module-fl-post-content',
        '.body.markup',
        'main.ff-main-content section',
        '.single-feature-content',
        '.single-content-wrapper',
        '.body__inner-container',
        '.showblog-body__content',
        '.article__body-text',
        '.article__content-container',
        '.c-article-content',
        '#drr-container',
        '.meteredContent',
        '.gnt_ar_b',
        '.views-article-body',
        '.elementor-widget-theme-post-content',
        '.l-article__text',
        '.article__text',
        '.sdc-article-body--story',
        '.wprm-recipe-container',
        '.tasty-recipes',
        '.storytext',
        '.rich-text',
        '.entry-content',
        '.entry-summary',
        '.entrytext',
        '.articleBody',
        '.mv-create-wrapper',
        '.content-body',
        '.post_page-content',
        '.post-body',
        '.td-post-content',
        '.post_content',
        '.storycontent',
        '.tam__single-content-output',
        '.js_post-content',
        '.js_starterpost',
        '.sqs-layout',
        '.c-text',
        '.pmc-paywall',
        '.postcontent',
        '.post-content',
        'article.article-body-wrapper-custom',
        'main#main .container-md dl',
        'main .item-details-inner',
        '#comic',
        '#liveblog-body',
        '#content-blocks',
        '#article-body-content',
        '#article',
        '#article-body',
        '#main',
        '#body',
        '#mainbar',
        '#maincontent',
        '#bodyContent',
        '#content',
        '#item-content-data',
        '.wysiwyg--all-content',
        '.hide-mentions',
        'div.article',
        'div.content',
        'div[class^=article-body__content]',
        'div[class^=article-body__container]',
        'section[class^=ArticleBody_root]',
        'div[class^=NodeContent_body]',
        'div[class^=c-article-body]',
        'div[class^=ArticlePageChunksContent]',
        'div[class^=DraftjsBlocks_draftjs]',
        'div[class^=index-module_storyContainer]',
        '.story',
        '.post-content',
        '.blog-content',
        '.article-body',
        '.article-content',
        'main.main',
        '.page-content',
        '.post',
        '.grid-body',
        '.body',
        '.body-text',
        'article',
        'main',
        'section',
      ],
      removeSelectors: [
        'nav',
        'header',
        'footer',
        'aside',
        'noscript',
        '.comment-link',
        '.date-info .updated',
        '.ad-container',
        '.ad-unit',
        '.advert-wrapper',
        '.af-slim-promo',
        '.wsj-ad',
        '.c-ad',
        '.adLabelWrapperManual',
        '.ad',
        'gu-island',
        'div[class^=z-ad]',
        'div[class^=ad_]',
        '.liveBlogCards',
        '.speaker-mute',
        '.heateor_sss_sharing_container',
        '.brands-most-popular',
        '.z-trending-headline',
        '.article__gallery-count',
        '.rail-component',
        '.read-more-container',
        '#site_atribution',
        '#site_attribution',
        '.article-extras',
        '#firefly-poll-container',
        '.subscriber-only.encrypted-content',
        '.support-us2',
        '.thm-piano-promo',
        '.article-content-cta-group',
        '.nlp-ignore-block',
        '.block-ibtg-article',
        '.quickview__meta',
        '.stat__item--recipe-box',
        '.stat__item--print',
        '.internallink',
        '.credit-caption',
        '.js-is-sticky-social--bottom',
        '.js-kaf-share-widget',
        '.wprm-call-to-action',
        '.cwp-food-buttons',
        '.tasty-recipes-buttons',
        '.recipe-bakers-hotline',
        '#block-kafrecommendedrecipes',
        '#news_letter_div',
        '#firefly-poll-container',
        '#in-article-trending',
        '#in-article-related',
        '#inline-article-recommend',
        '.inline-article',
        '.inline-collection',
        '.hidden-print',
        '[data-block=doNotPrint]',
        '.apester-media',
        '.ff-fancy-header-container',
        '.entry-submit-correction',
        '.correction-form',
        '.ff-truth-accuracy-text',
        '.author-info',
        '.type-commenting',
        '.sponsor',
        '.region-content-footer',
        '.hide-for-print',
        '.button-wrapper',
        '.subscription-widget-wrap',
        '.sam-pro-place',
        '.subscribe-widget',
        '#trinity-audio-table',
        '.trinity-skip-it',
        '.big-top',
        '#tncms-region-article_instory_top',
        '.novashare-ctt',
        '.w-primis-article',
        '.article-btm-content',
        '.gb-container',
        '.pp-multiple-authors-wrapper',
        '.social-tools',
        '.subscriber-offers',
        '.meks_ess',
        '.pop-up-bar',
        '.fancy-box',
        '.c-figure__expand',
        '.van-image-figure',
        '.abh_box',
        '.linkstack',
        '.code-block',
        '.article-sharing',
        '.heateor_sssp_sharing_container',
        '.related',
        '.noprint',
        '.printfooter',
        '.mw-editsection',
        '.catlinks',
        '.video-top-container',
        '.newsletter-component',
        '.thehill-promo-link',
        '.page-actions',
        '.post-tags',
        '.share-container',
        '.lsn-petitions',
        '.donate-callout',
        '.enhancement',
        '.div-related-embed',
        '.article-related-inline',
        '.author-endnote-container',
        '.newsletter-form-wrapper',
        '.related_topics',
        '.jp-relatedposts',
        '.post-tools-wrapper',
        '.js_alerts_modal',
        '.js_comments-iframe',
        '.share-label-text',
        '.share-toolbar-container',
        '.social-share-links',
        '.article-trust-bar',
        '.l-inlineStories',
        '.c-conversation-title',
        '.c-pullquote',
        '.c-signin',
        '.c-disclaimer',
        '.overlay',
        '.control',
        '.inline-video',
        'div[data-component=video-block]',
        '.instream-native-video',
        '.embed-frame',
        '.video-schema',
        '.meta.player',
        '.ml-subscribe-form',
        '.dfm-trust-indicators-footer-links',
        'section .related_posts',
        '.wp-block-algori-social-share-buttons-block-algori-social-share-buttons',
        '.related_title',
        '.tags .my_tag',
        '.relatedbox',
        '.blog-subscribe',
        '.ns-share-count',
        '.sharedaddy',
        '.scope-web\\|mobileapps',
        '[class*=SnippetSubheadline]',
        '[class*=SnippetSignInText]',
        'a[href^=https://subscribe.wsj.com/wsjsnippet]',
        'a[href^=https://www.foxnews.com/apps-products]',
        'a[href^=https://www.ctvnews.ca/newsletters]',
        'a[href^=https://www.ctvnews.ca/app]',
        'ul[class^=context-widget__tabs]',
        'div[class^=index-module_shareColumn]',
        'div[class^=index-module_overlayWrapper]',
        'div[class^=UserWayButton]',
        'div[class^=article-body__desktop-only]',
        'div[class^=article-body__top-toolbar-container]',
        'div[class^=frontend-components-DigestPostEmbed]',
        'div[class^=article-toolbar]',
        'div[class^=RelatedStories_relatedStories]',
        'div[class^=ArticleWeb_shareBottom]',
        'div[class^=RelatedTopics_relatedTopics]',
        'div[class^=ArticleWeb_publishedDate]',
        'p[class^=ArticleRelatedContentLink_root]',
        'img[style^=width:1px;height:1px]',
        'img[style^=position:absolute;width:1px;height:1px]',
        'div:empty',
        'span:empty',
        'li:empty',
        'ul:empty',
        'ol:empty',

        // TODO: add image gallery plugin
        '.article-slideshow',
      ],
      removeAfterSelectors: [
        '.elementor-location-single'
      ],
      removeStyleSelectors: [
        '.subscriber-only'
      ],
      imageFixRegex: [
        '\\?w=\\d+&h=\\d+(&crop=\\d+)?',
      ],
      imageSelectors: [
        '#item-image #bigimage img',
        '.detail-item-img img',
        '#pvImageInner noscript a',
      ],
      videoSelectors: [
        'video[src]',
        'video source',
        'div.video[data-stream]',
      ],
      audioSelectors: [
        'audio[src]',
        'audio source',
      ],
      thumbnailSelectors: [
        'figure.entry-thumbnail img',
        '.live-blog-above-main-content svg',
        'figure.embed link[as=image][rel=preload]',
        'img.video__fallback',
        'amp-img',
      ],
    }
  }
};

export const asyncScrapePlugin: Plugin = {
  tag: '_plugin/delta/scrape',
  name: $localize`🪝 Async Scrape`,
  config: {
    mod: $localize`🪝 Scrape`,
    generated: $localize`Generated by jasper-ui ${DateTime.now().toISO()}`,
    actions: [
      { tag: '_plugin/delta/scrape', labelOn: $localize`cancel`, title: $localize`Cancel updating this Ref.` },
    ],
    advancedActions: [
      { tag: '_plugin/delta/scrape/ref', scheme: 'http:', labelOff: $localize`scrape`, title: $localize`Update this Ref with the scraped resource`, confirm: $localize`Are you sure you want to scrape?`, global: true },
      { tag: '_plugin/delta/scrape/ref', scheme: 'https:', labelOff: $localize`scrape`, title: $localize`Update this Ref with the scraped resource`, confirm: $localize`Are you sure you want to scrape?`, global: true },
    ],
  },
};

export const scrapeMod: Mod = {
  plugins: {
    scrapePlugin,
    asyncScrapePlugin,
  },
};
