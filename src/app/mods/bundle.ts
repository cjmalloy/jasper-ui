import { Mod } from '../model/tag';
import { aiMod } from './ai/ai';
import { dalleMod } from './ai/dalle';
import { naviMod } from './ai/navi';
import { neoMod } from './ai/neo-banana';
import { summaryMod } from './ai/summary';
import { translateMod } from './ai/translate';
import { blogMod } from './blog';
import { chatMod } from './chat';
import { clipboardMod } from './clipboard';
import { commentMod } from './comment';
import { deleteMod } from './delete';
import { draftMod } from './draft';
import { htmlMod, latexMod } from './editor';
import { experimentsMod } from './experiments';
import { backgammonMod } from './games/backgammon';
import { chessMod } from './games/chess';
import { jezzballMod } from './games/jezzball';
import { helpMod } from './help';
import { homeMod } from './home';
import { lensMod } from './lens';
import { mailboxMod } from './mailbox';
import { mapMod } from './map';
import { audioMod } from './media/audio';
import { codeMod } from './media/code';
import { durationMod } from './media/duration';
import { embedMod } from './media/embed';
import { fileMod } from './media/file';
import { imageMod } from './media/image';
import { masonryMod } from './media/masonry';
import { carouselMod } from './media/carousel';
import { mp3Mod } from './media/mp3';
import { pdfMod } from './media/pdf';
import { playlistMod } from './media/playlist';
import { tableMod } from './media/table';
import { tabMod } from './media/tab';
import { videoMod } from './media/video';
import { ytdlpMod } from './media/ytdlp';
import { storeMod } from './mod';
import { modlistMod } from './modlist';
import { folderMod } from './org/folder';
import { graphMod } from './org/graph';
import { gridMod } from './org/grid';
import { hideMod } from './org/hide';
import { kanbanMod } from './org/kanban';
import { notesMod } from './org/notes';
import { personMod } from './org/person';
import { queueMod } from './org/queue';
import { readMod } from './org/read';
import { saveMod } from './org/save';
import { todoMod } from './org/todo';
import { wikiMod } from './org/wiki';
import { progressMod } from './progress';
import { repostMod } from './repost';
import { rootMod } from './root';
import { emailMod } from './sync/email';
import { feedMod } from './sync/feed';
import { remoteOriginMod } from './sync/origin';
import { scrapeMod } from './sync/scrape';
import { banlistMod } from './system/banlist';
import { cacheMod } from './system/cache';
import { debugMod } from './system/debug';
import { errorMod } from './system/error';
import { fullscreenMod } from './system/fullscreen';
import { gdprMod } from './system/gdpr';
import { indexHelperMod } from './system/index-helper';
import { oembedMod } from './system/oembed';
import { pipMod } from './system/pip';
import { scriptMod } from './system/script';
import { seamlessMod } from './system/seamless';
import { secretMod } from './system/secret';
import { snippetMod } from './system/snippet';
import { systemMod } from './system/system';
import { themesMod } from './system/theme';
import { threadMod } from './thread';
import { thumbnailMod } from './thumbnail';
import { archiveMod } from './tools/archive';
import { htmlToMarkdownMod } from './tools/htmlToMarkdown';
import { markitdownMod } from './tools/markitdown';
import { ninjaTriangleMod } from './tools/ninga-triangle';
import { pollMod } from './tools/poll';
import { qrMod } from './tools/qr';
import { thanksMod } from './tools/thanks';
import { userMod } from './user';
import { voteMod } from './vote';

/**
 * Every bundled mod. Lazy loaded with {@link AdminService.loadBundled$}.
 */
export const mods: Mod[] = [
  debugMod,
  rootMod,
  userMod,
  folderMod,
  homeMod,
  kanbanMod,
  blogMod,
  mapMod,
  chatMod,
  clipboardMod,
  mailboxMod,
  hideMod,
  saveMod,
  readMod,
  draftMod,

  // Themes
  themesMod,

  // Configs
  experimentsMod,
  helpMod,
  indexHelperMod,
  wikiMod,
  graphMod,
  modlistMod,
  banlistMod,
  snippetMod,
  htmlToMarkdownMod,
  thanksMod,
  gdprMod,

  // Plugins
  storeMod,
  oembedMod,
  scrapeMod,
  cacheMod,
  systemMod,
  secretMod,
  errorMod,
  remoteOriginMod,
  scriptMod,
  feedMod,
  deleteMod,
  mailboxMod,
  modlistMod,
  commentMod,
  threadMod,
  gridMod,
  notesMod,
  emailMod,
  durationMod,
  progressMod,
  fullscreenMod,
  seamlessMod,
  thumbnailMod,
  tableMod,
  tabMod,
  aiMod,
  naviMod,
  dalleMod,
  neoMod,
  summaryMod,
  translateMod,
  pdfMod,
  archiveMod,
  latexMod,
  codeMod,
  htmlMod,
  personMod,
  repostMod,
  queueMod,
  qrMod,
  embedMod,
  audioMod,
  videoMod,
  ytdlpMod,
  mp3Mod,
  markitdownMod,
  voteMod,
  imageMod,
  masonryMod,
  carouselMod,
  lensMod,
  pipMod,
  chessMod,
  backgammonMod,
  jezzballMod,
  pollMod,
  todoMod,
  ninjaTriangleMod,
  playlistMod,
  fileMod,
];
