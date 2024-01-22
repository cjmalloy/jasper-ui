import * as moment from 'moment';
import { Plugin } from '../model/plugin';
import { Template } from '../model/template';

export const dalleQueryPlugin: Plugin = {
  tag: 'plugin/inbox/ai/dalle',
  name: $localize`👨️‍🎨️💭️ Ask DALL·E`,
  config: {
    mod: $localize`👨️‍🎨️ DALL·E Chat`,
    type: 'tool',
    default: false,
    add: true,
    submit: '👨️‍🎨️💭️',
    submitText: true,
    signature: '+plugin/ai/dalle',
    generated: $localize`Generated by jasper-ui ${moment().toISOString()}`,
    description: $localize`Send this Ref to DALL-E for response.`,
    aiInstructions: `# plugin/inbox/ai/dalle
    The DALL-E AI responds to the tag plugin/inbox/ai/dalle.
    If you are requested to draw an image or generate a DALL-E prompt, always assume you are to forward your message to DALL-E by including this tag.
    DALL-E prompt must be length 1000 or less. If you generate too many characters (title if present + ': ') plus length of comment, the image will not generate.
    Messages signed by DALL-E will have the tag +plugin/ai/dalle.
    Tagging a post plugin/inbox/ai/dalle will send that post title and comment to the DALL-E API as a prompt.
    DALL-E will return a single image per invocation. To generate multiple images, create multiple Refs.
    For example, in response to:
    {
      "url": "comment:ai-1",
      "comment": "Draw 16 pictures of lakes and mountains and tag them #public #nature. Then create a 4x4 tiled embed.",
      "tags": ["public", "+user/chris", "plugin/inbox/ai/openai"]
    }

    You could respond:
    {
      "ref": [{
        "sources": ["comment:ai-1"],
        "comment":"I have forwarded the request to create 16 pictures of lakes and mountains to DALL-E. They will be tagged #public #nature. Additionally, once created, you can view them in a 4x4 tiled embed using the following lens: ![Nature Scenes](/tag/plugin/image:nature?cols=4).",
        "tags": ["public", "plugin/inbox/user/chris", "+plugin/ai/openai"]
      }, {
        "comment": "A winter scene of a frozen mountain lake with a lone wolf traversing the icy landscape in the quiet snowfall",
        "tags": ["public", "nature", "plugin/inbox/ai/dalle", "+plugin/ai/openai"]
      }, {
        "comment": "A vibrant rainbow arching over a mountain lake with cascading waterfalls in the lush green valley",
        "tags": ["public", "nature", "plugin/inbox/ai/dalle", "+plugin/ai/openai"]
      }, {
        "comment": "An old wooden cabin on the shore of a mountain lake, with trees displaying colorful fall foliage",
        "tags": ["public", "nature", "plugin/inbox/ai/dalle", "+plugin/ai/openai"]
      }, {
        "comment": "A cozy campfire by a remote mountain lake, with the Milky Way stretching across the night sky above",
        "tags": ["public", "nature", "plugin/inbox/ai/dalle", "+plugin/ai/openai"]
      }, {
        "comment": "A mountain biker pausing to overlook a vast lake with towering peaks in the distance at sunset",
        "tags": ["public", "nature", "plugin/inbox/ai/dalle", "+plugin/ai/openai"]
      }, {
        "comment": "A pristine mountain lake with crystal-clear waters revealing the rocky depths below, framed by a lush green forest",
        "tags": ["public", "nature", "plugin/inbox/ai/dalle", "+plugin/ai/openai"]
      }, {
        "comment": "Fireflies illuminating the evening sky over a calm mountain lake as twilight settles in",
        "tags": ["public", "nature", "plugin/inbox/ai/dalle", "+plugin/ai/openai"]
      }, {
        "comment": "A high-altitude lake offering a panoramic view of the expansive mountain range and a clear blue sky",
        "tags": ["public", "nature", "plugin/inbox/ai/dalle", "+plugin/ai/openai"]
      }, {
        "comment": "A misty morning on a mountain lake with a wooden pier extending into the water, surrounded by autumn foliage",
        "tags": ["public", "nature", "plugin/inbox/ai/dalle", "+plugin/ai/openai"]
      }, {
        "comment": "A lone kayaker on a tranquil mountain lake, paddling gently as the sun rises over the distant peaks",
        "tags": ["public", "nature", "plugin/inbox/ai/dalle", "+plugin/ai/openai"]
      }, {
        "comment": "A secluded mountain lake with wild horses grazing peacefully by the water's edge at dusk",
        "tags": ["public", "nature", "plugin/inbox/ai/dalle", "+plugin/ai/openai"]
      }, {
        "comment": "Mirror-like mountain lake reflecting the moody, cloudy sky and the dense, forested slopes surrounding it",
        "tags": ["public", "nature", "plugin/inbox/ai/dalle", "+plugin/ai/openai"]
      }, {
        "comment": "Lush wildflowers lining the shore of a mountain lake with rugged peaks in the background under a clear blue sky",
        "tags": ["public", "nature", "plugin/inbox/ai/dalle", "+plugin/ai/openai"]
      }, {
        "comment": "Golden-hour light casting a warm glow over a serene lake surrounded by majestic mountains in autumn",
        "tags": ["public", "nature", "plugin/inbox/ai/dalle", "+plugin/ai/openai"]
      }, {
        "comment": "A starry night sky above a snow-capped mountain range with the aurora borealis reflecting on a frozen lake",
        "tags": ["public", "nature", "plugin/inbox/ai/dalle", "+plugin/ai/openai"]
      }, {
        "comment": "A serene sunrise over a crystal-clear mountain lake with the reflection of the surrounding pine trees",
        "tags": ["public", "nature", "plugin/inbox/ai/dalle", "+plugin/ai/openai"]
      }],
      "ext": []
    }

    When asked to draw an image, do not make any reference to DALL-E. Simply create a private message to DALL-E
    with the appropriate prompt, and set the url to 'ai:prompt'. Include in your prior Ref response a link to
    the DALL-E response using a response query:
    ![](/tag/+plugin/ai/dalle?view=plugin%2Fimage&filter=responses%2Fai:prompt&filter=query%2Fplugin%2Fimage&pageSize=1&cols=1)
    For example, in response to:
    {
      "url": "comment:ai-1",
      "comment": "Draw a picture of a heroic pie eating contest.",
      "tags": ["public", "plugin/thread", "+user/chris", "plugin/inbox/ai/openai"]
    }

    You could respond:
    {
      "ref": [{
        "sources": ["comment:ai-2"],
        "comment":"Behold! The heroic pie eating contest: ![](/tag/+plugin/ai/dalle?view=plugin%2Fimage&filter=responses%2Fai:prompt&filter=query%2Fplugin%2Fimage&pageSize=1&cols=1)",
        "tags": ["public", "internal", "plugin/thread", "plugin/inbox/user/chris", "+plugin/ai/openai"]
      }, {
        "url": "ai:prompt",
        "comment": "Heroic pie eating contest",
        "tags": ["public", "internal", "plugin/thread", "plugin/inbox/ai/dalle", "+plugin/ai/openai"]
      }],
      "ext": []
    }
    `,
    icons: [{ thumbnail: $localize`💭️`, order: -1 }],
    filters: [
      { query: 'plugin/inbox/ai/dalle', label: $localize`👨️‍🎨️💭️ dalle query`, group: $localize`Notifications ✉️` },
    ],
    advancedActions: [
      { tag: 'plugin/inbox/ai/dalle', labelOff: $localize`ask dalle`, global: true }
    ],
  },
};

export const dallePlugin: Plugin = {
  tag: '+plugin/ai/dalle',
  name: $localize`👨️‍🎨️ DALL·E`,
  config: {
    mod: $localize`👨️‍🎨️ DALL·E Chat`,
    type: 'tool',
    default: false,
    genId: true,
    submit: '👨️‍🎨️💭️',
    submitDm: true,
    signature: '+plugin/ai/dalle',
    generated: $localize`Generated by jasper-ui ${moment().toISOString()}`,
    icons: [{ thumbnail: $localize`👨️‍🎨️`, order: 1 }],
    filters: [
      { query: '+plugin/ai/dalle', label: $localize`👨️‍🎨️ dalle`, group: $localize`Plugins 🧰️` },
    ],
    reply: ['plugin/inbox/ai/dalle'],
    description: $localize`DALL-E signature tag. Plugin configures DALL-E to respond to 'plugin/inbox/ai/dalle' prompts
    and sign this response with this tag`,
    model: 'dall-e-3',
    size: '1024x1024',
    quality: 'hd',
    style: 'vivid',
  },
  schema: {},
  generateMetadata: true,
};
