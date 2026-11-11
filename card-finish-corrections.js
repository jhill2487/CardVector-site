/* Reviewed card printing corrections. No price or identity changes.
 * Electrode Team Up #39 (sm9-39): Holofoil and Reverse Holofoil.
 * Evidence: independent Holofoil/Reverse Holofoil printings documented by
 * holofile.app/pokemon/sets/sun-moon/team-up/39-electrode,
 * tcg.directory/card/18381201/electrode, mydextcg.com/cards/sm9-39.
 * Source data may be corrected upstream later; review override periodically.
 */
(() => {
  "use strict";
  const overrides = Object.freeze({
    "sm9-39": Object.freeze(["holo", "reverse"])
  });
  window.CardVectorFinishCorrections = Object.freeze({
    forCard(id) {
      const key = String(id || "").toLowerCase();
      return overrides[key] ? [...overrides[key]] : null;
    }
  });
})();
