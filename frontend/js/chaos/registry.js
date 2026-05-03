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
// import mixedFonts from './effects/mixedFonts.js';     // disabled — destroys readability
import marqueeBanner from './effects/marqueeBanner.js';
import tableSection from './effects/tableSection.js';
import watermark from './effects/watermark.js';
// import cyclingBg from './effects/cyclingBg.js';        // disabled — dominates the page
import wordCloud from './effects/wordCloud.js';
import achievementPopup from './effects/achievementPopup.js';
import engagementWidget from './effects/engagementWidget.js';
import cookieRespawn from './effects/cookieRespawn.js';
import stuckLoadingBar from './effects/stuckLoadingBar.js';
import fakeBadges from './effects/fakeBadges.js';
import sparkleScatter from './effects/sparkleScatter.js';
import skillsRatings from './effects/skillsRatings.js';
import inflatedYears from './effects/inflatedYears.js';
import wingdingsContact from './effects/wingdingsContact.js';
import emojiBullets from './effects/emojiBullets.js';
import refsRoast from './effects/refsRoast.js';
import avatarRotate from './effects/avatarRotate.js';
import avatarScatter from './effects/avatarScatter.js';
import customCursor from './effects/customCursor.js';
import sectionWobble from './effects/sectionWobble.js';
import konamiMaxChaos from './effects/konamiMaxChaos.js';

export const EFFECTS = [
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
  marqueeBanner,
  tableSection,
  watermark,
  wordCloud,
  achievementPopup,
  engagementWidget,
  cookieRespawn,
  stuckLoadingBar,
  fakeBadges,
  sparkleScatter,
  skillsRatings,
  inflatedYears,
  wingdingsContact,
  emojiBullets,
  refsRoast,
  avatarRotate,
  avatarScatter,
  customCursor,
  sectionWobble,
  konamiMaxChaos,
];
