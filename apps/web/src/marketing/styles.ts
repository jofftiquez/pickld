import { colors, radius } from '@/theme/tokens';

// The marketing pages' stylesheet, built from the app's tokens so no color or radius is hard-coded. One
// small inline <style> (no extra request); media queries do the phone-to-desktop layout, and motion only
// runs when the visitor hasn't asked to reduce it (AGENTS rule 11).
export const css = `
.mk{background:${colors.background};min-height:100vh;display:flex;flex-direction:column}
.mk *{box-sizing:border-box}
.mk img{display:block;max-width:100%;height:auto}
.mk-sr{position:absolute;width:1px;height:1px;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.mk-skip{position:absolute;left:12px;top:-60px;z-index:10;background:${colors.ink};color:${colors.surface}!important;padding:10px 14px;border-radius:${radius.thumbLg}px;font-weight:800}
.mk-skip:focus{top:12px}
.mk a:focus-visible,.mk button:focus-visible,.mk summary:focus-visible,.mk input:focus-visible{outline:3px solid ${colors.brandLink};outline-offset:2px}
.mk-wrap{width:100%;max-width:1120px;margin:0 auto;padding:0 20px}
.mk-top{background:${colors.surface};border-bottom:1px solid ${colors.divider}}
.mk-top .mk-wrap{display:flex;align-items:center;justify-content:space-between;gap:12px;height:64px}
.mk-nav{display:flex;align-items:center;gap:6px;list-style:none;margin:0;padding:0}
.mk-nav a{display:flex;align-items:center;min-height:44px;padding:0 10px;color:${colors.ink};text-decoration:none;font-weight:700;font-size:14px}
.mk-nav .mk-faq-link{display:none}
@media (min-width:480px){.mk-nav .mk-faq-link{display:flex}}
.mk-btn{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:0 22px;border:0;border-radius:${radius.pill}px;background:${colors.brand};color:${colors.surface}!important;font:inherit;font-weight:800;font-size:15px;text-decoration:none;cursor:pointer}
.mk-nav .mk-btn{min-height:40px;padding:0 16px;font-size:13px;margin-left:4px}
.mk .mk-eyebrow{display:inline-block;margin:0 0 14px;padding:6px 12px;border-radius:${radius.pill}px;background:${colors.brandTint};color:${colors.brandText};font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}
.mk h1,.mk h2,.mk h3{color:${colors.ink};margin:0;font-weight:800}
.mk h1{font-size:clamp(42px,10vw,76px);line-height:1.02;letter-spacing:-.04em}
.mk h1 span{color:${colors.brandText}}
.mk h2{font-size:clamp(30px,6vw,46px);line-height:1.08;letter-spacing:-.035em}
.mk h3{font-size:19px;line-height:1.25;letter-spacing:-.01em}
.mk p{margin:0;color:${colors.inkSoft};font-size:16px;line-height:1.55}
.mk-lead{font-size:18px!important;max-width:34em}
.mk-hero{display:grid;gap:40px;padding-top:40px;padding-bottom:56px;align-items:center}
.mk-hero .mk-lead{margin-top:18px}
.mk-form{margin-top:26px;max-width:460px}
.mk-form label{display:block;font-size:13px;font-weight:700;color:${colors.ink};margin-bottom:6px}
.mk-form-row{display:flex;flex-wrap:wrap;gap:10px}
.mk-input{flex:1 1 220px;min-height:48px;padding:0 16px;border:1px solid ${colors.border};border-radius:${radius.pill}px;background:${colors.surface};color:${colors.ink};font:inherit;font-size:16px}
.mk-form .mk-btn{flex:1 0 auto}
.mk-form-note{margin-top:10px!important;font-size:13px!important;color:${colors.muted}!important}
.mk-dark .mk-form label{color:${colors.surface}}
.mk-dark .mk-form-note{color:${colors.onDarkMuted}!important}
.mk-art{position:relative;display:flex;justify-content:center;padding:10px 0}
.mk-phone{position:relative;width:min(290px,76vw);border:8px solid ${colors.ink};border-radius:44px;overflow:hidden;background:${colors.ink};box-shadow:0 24px 60px -24px ${colors.scrim}}
.mk-phone img{width:100%}
.mk-phone-sm{width:min(250px,70vw)}
.mk-float{position:absolute;width:clamp(78px,22vw,120px);filter:drop-shadow(0 8px 14px ${colors.textShadow})}
.mk-float-a{top:-6px;left:calc(50% - min(290px,76vw)/2 - 44px);transform:rotate(-10deg)}
.mk-float-b{bottom:2%;right:calc(50% - min(290px,76vw)/2 - 40px);transform:rotate(8deg)}
.mk-section{padding:64px 0}
.mk-head{max-width:640px;margin-bottom:32px}
.mk-head p{margin-top:14px}
.mk-chips{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;list-style:none;margin:0;padding:0}
.mk-chip{background:${colors.surface};border-radius:${radius.banner}px;padding:16px;display:flex;flex-direction:column;gap:6px}
.mk-chip b{color:${colors.brandText};font-size:16px;font-weight:800}
.mk-chip span{color:${colors.muted};font-size:14px;line-height:1.35}
.mk-steps{display:grid;gap:20px;list-style:none;margin:0;padding:0}
.mk-step{background:${colors.surface};border-radius:${radius.card}px;padding:28px 20px 0;display:flex;flex-direction:column;gap:10px;overflow:hidden}
.mk-step .mk-phone{margin:14px auto -60px;width:min(240px,64vw)}
.mk-dark{background:${colors.ink}}
.mk-dark h2,.mk-dark h3{color:${colors.surface}}
.mk-dark p{color:${colors.onDarkMuted}}
.mk-dark a:not(.mk-btn){color:${colors.surface}}
.mk-split{display:grid;gap:40px;align-items:center}
.mk-olivia{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;list-style:none;margin:28px 0;padding:0}
.mk-olivia li{background:${colors.surface};border-radius:${radius.banner}px;padding:8px;aspect-ratio:1;display:flex;align-items:center;justify-content:center}
.mk-olivia img{max-height:100%;width:auto}
.mk-link{display:inline-flex;align-items:center;min-height:44px;font-weight:800;font-size:16px}
.mk-cards{display:grid;gap:14px;list-style:none;margin:0;padding:0}
.mk-card{background:${colors.surface};border-radius:${radius.card}px;padding:22px;display:flex;flex-direction:column;gap:8px}
.mk-card .mk-pill{align-self:flex-start;padding:5px 12px;border-radius:${radius.pill}px;background:${colors.brandTint};color:${colors.brandText};font-weight:800;font-size:13px}
.mk-note{margin-top:18px!important;font-size:15px!important}
.mk-pair{display:flex;justify-content:center;gap:16px}
.mk-pair .mk-phone{width:min(230px,42vw);border-width:6px;border-radius:34px}
.mk-pair .mk-phone:last-child{margin-top:40px}
.mk-faq{display:flex;flex-direction:column;gap:10px;max-width:760px}
.mk-faq details{background:${colors.surface};border-radius:${radius.banner}px}
.mk-faq summary{cursor:pointer;list-style:none;display:flex;justify-content:space-between;align-items:center;gap:12px;min-height:56px;padding:14px 18px;font-weight:800;font-size:17px;color:${colors.ink}}
.mk-faq summary::-webkit-details-marker{display:none}
.mk-faq summary::after{content:'+';font-size:24px;line-height:1;color:${colors.brandText}}
.mk-faq details[open] summary::after{content:'–'}
.mk-faq details p{padding:0 18px 18px}
.mk-final{border-radius:${radius.card}px;padding:36px 24px;display:flex;flex-direction:column;gap:12px}
.mk-final .mk-form{margin-top:12px}
.mk-foot{padding:40px 0 28px}
.mk-foot .mk-wrap{display:flex;flex-direction:column;gap:18px}
.mk-foot ul{display:flex;flex-wrap:wrap;gap:4px 18px;list-style:none;margin:0;padding:0}
.mk-foot a{display:inline-flex;align-items:center;min-height:44px;color:${colors.muted};font-size:14px;font-weight:700}
.mk-foot small{color:${colors.muted};font-size:13px}
.mk-packs{display:flex;flex-direction:column;gap:16px}
.mk-pack{background:${colors.surface};border-radius:${radius.card}px;padding:22px}
.mk-pack-head{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px}
.mk-pack-head p{flex-basis:100%;margin-top:4px}
.mk-kind{padding:4px 10px;border-radius:${radius.pill}px;background:${colors.subtle};color:${colors.ink};font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase}
.mk-kind-free{background:${colors.brandTint};color:${colors.brandText}}
.mk-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;list-style:none;margin:16px 0 0;padding:0}
.mk-grid li{background:${colors.subtle};border-radius:${radius.thumbLg}px;aspect-ratio:1;padding:10px;display:flex;align-items:center;justify-content:center}
.mk-grid img{max-height:100%;width:auto}
.mk-status{padding:56px 0 72px;max-width:620px}
.mk-status p{margin-top:12px}
@media (min-width:720px){
  .mk-chips{grid-template-columns:repeat(4,minmax(0,1fr))}
  .mk-cards{grid-template-columns:repeat(3,minmax(0,1fr))}
  .mk-grid{grid-template-columns:repeat(6,minmax(0,1fr))}
  .mk-olivia{grid-template-columns:repeat(8,minmax(0,1fr))}
  .mk-foot .mk-wrap{flex-direction:row;flex-wrap:wrap;justify-content:space-between;align-items:center}
}
@media (min-width:900px){
  .mk-hero{grid-template-columns:1.1fr .9fr;padding-top:72px;padding-bottom:88px}
  .mk-section{padding:96px 0}
  .mk-steps{grid-template-columns:repeat(3,minmax(0,1fr))}
  .mk-split{grid-template-columns:1fr 1fr;gap:64px}
  .mk-split-flip>:first-child{order:2}
  .mk-final{padding:56px;align-items:center;text-align:center}
  .mk-final .mk-form{margin-left:auto;margin-right:auto;width:100%}
  .mk-float-a{left:calc(50% - 215px)}
  .mk-float-b{right:calc(50% - 215px)}
  .mk-olivia{grid-template-columns:repeat(4,minmax(0,1fr))}
}
@media (prefers-reduced-motion:no-preference){
  html{scroll-behavior:smooth}
  .mk-btn{transition:transform .15s ease}
  .mk-btn:hover{transform:translateY(-1px)}
  .mk-float{animation:mk-bob 5s ease-in-out infinite}
  .mk-float-b{animation-delay:-2.5s}
  @keyframes mk-bob{50%{translate:0 -8px}}
}
`;
