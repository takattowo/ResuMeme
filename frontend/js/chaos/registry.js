// To register a new chaos effect:
//   1. Create a file in ./effects/<name>.js with a default export
//      matching the EffectModule shape (see orchestrator.js).
//   2. Add an import below and append it to EFFECTS.
//
// Each effect runs once per page load. The orchestrator queries DOM
// targets matching effect.targets and applies effect.apply() to a
// random subset selected via effect.density.

export const EFFECTS = [];
