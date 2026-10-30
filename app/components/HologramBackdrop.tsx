import { memo } from "react";
// The owner reference supplies the star field. No legacy pedestal/grid behind it.
function HologramBackdrop() { return <div className="jk-backdrop" aria-hidden="true" />; }
export default memo(HologramBackdrop);
