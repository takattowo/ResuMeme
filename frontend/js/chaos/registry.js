// To register a new chaos effect:
//   1. Create a file in ./effects/<name>.js with a default export
//      matching the EffectModule shape (see orchestrator.js).
//   2. Add an import below and append it to EFFECTS.
//
// Each effect runs once per page load. The orchestrator queries DOM
// targets matching effect.targets and applies effect.apply() to a
// random subset selected via effect.density.

import zoomPulse from './effects/zoomPulse.js';
import randomCaps from './effects/randomCaps.js';
import markHighlight from './effects/markHighlight.js';
import strikethrough from './effects/strikethrough.js';
import citationNeeded from './effects/citationNeeded.js';
import glitch from './effects/glitch.js';
import rainbow from './effects/rainbowGradient.js';
import wingdingsFlicker from './effects/wingdingsFlicker.js';
import fakeSpellcheck from './effects/fakeSpellcheck.js';
import randomRotation from './effects/randomRotation.js';
import strobeHeading from './effects/strobeHeading.js';
import colorShift from './effects/colorShift.js';
import letterSpread from './effects/letterSpread.js';
import boldRandom from './effects/boldRandom.js';
import precipitation from './effects/precipitation.js';
// import mixedFonts from './effects/mixedFonts.js';     // disabled: destroys readability
import marqueeBanner from './effects/marqueeBanner.js';
import brainrotMarquee from './effects/brainrotMarquee.js';
import tableSection from './effects/tableSection.js';
import watermark from './effects/watermark.js';
// import cyclingBg from './effects/cyclingBg.js';        // disabled: dominates the page
import wordCloud from './effects/wordCloud.js';
import achievementPopup from './effects/achievementPopup.js';
import engagementWidget from './effects/engagementWidget.js';
import npcDialogue from './effects/npcDialogue.js';
import cookieRespawn from './effects/cookieRespawn.js';
import stuckLoadingBar from './effects/stuckLoadingBar.js';
import fakeBadges from './effects/fakeBadges.js';
import looksmaxxingBadge from './effects/looksmaxxingBadge.js';
import sparkleScatter from './effects/sparkleScatter.js';
import skillsRatings from './effects/skillsRatings.js';
import inflatedYears from './effects/inflatedYears.js';
import wingdingsContact from './effects/wingdingsContact.js';
import emojiBullets from './effects/emojiBullets.js';
import refsRoast from './effects/refsRoast.js';
import avatarRotate from './effects/avatarRotate.js';
import avatarScatter from './effects/avatarScatter.js';
import avatarPosition from './effects/avatarPosition.js';
import customCursor from './effects/customCursor.js';
import sectionWobble from './effects/sectionWobble.js';
import sectionVariety from './effects/sectionVariety.js';
import numberedList from './effects/numberedList.js';
import absurdHeading from './effects/absurdHeading.js';
import pageBackground from './effects/pageBackground.js';
import konamiMaxChaos from './effects/konamiMaxChaos.js';
import italianMascotInvasion from './effects/italianMascotInvasion.js';

export const EFFECTS = [
  // Page-level setup first.
  pageBackground,
  // Variety/positioning effects run early so later transforms can stack on top.
  sectionVariety,
  avatarPosition,
  // Heading-text rewrites must run before glitch/rainbow/strobe pick targets.
  absurdHeading,
  // Mark some sections as numbered before emojiBullets so the two are
  // mutually exclusive (emojiBullets skips numbered sections).
  numberedList,
  // Word/heading transformations.
  zoomPulse,
  randomCaps,
  markHighlight,
  strikethrough,
  citationNeeded,
  glitch,
  rainbow,
  wingdingsFlicker,
  fakeSpellcheck,
  randomRotation,
  strobeHeading,
  colorShift,
  letterSpread,
  boldRandom,
  precipitation,
  // Layout / skill cloud.
  marqueeBanner,
  brainrotMarquee,
  tableSection,
  watermark,
  wordCloud,
  // Floating UI.
  achievementPopup,
  engagementWidget,
  npcDialogue,
  cookieRespawn,
  stuckLoadingBar,
  fakeBadges,
  looksmaxxingBadge,
  sparkleScatter,
  italianMascotInvasion,
  // Section-specific roasts.
  skillsRatings,
  inflatedYears,
  wingdingsContact,
  emojiBullets,
  refsRoast,
  // Avatar effects (rotate + scatter run after position).
  avatarRotate,
  avatarScatter,
  // Interactions.
  customCursor,
  sectionWobble,
  konamiMaxChaos,
];
