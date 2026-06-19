// Rank art registry — Ideogram-generated banner + arena background
// PNGs, keyed by the backend's `emblem_key` so /ranks responses can
// look them up directly. Banners are 3:1 horizontal rank plaques;
// backgrounds are 9:16 mobile-game arena scenes (with a low-contrast
// center so UI overlays read cleanly).

export const RANK_BANNERS = {
  gambler:      require('../../assets/ranks/transparent/gambler-banner.png'),
  retail:       require('../../assets/ranks/transparent/retail-banner.png'),
  developing:   require('../../assets/ranks/transparent/developing-banner.png'),
  disciplined:  require('../../assets/ranks/transparent/disciplined-banner.png'),
  consistent:   require('../../assets/ranks/transparent/consistent-banner.png'),
  professional: require('../../assets/ranks/transparent/professional-banner.png'),
  elite:        require('../../assets/ranks/transparent/elite-banner.png'),
};

export const RANK_BACKGROUNDS = {
  gambler:      require('../../assets/ranks/gambler-bg.png'),
  retail:       require('../../assets/ranks/retail-bg.png'),
  developing:   require('../../assets/ranks/developing-bg.png'),
  disciplined:  require('../../assets/ranks/disciplined-bg.png'),
  consistent:   require('../../assets/ranks/consistent-bg.png'),
  professional: require('../../assets/ranks/professional-bg.png'),
  elite:        require('../../assets/ranks/elite-bg.png'),
};

// Square 1:1 rank emblem icons. Use for compact headers, leaderboard rows,
// and anywhere we need the emblem standalone (not as a horizontal plaque).
export const RANK_ICONS = {
  gambler:      require('../../assets/ranks/icons/gambler-icon.png'),
  retail:       require('../../assets/ranks/icons/retail-icon.png'),
  developing:   require('../../assets/ranks/icons/developing-icon.png'),
  disciplined:  require('../../assets/ranks/icons/disciplined-icon.png'),
  consistent:   require('../../assets/ranks/icons/consistent-icon.png'),
  professional: require('../../assets/ranks/icons/professional-icon.png'),
  elite:        require('../../assets/ranks/icons/elite-icon.png'),
};

// Primary glow color per rank. Used as the soft colored haze rendered
// over the nameplate band (Journey screen) so each band reads as that
// rank's identity instead of a generic black strip. Hand-tune freely;
// the file is the single source of truth.
export const RANK_COLORS: Record<keyof typeof RANK_BANNERS, string> = {
  gambler:      '#E04444',  // red
  retail:       '#3FB85E',  // emerald green
  developing:   '#3D7BE0',  // electric blue
  disciplined:  '#7D4FD8',  // royal purple
  consistent:   '#3FB5B5',  // teal
  professional: '#E6A140',  // amber / warm gold
  elite:        '#FFE066',  // bright gold
};

export type EmblemKey = keyof typeof RANK_BANNERS;
