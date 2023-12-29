import * as moment from 'moment';
import { Plugin } from '../model/plugin';
import { Template } from '../model/template';

export const aiQueryPlugin: Plugin = {
  tag: 'plugin/inbox/ai',
  name: $localize`👻️💭️ Ask AI`,
  config: {
    mod: $localize`👻️ AI Chat`,
    type: 'tool',
    default: false,
    add: true,
    submitText: true,
    signature: '+plugin/openai',
    generated: $localize`Generated by jasper-ui ${moment().toISOString()}`,
    description: $localize`Send this Ref to the ai for response.`,
    icons: [{ label: $localize`👻️💭️`, order: -1 }],
    filters: [
      { query: 'plugin/inbox/ai', label: $localize`👻️💭️ ai query`, group: $localize`Notifications ✉️` },
    ],
    advancedActions: [
      { tag: 'plugin/inbox/ai', labelOff: $localize`ask ai`, global: true }
    ],
  },
};

export const aiPlugin: Plugin = {
  tag: '+plugin/openai',
  name: $localize`👻️ OpenAI`,
  config: {
    mod: $localize`👻️ AI Chat`,
    type: 'tool',
    default: false,
    signature: '+plugin/openai',
    generated: $localize`Generated by jasper-ui ${moment().toISOString()}`,
    icons: [{ thumbnail: $localize`👻️`, order: 1 }],
    filters: [
      { query: '+plugin/openai', label: $localize`👻️ ai`, group: $localize`Plugins 🧰️` },
    ],
    reply: ['plugin/inbox/ai'],
    description: $localize`AI signature tag. Plugin configures OpenAi to respond to 'plugin/inbox/ai' prompts
    and sign this response with this tag. Plugin data contains token usage stats.`,
    model: 'gpt-4-1106-preview',
    fallback: ['gpt-4'],
    maxTokens: 4096,
    maxContext: 7,
    systemPrompt: $localize`
Your inbox is tag plugin/inbox/ai.
You are a helpful research assistant in a private database codenamed Jasper.
The database is organized into JSON objects called Refs.
Each Ref contains a URL primary key modified date, and published date.
It may also contain the optional fields: origin, title, comment, tags, sources, alternate urls, created date, plugins, metadata.
Origin: server or original source: empty string ("") or something like @google.com or @jasper
Comment: Defaults to Markdown and HTML (ngx-markdown). Supports LaTeX (KaTeX) and Mermaid diagrams.
Tags: array of simple strings, lowercase numbers dots and forward slashes
Sources: array of urls with a published date that precedes this
Plugins: if a plugin has a schema defined
Metadata: Jasper async generated custom data, including number of responses (tracked with and without internal tag separately)
Tags that start with plugin/ represent plugins which modify the ontology or functionality of a Ref.
The comment field contains markdown or HTML by default.
Tags that start with user/ represent a user.
The public tag grants anyone read access.
Tags identify a category or topic if they don't start with anything in particular.
The plugin/inbox/ai tag is used to send the Ref as a prompt to an AI (like you).
The +plugin/openai tag is your signature, it is added to indicate the Ref comment was written by you.
Refs sent to you will have the plugin field removed if it is too big.
Your responses will be used to create a comment in a new Ref in response.
Use markdown to format your response.
If you include a diagram in your response, use mermaid to draw it. Write three backticks and 'mermaid' to open (\`\`\`mermaid) and three backticks to close(\`\`\`).
For example:
\`\`\`mermaid
graph TB
    Start -->|Both Cooperate| BothWin{Both Win}
    Start -->|Both Defect| BothLose{Both Lose}
    Start -->|P1 Cooperates, P2 Defects| P2Wins{P2 Wins, P1 Loses}
    Start -->|P1 Defects, P2 Cooperates| P1Wins{P1 Wins, P2 Loses}
\`\`\`
When replying to a plugin/chess Ref, include the full previous game before your response in the comment field.
Chess games are only stored in the comment field. They are Portable Game Notation (PGN) or the first line Forsyth-Edwards Notation (FEN) followed by optional newline delimited PGN-like list of Standard Algebraic Notation (SAN) moves.
It is also customary to note the last move in the title suffix, such as ' | Rg3'.
The DALL-E AI responds to the tag plugin/inbox/dalle. If you are requested to generate a DALL-E prompt, always assume you are to forward your message to DALL-E by including this tag.
DALL-E prompt must be length 1000 or less. If you generate too many characters (title if present + ': ') plus length of comment, the image will not generate.
Messages signed by DALL-E will have the tag +plugin/dalle.
Be concise when possible but always comprehensive. You can reply with multiple Refs and request help from another assistant by tagging with plugin/inbox/ai.
Responses sent to you will only include direct sources. Be sure to summarize important details in every response, so future responses maintain access to important context.
`,
  },
  schema: {},
  generateMetadata: true,
};

export const aiTemplate: Template = {
  tag: 'plugin/openai',
  name: $localize`👻️ OpenAI`,
  config: {
    mod: $localize`👻️ AI Chat`,
    type: 'tool',
  },
  defaults: {
    dms: 'plugin/inbox/ai',
  }
};

export const dalleQueryPlugin: Plugin = {
  tag: 'plugin/inbox/dalle',
  name: $localize`👨️‍🎨️💭️ Ask DALL-E`,
  config: {
    mod: $localize`👨️‍🎨️ DALL-E Chat`,
    type: 'tool',
    default: false,
    add: true,
    submitText: true,
    signature: '+plugin/dalle',
    generated: $localize`Generated by jasper-ui ${moment().toISOString()}`,
    description: $localize`Send this Ref to DALL-E for response.`,
    aiInstructions: `
    Tagging a post plugin/inbox/dalle will send that post title and comment to the DALL-E API as a prompt.
    DALL-E will return a single image per invocation. To generate multiple images, create multiple Refs.
    For example, in response to:
    {
      "url": "comment:ai-1",
      "comment": "Ask dalle (plugin/inbox/dalle) to create 16 pictures of lakes and mountains and tag them #public #nature. Then include an embedded lens in your reply to a query of plugin/image:nature?cols=4 to create a 4x4 tiled embed.",
      "tags": ["public", "+user/chris", "plugin/inbox/ai"]
    }

    You could respond:
    {
      "ref": [{
        "sources": ["comment:ai-1"],
        "title": "Re: ",
        "comment":"I have forwarded the request to create 16 pictures of lakes and mountains to DALL-E. They will be tagged #public #nature. Additionally, once created, you can view them in a 4x4 tiled embed using the following lens: ![Nature Scenes](/tag/plugin/image:nature?cols=4).",
        "tags": ["public", "plugin/inbox/user/chris", "+plugin/openai"]
      }, {
        "comment": "A winter scene of a frozen mountain lake with a lone wolf traversing the icy landscape in the quiet snowfall",
        "tags": ["public", "nature", "plugin/inbox/dalle", "+plugin/openai"]
      }, {
        "comment": "A vibrant rainbow arching over a mountain lake with cascading waterfalls in the lush green valley",
        "tags": ["public", "nature", "plugin/inbox/dalle", "+plugin/openai"]
      }, {
        "comment": "An old wooden cabin on the shore of a mountain lake, with trees displaying colorful fall foliage",
        "tags": ["public", "nature", "plugin/inbox/dalle", "+plugin/openai"]
      }, {
        "comment": "A cozy campfire by a remote mountain lake, with the Milky Way stretching across the night sky above",
        "tags": ["public", "nature", "plugin/inbox/dalle", "+plugin/openai"]
      }, {
        "comment": "A mountain biker pausing to overlook a vast lake with towering peaks in the distance at sunset",
        "tags": ["public", "nature", "plugin/inbox/dalle", "+plugin/openai"]
      }, {
        "comment": "A pristine mountain lake with crystal-clear waters revealing the rocky depths below, framed by a lush green forest",
        "tags": ["public", "nature", "plugin/inbox/dalle", "+plugin/openai"]
      }, {
        "comment": "Fireflies illuminating the evening sky over a calm mountain lake as twilight settles in",
        "tags": ["public", "nature", "plugin/inbox/dalle", "+plugin/openai"]
      }, {
        "comment": "A high-altitude lake offering a panoramic view of the expansive mountain range and a clear blue sky",
        "tags": ["public", "nature", "plugin/inbox/dalle", "+plugin/openai"]
      }, {
        "comment": "A misty morning on a mountain lake with a wooden pier extending into the water, surrounded by autumn foliage",
        "tags": ["public", "nature", "plugin/inbox/dalle", "+plugin/openai"]
      }, {
        "comment": "A lone kayaker on a tranquil mountain lake, paddling gently as the sun rises over the distant peaks",
        "tags": ["public", "nature", "plugin/inbox/dalle", "+plugin/openai"]
      }, {
        "comment": "A secluded mountain lake with wild horses grazing peacefully by the water's edge at dusk",
        "tags": ["public", "nature", "plugin/inbox/dalle", "+plugin/openai"]
      }, {
        "comment": "Mirror-like mountain lake reflecting the moody, cloudy sky and the dense, forested slopes surrounding it",
        "tags": ["public", "nature", "plugin/inbox/dalle", "+plugin/openai"]
      }, {
        "comment": "Lush wildflowers lining the shore of a mountain lake with rugged peaks in the background under a clear blue sky",
        "tags": ["public", "nature", "plugin/inbox/dalle", "+plugin/openai"]
      }, {
        "comment": "Golden-hour light casting a warm glow over a serene lake surrounded by majestic mountains in autumn",
        "tags": ["public", "nature", "plugin/inbox/dalle", "+plugin/openai"]
      }, {
        "comment": "A starry night sky above a snow-capped mountain range with the aurora borealis reflecting on a frozen lake",
        "tags": ["public", "nature", "plugin/inbox/dalle", "+plugin/openai"]
      }, {
        "comment": "A serene sunrise over a crystal-clear mountain lake with the reflection of the surrounding pine trees",
        "tags": ["public", "nature", "plugin/inbox/dalle", "+plugin/openai"]
      }],
      "ext": []
    }
    `,
    icons: [{ label: $localize`👨️‍🎨️💭️`, order: -1 }],
    filters: [
      { query: 'plugin/inbox/dalle', label: $localize`👨️‍🎨️💭️ dalle query`, group: $localize`Notifications ✉️` },
    ],
    advancedActions: [
      { tag: 'plugin/inbox/dalle', labelOff: $localize`ask dalle`, global: true }
    ],
  },
};

export const dallePlugin: Plugin = {
  tag: '+plugin/dalle',
  name: $localize`👨️‍🎨️ DALL-E`,
  config: {
    mod: $localize`👨️‍🎨️ DALL-E Chat`,
    type: 'tool',
    default: false,
    signature: '+plugin/dalle',
    generated: $localize`Generated by jasper-ui ${moment().toISOString()}`,
    icons: [{ thumbnail: $localize`👨️‍🎨️`, order: 1 }],
    filters: [
      { query: '+plugin/dalle', label: $localize`👨️‍🎨️ dalle`, group: $localize`Plugins 🧰️` },
    ],
    reply: ['plugin/inbox/dalle'],
    description: $localize`DALL-E signature tag. Plugin configures DALL-E to respond to 'plugin/inbox/dalle' prompts
    and sign this response with this tag`,
    model: 'dall-e-3',
    size: '1024x1024',
    quality: 'hd',
  },
  schema: {},
  generateMetadata: true,
};
