// Scoped HUD stylesheet, injected once into <head> with a w3d- prefix on every class.
const CSS = `
.w3d-host{position:relative;overflow:hidden;background:#000;touch-action:none;user-select:none;-webkit-user-select:none;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#fff}
.w3d-canvas{display:block;width:100%;height:100%;outline:none}
.w3d-labels{position:absolute;inset:0;z-index:0;pointer-events:none}
.w3d-lab{padding:2px 8px;border-radius:999px;background:rgba(8,12,22,.7);color:#fff;font:700 12px system-ui,sans-serif;white-space:nowrap;border:1px solid rgba(255,255,255,.18)}
.w3d-lab.w3d-st{background:rgba(8,12,22,.5);font-weight:600;font-size:11px}
.w3d-lab.w3d-st[data-alert="true"]{background:rgba(170,20,20,.85);border-color:#ffb4a8}
.w3d-tag{pointer-events:auto;cursor:pointer;display:grid;justify-items:center;align-content:center;gap:1px;min-width:72px;min-height:44px;padding:4px 12px;border:1px solid var(--line-strong,rgba(56,189,248,.6));border-radius:2px;background:var(--surface,rgba(6,11,20,.85));color:var(--text,#e6f1ff);font:700 15px/1.2 var(--font-mono,"JetBrains Mono",ui-monospace,monospace);white-space:nowrap;text-shadow:none;transition:opacity .25s,border-color .15s}
.w3d-tag:hover{border-color:var(--cyan-bright,#8bdcff);background:rgba(10,24,40,.95)}
.w3d-tag:focus-visible{outline:3px solid #ffd23f;outline-offset:3px;opacity:1!important}
.w3d-tag-top{display:flex;align-items:center;gap:6px}
.w3d-tag-star{display:none;color:#ffd23f}
.w3d-tag[data-player="true"]{border-color:#ffd23f}
.w3d-tag[data-player="true"] .w3d-tag-star{display:inline}
.w3d-tag-role{font:400 12px/1.2 var(--font-body,"Atkinson Hyperlegible",system-ui,sans-serif);letter-spacing:.06em;text-transform:uppercase;color:var(--text-dim,#9fb3c8)}
.w3d-tag-warn{display:none;width:18px;height:18px;border-radius:50%;place-items:center;background:var(--warn,#fbbf24);color:#1a1200;font:900 13px/1 system-ui,sans-serif}
.w3d-tag[data-low="true"]{border-color:var(--warn,#fbbf24)}
.w3d-tag[data-low="true"] .w3d-tag-warn{display:inline-grid}
.w3d-host[data-cinematic="true"] .w3d-tag{display:none!important}
.w3d-root{position:absolute;inset:0;pointer-events:none;font-size:14px;line-height:1.3;text-shadow:0 1px 2px rgba(0,0,0,.6)}
.w3d-root button{font:inherit;color:inherit;cursor:pointer}
.w3d-panel{background:rgba(12,16,28,.62);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);border:1px solid rgba(255,255,255,.14);border-radius:12px;box-shadow:0 4px 18px rgba(0,0,0,.35)}
.w3d-tl{position:absolute;left:12px;top:12px;padding:8px 12px;min-width:210px}
.w3d-sol{font-weight:800;font-size:15px;letter-spacing:.02em}
.w3d-time{opacity:.85;font-variant-numeric:tabular-nums}
.w3d-sunbar{position:relative;height:10px;margin-top:6px;border-radius:6px;background:linear-gradient(90deg,#3a4a7a 0%,#f2c46d 8%,#ffe9b0 50%,#f2a65a 80%,#c0392b 92%,#1c2340 100%)}
.w3d-sunbar i{position:absolute;top:50%;width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;background:#fff6c8;box-shadow:0 0 10px 3px rgba(255,220,120,.9);font-style:normal}
.w3d-sunbar b{position:absolute;top:-3px;bottom:-3px;left:80%;border-left:2px dashed rgba(255,255,255,.75)}
.w3d-obj{position:absolute;left:50%;top:12px;transform:translateX(-50%);padding:8px 14px;max-width:min(420px,46vw)}
.w3d-obj h3{margin:0 0 4px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;opacity:.75}
.w3d-obj ul{list-style:none;margin:0;padding:0}
.w3d-obj li{display:flex;gap:6px;align-items:baseline;padding:1px 0}
.w3d-obj li[data-done="true"]{opacity:.6;text-decoration:line-through}
.w3d-obj li[data-urgent="true"]:not([data-done="true"]){color:#ffd0c4;font-weight:700}
.w3d-obj .w3d-ck{width:16px;text-align:center;font-weight:900}
.w3d-tr{position:absolute;right:12px;top:12px;display:flex;flex-direction:column;gap:8px;align-items:flex-end}
.w3d-map{width:150px;height:150px;display:block;border-radius:50%}
.w3d-rank{padding:6px 10px;min-width:150px}
.w3d-rank .w3d-bar{height:6px;border-radius:4px;background:rgba(255,255,255,.18);margin-top:4px;overflow:hidden}
.w3d-rank .w3d-bar>span{display:block;height:100%;background:linear-gradient(90deg,#7fe3ff,#b388ff);transition:width .4s}
.w3d-combo{font-weight:900;color:#ffd23f;font-size:13px}
.w3d-roster{position:absolute;left:12px;top:110px;display:flex;flex-direction:column;gap:6px;pointer-events:auto}
.w3d-chip{display:grid;grid-template-columns:30px 1fr 22px;gap:6px;align-items:center;padding:6px 8px;min-width:190px;border-radius:10px;border:1px solid rgba(255,255,255,.14);background:rgba(12,16,28,.55);text-align:left}
.w3d-chip[aria-pressed="true"]{border-color:#7fe3ff;box-shadow:0 0 0 2px rgba(127,227,255,.4);background:rgba(20,40,70,.75)}
.w3d-chip .w3d-av{font-size:22px}
.w3d-chip small{display:block;opacity:.75;font-size:11px}
.w3d-mini{display:flex;gap:3px;margin-top:3px}
.w3d-mini span{height:4px;flex:1;border-radius:2px;background:rgba(255,255,255,.2);overflow:hidden}
.w3d-mini span>i{display:block;height:100%}
.w3d-suit{position:absolute;left:12px;bottom:12px;padding:10px 12px;display:flex;gap:12px;align-items:center}
.w3d-gauge{--v:100;width:62px;height:62px;border-radius:50%;display:grid;place-items:center;background:conic-gradient(var(--c,#3ddc84) calc(var(--v)*1%),rgba(255,255,255,.12) 0)}
.w3d-gauge>div{width:48px;height:48px;border-radius:50%;background:rgba(10,14,24,.9);display:grid;place-items:center;font-weight:800;font-size:13px;font-variant-numeric:tabular-nums}
.w3d-suit dl{margin:0;display:grid;grid-template-columns:auto auto;gap:2px 8px;font-size:12px}
.w3d-suit dt{opacity:.7}.w3d-suit dd{margin:0;font-weight:700;font-variant-numeric:tabular-nums}
.w3d-bottom{position:absolute;left:50%;bottom:16px;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:8px;width:min(640px,70vw)}
.w3d-radio{padding:8px 14px;border-radius:10px;background:rgba(6,10,20,.78);border-left:4px solid #7fe3ff;opacity:0;transition:opacity .25s;max-width:100%}
.w3d-radio.w3d-on{opacity:1}
.w3d-radio[data-tone="alert"]{border-left-color:#ff5d5d}
.w3d-caption{font-size:12px;opacity:.85;font-style:italic;min-height:1em}
.w3d-prompt{display:none;padding:8px 14px;align-items:center;gap:10px;pointer-events:auto;flex-wrap:wrap;justify-content:center}
.w3d-prompt.w3d-on{display:flex}
.w3d-key{display:inline-grid;place-items:center;min-width:26px;height:26px;padding:0 6px;border-radius:6px;background:#fff;color:#111;font-weight:900;text-shadow:none;box-shadow:0 2px 0 #999}
.w3d-alt{padding:4px 10px;border-radius:8px;border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.08)}
.w3d-why{font-size:12px;opacity:.9;background:none;border:0;text-decoration:underline dotted;padding:0}
.w3d-ring{position:absolute;left:50%;top:50%;width:84px;height:84px;margin:-42px 0 0 -42px;display:none}
.w3d-ring.w3d-on{display:block}
.w3d-toasts{position:absolute;left:50%;top:30%;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:6px}
.w3d-toast{padding:8px 16px;border-radius:999px;background:rgba(12,16,28,.85);border:1px solid rgba(255,255,255,.2);font-weight:700;animation:w3d-pop .25s ease-out}
.w3d-toast[data-tone="good"]{border-color:#3ddc84}.w3d-toast[data-tone="bad"]{border-color:#ff5d5d}
.w3d-alert{position:absolute;left:50%;top:132px;transform:translateX(-50%);display:none;padding:10px 18px;border-radius:12px;background:rgba(160,20,20,.88);border:2px solid #ffb4a8;font-weight:900;font-size:16px;text-align:center;animation:w3d-pulse 1s infinite}
.w3d-alert.w3d-on{display:block}
.w3d-alert[data-kind="info"]{background:rgba(150,90,20,.88);border-color:#ffd9a0;animation:none}
.w3d-vig{position:absolute;inset:0;pointer-events:none;opacity:0;background:radial-gradient(ellipse at center,rgba(0,0,0,0) 45%,rgba(200,0,0,.65) 100%);transition:opacity .3s}
.w3d-flash{position:absolute;inset:0;pointer-events:none;opacity:0;background:#fff}
.w3d-float{position:absolute;font-weight:900;font-size:18px;color:#ffe066;pointer-events:none;transform:translate(-50%,-50%);animation:w3d-rise 1.4s ease-out forwards;white-space:nowrap}
.w3d-btns{position:absolute;right:12px;bottom:12px;display:flex;gap:6px;pointer-events:auto}
.w3d-btn{width:42px;height:42px;border-radius:10px;border:1px solid rgba(255,255,255,.2);background:rgba(12,16,28,.65);font-size:18px}
.w3d-btn:focus-visible,.w3d-chip:focus-visible,.w3d-modal button:focus-visible{outline:3px solid #ffd23f;outline-offset:2px}
.w3d-touch{display:none}
.w3d-host[data-touch="true"] .w3d-touch{display:block}
.w3d-host[data-touch="true"] .w3d-suit{bottom:150px}
.w3d-joy{position:absolute;left:24px;bottom:24px;width:110px;height:110px;border-radius:50%;background:rgba(255,255,255,.12);border:2px solid rgba(255,255,255,.3);pointer-events:auto;touch-action:none}
.w3d-joy>i{position:absolute;left:50%;top:50%;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;background:rgba(255,255,255,.55)}
.w3d-act{position:absolute;right:24px;bottom:70px;width:84px;height:84px;border-radius:50%;border:2px solid #fff;background:rgba(127,227,255,.35);font-weight:900;font-size:22px;pointer-events:auto;touch-action:none}
.w3d-layer{position:absolute;inset:0;display:none;place-items:center;pointer-events:auto;background:rgba(0,0,0,.35)}
.w3d-layer.w3d-on{display:grid}
.w3d-modal{width:min(560px,92vw);max-height:88vh;overflow:auto;padding:18px 20px;border-radius:16px;background:rgba(14,20,36,.96);border:1px solid rgba(255,255,255,.18);box-shadow:0 12px 40px rgba(0,0,0,.5);text-shadow:none}
.w3d-modal h2{margin:0 0 6px;font-size:20px}
.w3d-modal p{margin:6px 0}
.w3d-modal .w3d-row{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;margin-top:14px}
.w3d-modal button.w3d-b{padding:9px 16px;border-radius:10px;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.08);font-weight:700}
.w3d-modal button.w3d-primary{background:#2f80ed;border-color:#5aa0ff}
.w3d-modal table{width:100%;border-collapse:collapse;font-size:14px}
.w3d-modal td{padding:4px 0;border-bottom:1px solid rgba(255,255,255,.08)}
.w3d-modal td:last-child{text-align:right;font-weight:700}
.w3d-kbd td:first-child{width:45%;opacity:.8}
.w3d-mg canvas{display:block;width:100%;border-radius:10px;background:#111;touch-action:none}
.w3d-mg .w3d-meter{position:relative;height:28px;border-radius:8px;background:rgba(255,255,255,.12);overflow:hidden;margin:8px 0}
.w3d-mg .w3d-meter>.w3d-zone{position:absolute;top:0;bottom:0;background:repeating-linear-gradient(45deg,#2fbf71,#2fbf71 6px,#27a862 6px,#27a862 12px)}
.w3d-mg .w3d-meter>.w3d-fill{position:absolute;left:0;top:0;bottom:0;background:#4da3ff}
.w3d-mg .w3d-meter>.w3d-needle{position:absolute;top:-2px;bottom:-2px;width:4px;margin-left:-2px;background:#fff;box-shadow:0 0 6px #fff}
.w3d-mg .w3d-meter>.w3d-heat{position:absolute;left:0;top:0;bottom:0;background:linear-gradient(90deg,#ffd23f,#ff5d5d)}
.w3d-mg .w3d-timer{height:4px;border-radius:2px;background:rgba(255,255,255,.15);overflow:hidden;margin:6px 0}
.w3d-mg .w3d-timer>i{display:block;height:100%;background:#ffd23f}
.w3d-mg .w3d-hint{font-size:13px;opacity:.85}
.w3d-mg .w3d-grid{display:grid;gap:8px}
.w3d-mg .w3d-wire{padding:10px;border-radius:10px;border:2px solid rgba(255,255,255,.25);background:rgba(255,255,255,.06);font-size:16px;font-weight:800}
.w3d-mg .w3d-wire[aria-pressed="true"]{border-color:#ffd23f}
.w3d-mg .w3d-wire[data-done="true"]{opacity:.45}
.w3d-fact{display:flex;gap:12px;align-items:flex-start;margin-top:10px;padding:10px;border-radius:12px;background:rgba(127,227,255,.1);border:1px solid rgba(127,227,255,.35)}
.w3d-fact>span{font-size:32px}
.w3d-level{position:absolute;inset:0;display:none;place-items:center;pointer-events:none}
.w3d-level.w3d-on{display:grid}
.w3d-level>div{text-align:center;animation:w3d-zoom 2.6s ease-out forwards}
.w3d-level b{display:block;font-size:64px}
.w3d-level strong{display:block;font-size:34px;letter-spacing:.06em;color:#ffe066;text-shadow:0 0 18px rgba(255,200,60,.8)}
.w3d-cut{position:absolute;left:0;right:0;height:11%;background:#000;pointer-events:none;transition:transform .6s}
.w3d-cut.w3d-top{top:0;transform:translateY(-100%)}.w3d-cut.w3d-bot{bottom:0;transform:translateY(100%)}
.w3d-host[data-cinematic="true"] .w3d-cut{transform:none}
.w3d-host[data-cinematic="true"] .w3d-hide-cine{display:none}
.w3d-skip{position:absolute;right:16px;bottom:13%;pointer-events:auto;padding:8px 14px;border-radius:999px;border:1px solid #fff;background:rgba(0,0,0,.5);display:none}
.w3d-host[data-cinematic="true"] .w3d-skip{display:block}
.w3d-title{position:absolute;left:0;right:0;top:40%;text-align:center;font-size:30px;font-weight:900;letter-spacing:.08em;opacity:0;transition:opacity 1s;pointer-events:none}
.w3d-title.w3d-on{opacity:1}
.w3d-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
@keyframes w3d-pop{from{transform:scale(.7);opacity:0}to{transform:scale(1);opacity:1}}
@keyframes w3d-pulse{50%{transform:translateX(-50%) scale(1.04)}}
@keyframes w3d-rise{from{opacity:1;margin-top:0}to{opacity:0;margin-top:-60px}}
@keyframes w3d-zoom{0%{transform:scale(.3);opacity:0}15%{transform:scale(1.15);opacity:1}25%{transform:scale(1)}80%{opacity:1}100%{opacity:0}}
.w3d-host[data-motion="reduced"] *{animation-duration:.01s!important;transition:none!important}
@media (max-width:760px){.w3d-roster{top:92px;flex-direction:row;left:8px;right:8px;overflow-x:auto}.w3d-chip{min-width:132px;padding:4px 6px}.w3d-obj{top:186px;left:8px;transform:none;max-width:62vw;padding:6px 10px;font-size:12px}.w3d-tl{left:8px;top:8px;min-width:0;max-width:calc(100% - 128px)}.w3d-tr{right:8px;top:8px}.w3d-map{width:92px;height:92px}.w3d-rank{display:none}.w3d-bottom{bottom:90px;width:calc(100% - 16px)}.w3d-suit{left:8px;bottom:8px;padding:6px 10px}.w3d-host[data-touch="true"] .w3d-bottom{bottom:240px}}
`;

let injected = 0;

export function injectStyles() {
  injected += 1;
  if (document.getElementById('w3d-styles')) return;
  const style = document.createElement('style');
  style.id = 'w3d-styles';
  style.textContent = CSS;
  document.head.appendChild(style);
}

export function releaseStyles() {
  injected = Math.max(0, injected - 1);
  if (injected === 0) document.getElementById('w3d-styles')?.remove();
}
