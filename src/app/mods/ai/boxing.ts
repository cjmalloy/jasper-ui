import { DateTime } from 'luxon';
import { Plugin } from '../../model/plugin';
import { Mod } from '../../model/tag';

/**
 * Shared helpers injected into every boxing script.
 * Scripts must not use JS template literals or backslashes so they survive being embedded here.
 */
// language=JavaScript
const boxingScriptCommon = `
  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  const { spawn } = require('child_process');
  const axios = require('axios');
  const uuid = require('uuid');
  const ref = JSON.parse(fs.readFileSync(0, 'utf-8'));
  const origin = ref.origin || '';
  const BS = String.fromCharCode(92);
  const NL = String.fromCharCode(10);
  const uniq = (v, i, a) => a.indexOf(v) === i;
  const hasPrefix = (tag, prefix) => tag === prefix || tag.startsWith(prefix + '/');
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const headers = { 'Local-Origin': origin || 'default', 'User-Role': 'ROLE_ADMIN' };
  const fail = e => {
    console.error(e.response?.data || e.message);
    throw e;
  };
  const run = (cmd, args) => new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', d => err = (err + d).slice(-4000));
    p.on('error', reject);
    p.on('close', code => code === 0 ? resolve() : reject(new Error(cmd + ' exited with ' + code + ': ' + err)));
  });
  const ffmpeg = args => run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args]);
  const page = async (query, params = {}) => (await axios.get(process.env.JASPER_API + '/api/v1/ref/page', {
    headers,
    params: { query, ...params },
  }).catch(fail)).data.content || [];
  const upload = async (file, mime, title) => (await axios.post(process.env.JASPER_API + '/pub/api/v1/repl/cache', fs.readFileSync(file), {
    headers: { ...headers, 'Content-Type': mime },
    params: { origin, mime, title },
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  }).catch(fail)).data.url;
  const download = async (url, file) => {
    const res = await axios.get(process.env.JASPER_API + '/pub/api/v1/repl/cache', {
      responseType: 'arraybuffer',
      headers,
      params: { url, origin },
      maxContentLength: Infinity,
    }).catch(fail);
    fs.writeFileSync(file, Buffer.from(res.data));
    return file;
  };
  const shareTags = tags => (tags || []).filter(t => hasPrefix(t, 'public') || hasPrefix(t, '_user') || hasPrefix(t, '+user') || hasPrefix(t, 'user'));
  const fmtTime = s => {
    const m = Math.floor(s / 60);
    const r = s - m * 60;
    return String(m).padStart(2, '0') + ':' + r.toFixed(2).padStart(5, '0');
  };
  const parseTime = s => {
    const v = String(s || '0').split(':').map(Number).reduce((a, p) => a * 60 + (isNaN(p) ? 0 : p), 0);
    return isNaN(v) ? 0 : v;
  };
  const gemini = async config => {
    const { GoogleGenAI } = require('@google/genai');
    const apiKey = (await page((config.apiKeyTag || '+plugin/secret/gemini') + (origin || '@'), { size: 1 }))[0]?.comment;
    if (!apiKey) throw new Error('Gemini API key not found.');
    return new GoogleGenAI({ apiKey });
  };
  const ask = async (ai, config, parts, systemInstruction, responseSchema) => {
    const res = await ai.models.generateContent({
      model: config.model || 'gemini-2.5-flash',
      contents: [{ role: 'user', parts }],
      config: { systemInstruction, responseMimeType: 'application/json', responseSchema, temperature: 0 },
    });
    const text = res.text || (res.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
    return JSON.parse(text || 'null');
  };
  const videoPart = file => ({ inlineData: { mimeType: 'video/mp4', data: fs.readFileSync(file).toString('base64') } });
  const PREVIEW_PROMPT = 'You are an automated expert AI Boxing Judge running in a live production broadcast booth. ' +
    'Review this 10-second video block. Read the visual wall-clock timestamp burned into the bottom of the video frames. ' +
    'Log every single punch attempt. Output strictly in the provided JSON schema format.';
  const LEVELS = ['Low', 'Medium', 'High'];
  const PUNCH_SCHEMA = {
    type: 'ARRAY',
    items: {
      type: 'OBJECT',
      properties: {
        chunk_relative_timestamp: { type: 'STRING', description: 'MM:SS.ss offset from the start of this clip (the T+ value burned into the frame).' },
        wall_clock: { type: 'STRING', description: 'Wall-clock timestamp burned into the frame.' },
        fighter_shorts_color: { type: 'STRING' },
        punch_type: { type: 'STRING', enum: ['Jab', 'Cross', 'Hook', 'Uppercut', 'Overhand', 'Body Shot', 'Other'] },
        delivery_status: { type: 'STRING', enum: ['Clean Land', 'Blocked', 'Missed'] },
        target_zone: { type: 'STRING', enum: ['Head', 'Body', 'Guard', 'Other'] },
        severity: { type: 'STRING', enum: LEVELS },
        confidence: { type: 'STRING', enum: LEVELS },
      },
      required: ['chunk_relative_timestamp', 'fighter_shorts_color', 'punch_type', 'delivery_status', 'target_zone', 'severity', 'confidence'],
    },
  };
  const analyzeChunk = async (ai, config, seg, dir) => {
    const file = await download(seg.low, path.join(dir, 'low_' + seg.index + '.mp4'));
    const events = await ask(ai, config, [
      videoPart(file),
      { text: 'Chunk ' + seg.index + ' starts at wall-clock ' + seg.start + '.' },
    ], PREVIEW_PROMPT, PUNCH_SCHEMA);
    console.error(JSON.stringify({ chunk: seg.index, events }));
    return (Array.isArray(events) ? events : []).map(e => {
      const offset = clamp(parseTime(e.chunk_relative_timestamp), 0, seg.duration || 10);
      return { ...e, chunk_index: seg.index, offset, time: (seg.offset || 0) + offset };
    });
  };
  const draftManifest = async (parentUrl, segments, config, dir, ai) => {
    const byChunk = {};
    const previous = parentUrl ? await page('+plugin/delta/boxing.preview', { responses: parentUrl, size: 100 }) : [];
    for (const p of previous) {
      const data = p.plugins?.['plugin/boxing'] || {};
      for (const i of data.analyzed || []) {
        if (byChunk[i]) continue;
        byChunk[i] = (data.events || []).filter(e => e.chunk_index === i);
      }
    }
    for (const seg of segments) {
      if (byChunk[seg.index]) continue;
      ai = ai || await gemini(config);
      byChunk[seg.index] = await analyzeChunk(ai, config, seg, dir);
    }
    return {
      analyzed: segments.map(s => s.index),
      events: segments.flatMap(s => byChunk[s.index]).sort((a, b) => a.time - b.time),
    };
  };
  const logTable = events => {
    if (!events.length) return '_No punches logged._';
    return [
      '| Time | Clock | Fighter | Punch | Result | Target | Severity | Confidence |',
      '|---|---|---|---|---|---|---|---|',
      ...events.map(e => '| ' + [
        fmtTime(e.time || 0),
        e.wall_clock || '',
        e.fighter_shorts_color,
        e.punch_type,
        e.delivery_status + (e.verified === true ? ' ✅' : e.verified === false ? ' ❌' : ''),
        e.target_zone,
        e.severity,
        e.confidence,
      ].map(v => String(v || '').split('|').join('/')).join(' | ') + ' |'),
    ].join(NL);
  };
  const tally = events => {
    const counts = {};
    for (const e of events) {
      const c = counts[e.fighter_shorts_color] ||= { thrown: 0, landed: 0 };
      c.thrown++;
      if (e.delivery_status === 'Clean Land') c.landed++;
    }
    return Object.entries(counts).map(([f, c]) => '- **' + f + '**: ' + c.landed + ' landed / ' + c.thrown + ' thrown').join(NL);
  };
`;

export const boxingPlugin: Plugin = {
  tag: 'plugin/boxing',
  name: $localize`🥊️ Boxing Round`,
  config: {
    mod: $localize`🥊️ Boxing Judge`,
    version: 1,
    type: 'plugin',
    default: false,
    generated: $localize`Generated by jasper-ui ${DateTime.now().toISO()}`,
    description: $localize`Stores the cached 10 second clips, draft punch log and official score for an AI judged boxing round.`,
    icons: [{ label: $localize`🥊️`, order: 2 }],
    filters: [
      { query: 'plugin/boxing', label: $localize`🥊️ boxing`, title: $localize`AI judged boxing rounds`, group: $localize`Plugins 🧰️` },
    ],
  },
  schema: {
    optionalProperties: {
      round: { type: 'uint32' },
      start: { type: 'string' },
      waiting: { type: 'uint32' },
      segments: {
        elements: {
          properties: {
            index: { type: 'uint32' },
            offset: { type: 'float64' },
            duration: { type: 'float64' },
            start: { type: 'string' },
            low: { type: 'string' },
            high: { type: 'string' },
          },
        },
      },
      analyzed: { elements: { type: 'uint32' } },
      events: { elements: {} },
      highlights: { elements: {} },
      score: {},
      video: { type: 'string' },
    },
  },
};

export const boxingDeltaPlugin: Plugin = {
  tag: 'plugin/delta/boxing',
  name: $localize`🥊️⏳️ AI Boxing Judge`,
  config: {
    mod: $localize`🥊️ Boxing Judge`,
    version: 1,
    type: 'tool',
    default: false,
    generated: $localize`Generated by jasper-ui ${DateTime.now().toISO()}`,
    description: $localize`Add to an m3u8 playlist Ref to judge a boxing round with Gemini.
Runs repeatedly, cutting one 10 second low-res (480p @ 10fps with a burned in wall-clock) and one high-res clip per run.
Each new clip creates a plugin/delta/boxing.preview response with all cached clips so far.
After the final clip a plugin/delta/boxing.judge response is created to verify, score and render a 30 second replay.`,
    icons: [{ label: $localize`🥊️`, order: -3 }],
    advancedActions: [
      { if: 'plugin/video', tag: 'plugin/delta/boxing', labelOff: $localize`judge boxing`, title: $localize`Judge this boxing round with AI.`, global: true },
      { tag: 'plugin/delta/boxing', labelOn: $localize`cancel`, title: $localize`Stop judging this boxing round.` },
    ],
    timeoutMs: 300_000,
    language: 'javascript',
    // language=JavaScript
    script: `
      ${boxingScriptCommon}
      const config = ref.plugins?.['plugin/delta/boxing'] || {};
      const data = ref.plugins?.['plugin/boxing'] || {};
      const chunkSeconds = config.chunkSeconds || 10;
      const total = config.chunks || 18;
      const round = config.round || data.round || 1;
      const segments = data.segments || [];
      const index = segments.length;
      if (index >= total) process.exit(0);
      const playlist = async url => {
        const text = String((await axios.get(url, { responseType: 'text' }).catch(fail)).data);
        const lines = text.split(NL).map(l => l.trim());
        if (lines.some(l => l.startsWith('#EXT-X-STREAM-INF'))) {
          let best = null;
          let bandwidth = -1;
          lines.forEach((l, i) => {
            if (!l.startsWith('#EXT-X-STREAM-INF')) return;
            const b = +(l.match(/BANDWIDTH=([0-9]+)/)?.[1] || 0);
            const next = lines.slice(i + 1).find(n => n && !n.startsWith('#'));
            if (next && b > bandwidth) {
              bandwidth = b;
              best = next;
            }
          });
          return playlist(new URL(best, url).href);
        }
        let duration = 0;
        let extinf = 0;
        let start = null;
        for (const l of lines) {
          if (!start && l.startsWith('#EXT-X-PROGRAM-DATE-TIME:')) {
            // Anchor real-world time, PROGRAM-DATE-TIME applies to the next segment
            const t = Date.parse(l.substring(l.indexOf(':') + 1).replace(/([+-][0-9]{2})([0-9]{2})$/, '$1:$2'));
            if (!isNaN(t)) start = new Date(t - duration * 1000).toISOString();
          }
          if (l.startsWith('#EXTINF:')) extinf = parseFloat(l.substring(8)) || 0;
          if (l && !l.startsWith('#')) {
            duration += extinf;
            extinf = 0;
          }
        }
        const ended = lines.includes('#EXT-X-ENDLIST') || lines.includes('#EXT-X-PLAYLIST-TYPE:VOD');
        return { url, duration, start, ended };
      };
      const src = config.url || ref.plugins?.['plugin/video']?.url || ref.url;
      const pl = await playlist(src);
      const start = data.start || pl.start || ref.published || new Date().toISOString();
      const available = Math.min(total, Math.ceil(pl.duration / chunkSeconds - 0.001));
      const next = { ...data, round, start, segments };
      delete ref.metadata;
      ref.tags = [...(ref.tags || []), 'plugin/boxing'].filter(uniq);
      ref.plugins = { ...ref.plugins, 'plugin/boxing': next };
      const bundle = { ref: [ref] };
      const stop = () => {
        ref.tags = ref.tags.filter(t => !hasPrefix(t, 'plugin/delta/boxing'));
        delete ref.plugins['plugin/delta/boxing'];
      };
      const finish = () => {
        stop();
        bundle.ref.push({
          url: 'boxing:' + uuid.v4(),
          origin,
          title: 'Round ' + round + ' Official Score' + (ref.title ? ': ' + ref.title : ''),
          sources: [ref.url],
          tags: [...shareTags(ref.tags), 'plugin/boxing', 'plugin/delta/boxing.judge'].filter(uniq),
          plugins: {
            'plugin/boxing': { round, start, segments },
            'plugin/delta/boxing.judge': { apiKeyTag: config.apiKeyTag, model: config.model },
          },
        });
      };
      if (index >= available) {
        if (pl.ended || (next.waiting || 0) >= (config.maxWaits || 120)) {
          if (index) {
            finish();
          } else {
            stop();
          }
        } else {
          // Live or event playlist: wait for more segments then save to run again
          await new Promise(r => setTimeout(r, config.pollMs || 10_000));
          next.waiting = (next.waiting || 0) + 1;
        }
      } else {
        await transcode();
      }
      console.log(JSON.stringify(bundle));
      async function transcode() {
        const offset = index * chunkSeconds;
        const duration = Math.min(chunkSeconds, pl.duration - offset);
        const chunkStart = new Date(Date.parse(start) + offset * 1000);
        const epoch = (chunkStart.getTime() / 1000).toFixed(3);
        const clock = 'drawtext=text=' + "'" + '%{pts' + BS + ':gmtime' + BS + ':' + epoch + '}Z  T+%{pts' + BS + ':hms}' + "'" +
          ':x=(w-tw)/2:y=h-th-12:fontsize=20:fontcolor=white:box=1:boxcolor=black@0.6:boxborderw=6';
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'boxing-'));
        try {
          const low = path.join(dir, 'chunk_' + index + '_low.mp4');
          const high = path.join(dir, 'chunk_' + index + '_high.mp4');
          const meta = ['-metadata', 'creation_time=' + chunkStart.toISOString(), '-movflags', '+faststart'];
          await ffmpeg([
            '-ss', String(offset), '-i', pl.url,
            '-map', '0:v:0', '-map', '0:a:0?', '-t', String(duration),
            '-vf', 'scale=-2:' + (config.lowHeight || 480) + ',fps=' + (config.lowFps || 10) + ',' + clock + ',format=yuv420p',
            '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '28', '-c:a', 'aac', '-b:a', '64k', '-ac', '1', ...meta, low,
            '-map', '0:v:0', '-map', '0:a:0?', '-t', String(duration),
            '-vf', 'format=yuv420p', '-force_key_frames', 'expr:gte(t,n_forced)',
            '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-c:a', 'aac', '-b:a', '160k', ...meta, high,
          ]);
          const title = (ref.title || 'Round ' + round) + ' chunk ' + index;
          segments.push({
            index,
            offset,
            duration,
            start: chunkStart.toISOString(),
            low: await upload(low, 'video/mp4', title + ' (low res).mp4'),
            high: await upload(high, 'video/mp4', title + ' (high res).mp4'),
          });
        } finally {
          fs.rmSync(dir, { recursive: true, force: true });
        }
        delete next.waiting;
        bundle.ref.push({
          url: 'boxing:' + uuid.v4(),
          origin,
          title: 'Round ' + round + ' Preview ' + segments.length + '/' + (pl.ended ? available : total) + (ref.title ? ': ' + ref.title : ''),
          sources: [ref.url],
          tags: [...shareTags(ref.tags), 'internal', 'plugin/boxing', 'plugin/delta/boxing.preview'].filter(uniq),
          plugins: {
            'plugin/boxing': { round, start, segments },
            'plugin/delta/boxing.preview': { apiKeyTag: config.apiKeyTag, model: config.model },
          },
        });
        if (segments.length >= total || pl.ended && segments.length >= available) finish();
      }
    `,
    form: [{
      key: 'round',
      type: 'number',
      props: {
        label: $localize`Round:`,
        min: 1,
      },
    }],
    advancedForm: [{
      key: 'chunks',
      type: 'number',
      props: {
        label: $localize`Clips:`,
        min: 1,
      },
    }, {
      key: 'chunkSeconds',
      type: 'number',
      props: {
        label: $localize`Clip Seconds:`,
        min: 1,
      },
    }, {
      key: 'apiKeyTag',
      type: 'tag',
      props: {
        label: $localize`🔑️ API Key Tag:`,
      },
    }, {
      key: 'model',
      type: 'string',
      props: {
        label: $localize`Model:`,
      },
    }],
  },
  defaults: {
    round: 1,
    chunks: 18,
    chunkSeconds: 10,
    apiKeyTag: '+plugin/secret/gemini',
    model: 'gemini-2.5-flash',
  },
  schema: {
    optionalProperties: {
      url: { type: 'string' },
      round: { type: 'uint32' },
      chunks: { type: 'uint32' },
      chunkSeconds: { type: 'uint32' },
      lowHeight: { type: 'uint32' },
      lowFps: { type: 'uint32' },
      pollMs: { type: 'uint32' },
      maxWaits: { type: 'uint32' },
      apiKeyTag: { type: 'string' },
      model: { type: 'string' },
    },
  },
};

export const boxingPreviewPlugin: Plugin = {
  tag: 'plugin/delta/boxing.preview',
  name: $localize`🥊️📺️ Boxing Preview`,
  config: {
    mod: $localize`🥊️ Boxing Judge`,
    version: 1,
    type: 'tool',
    default: false,
    generated: $localize`Generated by jasper-ui ${DateTime.now().toISO()}`,
    description: $localize`Draft punch log from the cached low-res clips. Only clips not analyzed by a previous preview are sent to Gemini.`,
    timeoutMs: 300_000,
    language: 'javascript',
    // language=JavaScript
    script: `
      ${boxingScriptCommon}
      const config = ref.plugins?.['plugin/delta/boxing.preview'] || {};
      const data = ref.plugins?.['plugin/boxing'] || {};
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'boxing-'));
      try {
        const manifest = await draftManifest(ref.sources?.[0], data.segments || [], config, dir);
        delete ref.metadata;
        ref.tags = [...(ref.tags || []).filter(t => !hasPrefix(t, 'plugin/delta/boxing.preview')), '+plugin/delta/boxing.preview', 'plugin/boxing'].filter(uniq);
        ref.plugins = { ...ref.plugins, 'plugin/boxing': { ...data, ...manifest } };
        delete ref.plugins['plugin/delta/boxing.preview'];
        ref.comment = '## Draft Manifest' + NL + NL + tally(manifest.events) + NL + NL + logTable(manifest.events);
        console.log(JSON.stringify({ ref: [ref] }));
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    `,
    advancedForm: [{
      key: 'apiKeyTag',
      type: 'tag',
      props: {
        label: $localize`🔑️ API Key Tag:`,
      },
    }, {
      key: 'model',
      type: 'string',
      props: {
        label: $localize`Model:`,
      },
    }],
  },
  defaults: {
    apiKeyTag: '+plugin/secret/gemini',
    model: 'gemini-2.5-flash',
  },
  schema: {
    optionalProperties: {
      apiKeyTag: { type: 'string' },
      model: { type: 'string' },
    },
  },
};

export const boxingPreviewSignaturePlugin: Plugin = {
  tag: '+plugin/delta/boxing.preview',
  name: $localize`🥊️📺️ Boxing Draft`,
  config: {
    mod: $localize`🥊️ Boxing Judge`,
    version: 1,
    type: 'tool',
    default: false,
    generated: $localize`Generated by jasper-ui ${DateTime.now().toISO()}`,
    description: $localize`Draft punch log signature tag.`,
    icons: [{ label: $localize`📺️`, order: 1 }],
    filters: [
      { query: '+plugin/delta/boxing.preview', label: $localize`📺️ boxing drafts`, title: $localize`Draft AI boxing punch logs`, group: $localize`Delta Δ` },
    ],
  },
};

export const boxingJudgePlugin: Plugin = {
  tag: 'plugin/delta/boxing.judge',
  name: $localize`🥊️🏁️ Boxing Final Judge`,
  config: {
    mod: $localize`🥊️ Boxing Judge`,
    version: 1,
    type: 'tool',
    default: false,
    generated: $localize`Generated by jasper-ui ${DateTime.now().toISO()}`,
    description: $localize`Verifies clean power punches against the high-res clips, scores the round on the 10-9 must system
and renders a 30 second replay and slow-motion video with commentary and the round score as subtitles.`,
    timeoutMs: 900_000,
    language: 'javascript',
    // language=JavaScript
    script: `
      ${boxingScriptCommon}
      const config = ref.plugins?.['plugin/delta/boxing.judge'] || {};
      const data = ref.plugins?.['plugin/boxing'] || {};
      const segments = data.segments || [];
      const round = data.round || 1;
      if (!segments.length) throw new Error('No clips to judge.');
      const rank = v => LEVELS.indexOf(v) + 1;
      const POWER = ['Cross', 'Hook', 'Uppercut', 'Overhand', 'Body Shot'];
      const VERIFY_PROMPT = 'Analyze this 3-second high-resolution exchange frame-by-frame. ' +
        'Confirm whether the punch cleanly bypassed the guard to land flush on the scoring target area, ' +
        'or if it deflected off the gloves/shoulders. Return a finalized boolean status.';
      const VERIFY_SCHEMA = {
        type: 'OBJECT',
        properties: { landed: { type: 'BOOLEAN' }, reason: { type: 'STRING' } },
        required: ['landed'],
      };
      const SCORE_PROMPT = 'You are the official judge of a professional boxing round. ' +
        'Using the Official Master Fight Log, score the round on the 10-Point Must System (winner 10, loser 9 or less, 10-10 only if truly even). ' +
        'Identify fighters by shorts color. Write a 2-sentence rationale for the screen graphics, ' +
        'and one short broadcast commentary line (under 90 characters) for each highlight in the given order.';
      const SCORE_SCHEMA = {
        type: 'OBJECT',
        properties: {
          scores: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: { fighter_shorts_color: { type: 'STRING' }, points: { type: 'INTEGER' } },
              required: ['fighter_shorts_color', 'points'],
            },
          },
          winner: { type: 'STRING' },
          rationale: { type: 'STRING' },
          commentary: { type: 'ARRAY', items: { type: 'STRING' } },
        },
        required: ['scores', 'rationale', 'commentary'],
      };
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'boxing-'));
      try {
        const ai = await gemini(config);
        const draft = await draftManifest(ref.sources?.[0], segments, config, dir, ai);
        const events = draft.events.map((e, id) => ({ ...e, id }));
        const segmentOf = e => segments.find(s => s.index === e.chunk_index);
        const highFiles = {};
        const highFile = async seg => highFiles[seg.index] ||= await download(seg.high, path.join(dir, 'high_' + seg.index + '.mp4'));

        // Cross-match: verify high impact or low confidence clean lands against the high-res clip
        const candidates = events
          .filter(e => e.delivery_status === 'Clean Land' && (e.severity === 'High' || e.confidence === 'Low'))
          .sort((a, b) => rank(b.severity) - rank(a.severity))
          .slice(0, config.maxVerify || 12);
        for (const e of candidates) {
          const seg = segmentOf(e);
          if (!seg) continue;
          const clip = path.join(dir, 'verify_' + e.id + '.mp4');
          const ss = clamp(e.offset - 1.5, 0, Math.max(0, (seg.duration || 10) - 3));
          await ffmpeg(['-ss', ss.toFixed(2), '-i', await highFile(seg), '-t', '3', '-an',
            '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', clip]);
          const result = await ask(ai, config, [
            videoPart(clip),
            { text: 'Punch under review: ' + JSON.stringify({
              fighter_shorts_color: e.fighter_shorts_color,
              punch_type: e.punch_type,
              target_zone: e.target_zone,
              clip_relative_timestamp: fmtTime(e.offset - ss),
            }) },
          ], VERIFY_PROMPT, VERIFY_SCHEMA);
          e.verified = !!result?.landed;
          e.verification = result?.reason || '';
          if (!e.verified) e.delivery_status = 'Blocked';
          console.error(JSON.stringify({ verify: e.id, ...result }));
        }

        // Highlights: top 3 clean power punches, padded so the replay is always 3 x 10 seconds
        const score = e => (e.verified ? 10 : 0) + rank(e.severity) * 3 + rank(e.confidence) + (POWER.includes(e.punch_type) ? 5 : 0);
        const lands = events.filter(e => e.delivery_status === 'Clean Land').sort((a, b) => score(b) - score(a));
        const highlights = [...lands, ...events.filter(e => !lands.includes(e)).sort((a, b) => score(b) - score(a))].slice(0, 3);
        for (let i = 0; highlights.length < 3; i++) {
          const seg = segments[Math.floor(segments.length * (i * 2 + 1) / 6) % segments.length];
          highlights.push({ chunk_index: seg.index, offset: (seg.duration || 10) / 2, time: seg.offset + (seg.duration || 10) / 2 });
        }
        highlights.sort((a, b) => a.time - b.time);

        // Official score and commentary
        const log = events.map(({ time, fighter_shorts_color, punch_type, delivery_status, target_zone, severity, verified }) =>
          ({ time: fmtTime(time), fighter_shorts_color, punch_type, delivery_status, target_zone, severity, verified }));
        const official = await ask(ai, config, [{
          text: 'Official Master Fight Log for round ' + round + ':' + NL + JSON.stringify(log) + NL + NL +
            'Highlights in replay order:' + NL + JSON.stringify(highlights.map(h => h.fighter_shorts_color
              ? { time: fmtTime(h.time), fighter_shorts_color: h.fighter_shorts_color, punch_type: h.punch_type, delivery_status: h.delivery_status, target_zone: h.target_zone }
              : { time: fmtTime(h.time), note: 'General action' })),
        }], SCORE_PROMPT, SCORE_SCHEMA) || {};
        const scores = official.scores || [];
        const label = 'Round ' + round + ': ' + (scores.map(s => s.fighter_shorts_color + ' ' + s.points).join(' - ') || 'No score');

        // Render 30 seconds: each highlight is a 5s replay followed by a 5s slow motion replay
        const W = 1920;
        const H = 1080;
        const REAL = 5;
        const SLOW = config.slowMotion || 2;
        const norm = 'scale=' + W + ':' + H + ':force_original_aspect_ratio=decrease,pad=' + W + ':' + H + ':(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30';
        const pad = ',tpad=stop_mode=clone:stop_duration=' + REAL + ',format=yuv420p';
        const enc = ['-an', '-t', String(REAL), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-video_track_timescale', '15360'];
        const parts = [];
        for (const [i, h] of highlights.entries()) {
          const seg = segmentOf(h);
          const file = await highFile(seg);
          const dur = seg.duration || 10;
          const real = path.join(dir, 'part_' + i + '_real.mp4');
          const slow = path.join(dir, 'part_' + i + '_slow.mp4');
          const rs = clamp(h.offset - REAL / 2, 0, Math.max(0, dur - REAL));
          const ss = clamp(h.offset - REAL / SLOW / 2, 0, Math.max(0, dur - REAL / SLOW));
          await ffmpeg(['-ss', rs.toFixed(2), '-i', file, '-vf', norm + pad, ...enc, real]);
          await ffmpeg(['-ss', ss.toFixed(2), '-t', (REAL / SLOW).toFixed(2), '-i', file, '-vf', 'setpts=' + SLOW + '*PTS,' + norm + pad, ...enc, slow]);
          parts.push(real, slow);
        }
        const list = path.join(dir, 'list.txt');
        fs.writeFileSync(list, parts.map(p => "file '" + p + "'").join(NL));
        const joined = path.join(dir, 'joined.mp4');
        await ffmpeg(['-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', joined]);
        const srtTime = s => new Date(s * 1000).toISOString().substring(11, 23).replace('.', ',');
        const cues = highlights.flatMap((h, i) => {
          const what = h.fighter_shorts_color ? h.fighter_shorts_color + ' ' + h.punch_type + ' (' + fmtTime(h.time) + ')' : fmtTime(h.time);
          const line = official.commentary?.[i] || '';
          return [
            ['REPLAY ' + (i + 1) + ': ' + what, line, label],
            ['SLOW MO ' + (i + 1) + ': ' + what, line, label],
          ];
        });
        const srt = path.join(dir, 'subs.srt');
        fs.writeFileSync(srt, cues.map((c, i) => (i + 1) + NL + srtTime(i * REAL) + ' --> ' + srtTime((i + 1) * REAL) + NL + c.filter(l => l).join(NL) + NL).join(NL));
        const final = path.join(dir, 'highlights.mp4');
        const out = ['-t', '30', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart'];
        try {
          await ffmpeg(['-i', joined, '-vf', 'subtitles=' + srt + ":force_style='FontSize=18,Outline=2'", ...out, final]);
        } catch (e) {
          console.error('Could not burn subtitles, embedding subtitle track instead: ' + e.message);
          await ffmpeg(['-i', joined, '-i', srt, '-map', '0:v', '-map', '1:s', '-c:s', 'mov_text', ...out, final]);
        }
        const video = await upload(final, 'video/mp4', 'Round ' + round + ' highlights.mp4');

        delete ref.metadata;
        ref.title = label + (official.winner ? ' (' + official.winner + ')' : '');
        ref.tags = [...(ref.tags || []).filter(t => !hasPrefix(t, 'plugin/delta/boxing.judge')), '+plugin/delta/boxing.judge', 'plugin/boxing', 'plugin/video'].filter(uniq);
        ref.plugins = {
          ...ref.plugins,
          'plugin/video': { url: video },
          'plugin/boxing': {
            ...data,
            ...draft,
            events,
            highlights: highlights.map((h, i) => ({ id: h.id, time: h.time, chunk_index: h.chunk_index, commentary: official.commentary?.[i] || '' })),
            score: { scores, winner: official.winner || '', rationale: official.rationale || '', label },
            video,
          },
        };
        delete ref.plugins['plugin/delta/boxing.judge'];
        ref.comment = [
          '## ' + label,
          official.rationale || '',
          '## Highlights',
          cues.filter((c, i) => i % 2 === 0).map(c => '- ' + c[0] + (c[1] ? ': ' + c[1] : '')).join(NL),
          '## Official Master Fight Log',
          tally(events),
          logTable(events),
        ].join(NL + NL);
        console.log(JSON.stringify({ ref: [ref] }));
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    `,
    advancedForm: [{
      key: 'apiKeyTag',
      type: 'tag',
      props: {
        label: $localize`🔑️ API Key Tag:`,
      },
    }, {
      key: 'model',
      type: 'string',
      props: {
        label: $localize`Model:`,
      },
    }],
  },
  defaults: {
    apiKeyTag: '+plugin/secret/gemini',
    model: 'gemini-2.5-flash',
  },
  schema: {
    optionalProperties: {
      apiKeyTag: { type: 'string' },
      model: { type: 'string' },
      maxVerify: { type: 'uint32' },
      slowMotion: { type: 'float64' },
    },
  },
};

export const boxingJudgeSignaturePlugin: Plugin = {
  tag: '+plugin/delta/boxing.judge',
  name: $localize`🥊️🏁️ Boxing Score`,
  config: {
    mod: $localize`🥊️ Boxing Judge`,
    version: 1,
    type: 'tool',
    default: false,
    generated: $localize`Generated by jasper-ui ${DateTime.now().toISO()}`,
    description: $localize`Official round score and highlight video signature tag.`,
    icons: [{ label: $localize`🏁️`, order: 1 }],
    filters: [
      { query: '+plugin/delta/boxing.judge', label: $localize`🏁️ boxing scores`, title: $localize`Official AI boxing round scores`, group: $localize`Delta Δ` },
    ],
  },
};

export const boxingMod: Mod = {
  plugin: [
    boxingPlugin,
    boxingDeltaPlugin,
    boxingPreviewPlugin,
    boxingPreviewSignaturePlugin,
    boxingJudgePlugin,
    boxingJudgeSignaturePlugin,
  ],
};
