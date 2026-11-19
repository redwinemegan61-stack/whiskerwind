// Inline SVG icon set for Whiskerwind's UI (no network, no icon fonts).
const svg = (body: string, vb = '0 0 24 24') => `<svg class="ico" viewBox="${vb}" aria-hidden="true" focusable="false">${body}</svg>`;
const s = 'fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"';

export const ICON = {
  book: svg(`<path ${s} d="M3.5 5.5c3-1.4 5.8-1.2 8.5.6v13.4c-2.7-1.8-5.5-2-8.5-.6z"/><path ${s} d="M20.5 5.5c-3-1.4-5.8-1.2-8.5.6v13.4c2.7-1.8 5.5-2 8.5-.6z"/><path ${s} d="M15 9.5l1.5-.4M15 12.5l2.5-.5"/>`),
  glimmer: svg(`<defs><radialGradient id="gg" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#fff6c2"/><stop offset=".55" stop-color="#ffd24d"/><stop offset="1" stop-color="#e09a12"/></radialGradient></defs><circle cx="12" cy="12" r="10.5" fill="url(#gg)" stroke="#b9770a" stroke-width="1.4"/><path d="M12 5.2l1.7 4.6 4.6 1.7-4.6 1.7L12 17.8l-1.7-4.6-4.6-1.7 4.6-1.7z" fill="#fff" opacity=".95"/>`),
  heart: svg(`<path d="M12 20.5s-7.5-4.6-9.2-9.3C1.6 7.8 3.9 4.5 7.3 4.5c2 0 3.6 1.1 4.7 2.7 1.1-1.6 2.7-2.7 4.7-2.7 3.4 0 5.7 3.3 4.5 6.7-1.7 4.7-9.2 9.3-9.2 9.3z" fill="currentColor"/>`),
  drop: svg(`<path d="M12 2.8s6.5 7.1 6.5 11.6a6.5 6.5 0 01-13 0C5.5 9.9 12 2.8 12 2.8z" fill="currentColor"/>`),
  star: svg(`<path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z" fill="currentColor"/>`),
  bag: svg(`<path ${s} d="M6 8h12l1 12.5H5z"/><path ${s} d="M9 8V6.5a3 3 0 016 0V8"/><path ${s} d="M9 12.5h6"/>`),
  cards: svg(`<rect ${s} x="3" y="6" width="11" height="15" rx="2" transform="rotate(-10 8.5 13.5)"/><rect ${s} x="10" y="3.5" width="11" height="15" rx="2" transform="rotate(8 15.5 11)"/>`),
  stall: svg(`<path ${s} d="M3 9l2-5h14l2 5"/><path ${s} d="M3 9c0 1.7 1.3 3 3 3s3-1.3 3-3c0 1.7 1.3 3 3 3s3-1.3 3-3c0 1.7 1.3 3 3 3s3-1.3 3-3"/><path ${s} d="M5 12v8h14v-8M10 20v-5h4v5"/>`),
  hammer: svg(`<path ${s} d="M14 4l6 6-2.5 2.5-6-6z"/><path ${s} d="M12.5 7.5L4 16a2.1 2.1 0 003 3l8.5-8.5"/>`),
  help: svg(`<circle ${s} cx="12" cy="12" r="9.5"/><path ${s} d="M9.3 9.2a2.8 2.8 0 015.4 1c0 1.9-2.7 2.4-2.7 4.1"/><circle cx="12" cy="17.6" r="1.3" fill="currentColor"/>`),
  gear: svg(`<circle ${s} cx="12" cy="12" r="3"/><path ${s} stroke-width="2" d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z"/>`),
  close: svg(`<path ${s} stroke-width="3" d="M6 6l12 12M18 6L6 18"/>`),
  pin: svg(`<path d="M12 22s-7-7.2-7-12.2a7 7 0 0114 0C19 14.8 12 22 12 22z" fill="currentColor"/><circle cx="12" cy="9.8" r="2.6" fill="#fff"/>`),
  bolt: svg(`<path d="M13.5 2L4.5 13.5h6L9.5 22l9-11.5h-6z" fill="currentColor"/>`),
  shield: svg(`<path d="M12 2.5l8 3v6.2c0 4.8-3.4 8.4-8 9.8-4.6-1.4-8-5-8-9.8V5.5z" fill="currentColor"/>`),
  sword: svg(`<path ${s} d="M14.5 4H20v5.5L10 19.5 4.5 14z"/><path ${s} d="M7 12.5l4.5 4.5M3.5 20.5l3-3"/>`),
  feed: svg(`<path ${s} d="M4 5h16v11H9l-5 4z"/><path ${s} d="M8 9h8M8 12.5h5"/>`),
  check: svg(`<path ${s} stroke-width="3" d="M5 12.5l4.5 4.5L19 7.5"/>`),
  rotate: svg(`<path ${s} d="M20 12a8 8 0 11-2.4-5.7"/><path ${s} d="M20 4v5h-5"/>`),
  trash: svg(`<path ${s} d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13"/>`),
  paw: svg(`<ellipse cx="12" cy="15.5" rx="5" ry="4.2" fill="currentColor"/><ellipse cx="5.6" cy="10.2" rx="2.1" ry="2.6" fill="currentColor"/><ellipse cx="9.3" cy="6.3" rx="2.1" ry="2.7" fill="currentColor"/><ellipse cx="14.7" cy="6.3" rx="2.1" ry="2.7" fill="currentColor"/><ellipse cx="18.4" cy="10.2" rx="2.1" ry="2.6" fill="currentColor"/>`),
  swap: svg(`<path ${s} d="M4 8h14l-3.5-3.5M20 16H6l3.5 3.5"/>`),
  save: svg(`<path ${s} d="M5 4h11l3 3v13H5z"/><path ${s} d="M8 4v5h7V4M8 20v-6h8v6"/>`),
};
export const STAT_ICON = { pow: '💪', mag: '🔮', sen: '👁️', chr: '💗' } as const;
export const ANIMAL_ICON = { rabbit: '🐰', bear: '🐻', fox: '🦊', cat: '🐱' } as const;
export const glim = (n: number | string) => `<span class="glim">${ICON.glimmer}<b>${typeof n === 'number' ? n.toLocaleString() : n}</b></span>`;
