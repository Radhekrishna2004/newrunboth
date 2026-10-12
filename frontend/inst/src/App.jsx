import { useState, useEffect, useCallback, useRef } from "react";
import girl from "./assets/girl.png";

/* ====== SETTINGS ====== */
// Backend ka address. Live karte waqt .env me VITE_API_URL=https://tumhara-backend.com do
const API = import.meta.env.VITE_API_URL || "http://localhost:8080";
// Reviews email pe aane ke liye: https://web3forms.com par apna email daalo -> access key milegi
const WEB3FORMS_KEY = "YOUR_WEB3FORMS_ACCESS_KEY";
// Sirf wahi reviews paste karo jo tumne email me padh ke approve kiye (real reviews hi)
const APPROVED_REVIEWS = [
  // { name: "Rahul", rating: 5, text: "Bahut fast download hua." },
];

/* ====== ADS (Google AdSense ka example; dusra network ho to AdSlot me apna code daalo) ====== */
const ADSENSE_CLIENT = ""; // jaise "ca-pub-1234567890123456". Khali hai to ad nahi dikhega
const ADSENSE_SLOT = ""; // ad unit ka slot id
const AD_PROBE_URL =
  "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js";
// Adblock wall: true = adblock wale ko "band karo" popup dikhao
const ADBLOCK_WALL = true;
// Testing ke waqt (npm run dev) wall nahi dikhta. Dev me bhi test karna ho to true karo
const WALL_IN_DEV = false;
const ENFORCE_ADBLOCK = ADBLOCK_WALL && (!import.meta.env.DEV || WALL_IN_DEV);

const INSTA_RE =
  /^https?:\/\/(www\.)?instagram\.com\/(reel|reels|p|tv|stories)\/.+/i;
const YT_RE =
  /^https?:\/\/(www\.|m\.)?(youtube\.com\/(watch|shorts)|youtu\.be\/).+/i;

const css = `
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap');
.fi *{box-sizing:border-box;margin:0;padding:0}
.fi{font-family:'Poppins',system-ui,sans-serif;color:#1a1a2e;min-height:100vh;padding:14px;
 background:radial-gradient(circle at 0% 20%,#c24bff 0,transparent 35%),radial-gradient(circle at 100% 10%,#ff5fa8 0,transparent 35%),linear-gradient(180deg,#e9d5ff,#fdf2f8)}
.fi .wrap{max-width:1180px;margin:0 auto}
.fi .card{background:#fff;border-radius:24px;box-shadow:0 10px 30px rgba(120,40,160,.12)}
.fi .pink{color:#f0146e}.fi .purple{color:#8b1fd6}
.fi nav{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:12px 24px;flex-wrap:wrap}
.fi .brand{display:flex;align-items:center;gap:10px;font-weight:800;line-height:1.1;font-size:20px}
.fi .logo{width:44px;height:44px;border-radius:12px;background:linear-gradient(45deg,#f9a825,#f0146e,#8b1fd6);display:grid;place-items:center}
.fi .links{display:flex;gap:28px;font-weight:500;font-size:15px;align-items:center}
.fi .links a{color:#1a1a2e;text-decoration:none;padding:8px 0;border-bottom:3px solid transparent}
.fi .links a.on{color:#f0146e;border-color:#f0146e}
.fi .hero{display:grid;grid-template-columns:1.25fr 1fr;gap:20px;padding:28px 24px 8px;align-items:center}
.fi .badge{display:inline-flex;gap:8px;background:#fde4ef;color:#f0146e;font-weight:600;font-size:14px;padding:6px 16px;border-radius:99px}
.fi h1{font-size:clamp(38px,6vw,68px);line-height:1.02;font-weight:800;margin:14px 0}
.fi .sub{font-size:19px;color:#5b5b73;max-width:560px}
.fi .bar{display:flex;margin-top:22px;max-width:600px}
.fi .bar .in{flex:1;display:flex;align-items:center;gap:10px;background:#fff;border:2px solid #6b2bd9;border-radius:14px 0 0 14px;padding:0 14px}
.fi .bar input{flex:1;border:0;outline:0;font:inherit;font-size:16px;padding:16px 0;min-width:0;background:transparent}
.fi .bar .x{border:0;background:none;cursor:pointer;font-size:18px;color:#888}
.fi .btn{border:0;cursor:pointer;color:#fff;font:inherit;font-weight:700;font-size:18px;padding:0 28px;border-radius:0 14px 14px 0;
 background:linear-gradient(90deg,#a21fe0,#ff4f6e,#ff8a3d)}
.fi .btn:disabled,.fi .qbtn:disabled{opacity:.6;cursor:wait}
.fi .btn:focus-visible,.fi input:focus-visible,.fi textarea:focus-visible,.fi button:focus-visible{outline:3px solid #f0146e;outline-offset:2px}
.fi .msg{margin-top:8px;font-size:14px;min-height:20px}
.fi .ex{font-size:13px;color:#666;margin-top:6px}
.fi .chips{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:20px}
.fi .chip{display:flex;align-items:center;gap:10px;background:#fff;border-radius:16px;padding:12px;font-size:14px;font-weight:600;line-height:1.25;box-shadow:0 4px 14px rgba(0,0,0,.06)}
.fi .ico{width:42px;height:42px;border-radius:50%;display:grid;place-items:center;font-size:20px;flex:none}
.fi .art{position:relative;min-height:380px}
.fi .person{position:absolute;left:0;top:10px;width:300px;height:340px;border-radius:50% 50% 30% 30%;
 background:linear-gradient(160deg,#ffb3d9,#e879c8);display:grid;place-items:center;text-align:center;color:#fff;font-weight:600;padding:20px}
.fi .ig{position:absolute;left:-20px;top:0;width:90px;height:90px;border-radius:24px;transform:rotate(-12deg);
 background:linear-gradient(45deg,#8b1fd6,#f0146e,#ff8a3d);display:grid;place-items:center;box-shadow:0 12px 24px rgba(0,0,0,.2)}
.fi .yt{position:absolute;right:0;top:0;width:250px;padding:20px;border-radius:28px;background:linear-gradient(180deg,#fff,#fde8f3);
 display:block;text-decoration:none;color:inherit;cursor:pointer;transition:transform .2s,box-shadow .2s;box-shadow:0 10px 30px rgba(229,9,20,.15)}
.fi .yt:hover{transform:translateY(-4px);box-shadow:0 16px 36px rgba(229,9,20,.25)}
.fi .yt:focus-visible{outline:3px solid #e50914;outline-offset:3px}
.fi .ytgo{display:inline-block;margin-top:12px;background:#e50914;color:#fff;font-weight:700;font-size:14px;padding:8px 16px;border-radius:99px}
.fi .back{display:inline-block;margin:6px 0 0 8px;color:#fff;font-weight:600;text-decoration:none;background:rgba(0,0,0,.25);padding:8px 16px;border-radius:99px}
.fi .ytpage{text-align:center;padding:48px 24px}
.fi .ytpage h1{margin:16px 0 8px}
.fi .ytpage .sub{margin:0 auto}
.fi .ytpage .bar{margin:24px auto 0}
.fi .btn.red{background:linear-gradient(90deg,#e50914,#ff5a36)}
.fi .ytpage .in{border-color:#e50914}
.fi .ytlogo{width:110px;height:76px;border-radius:20px;background:#ff0000;display:grid;place-items:center;margin-bottom:10px}
.fi .yt h3{font-size:24px;line-height:1.15}
.fi .pill{display:flex;gap:8px;align-items:center;background:#fff;border-radius:10px;padding:8px 12px;margin-top:8px;font-size:14px;font-weight:500}
.fi .feat{display:grid;grid-template-columns:repeat(4,1fr);margin:18px 0;padding:20px}
.fi .feat>div{display:flex;gap:12px;padding:0 14px;border-right:1px solid #eee}
.fi .feat>div:last-child{border:0}
.fi .feat b{display:block;font-size:17px}.fi .feat span{font-size:14px;color:#666}
.fi h2{text-align:center;font-size:32px;font-weight:800;margin:26px 0 16px}

/* ----- Preview + Quality picker ----- */
.fi .pv{display:flex;gap:16px;align-items:center;max-width:600px;margin-top:16px;background:#fff;border-radius:16px;padding:12px;box-shadow:0 4px 14px rgba(0,0,0,.08);text-align:left}
.fi .ytpage .pv{margin-left:auto;margin-right:auto}
.fi .pv img{width:210px;aspect-ratio:16/9;height:auto;object-fit:cover;border-radius:14px;flex:none;background:#eee}
.fi .pv b{font-size:15px;line-height:1.4;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
@media(max-width:520px){.fi .pv{flex-direction:column;align-items:stretch}.fi .pv img{width:100%}}
.fi .qbox{max-width:600px;margin-top:12px;padding:16px;border-radius:18px;background:#faf5ff;border:1px solid #eadcff;text-align:left}
.fi .ytpage .qbox{margin-left:auto;margin-right:auto;background:#fff5f5;border-color:#ffd9d9}
.fi .qbox h4{font-size:15px;margin-bottom:10px}
.fi .qbox h4.second{margin-top:16px}
.fi .qgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:10px}
.fi .qbtn{border:2px solid #e3d3fb;background:#fff;border-radius:12px;padding:10px;font:inherit;font-weight:700;font-size:15px;cursor:pointer;color:#6b2bd9}
.fi .qbtn:hover:not(:disabled){border-color:#8b1fd6}
.fi .qbtn.audio{border-color:#c9ecdc;color:#0f9d74}
.fi .qbtn.audio:hover:not(:disabled){border-color:#0f9d74}
.fi .qbtn small{display:block;font-weight:500;font-size:11px;color:#777}
.fi .skel{height:58px;border-radius:12px;background:linear-gradient(90deg,#f0e6ff 25%,#f8f2ff 37%,#f0e6ff 63%);background-size:400% 100%;animation:sk 1.2s ease infinite}
@keyframes sk{0%{background-position:100% 50%}100%{background-position:0 50%}}

/* ----- Ads + Adblock wall ----- */
.fi .adph{margin:18px auto;max-width:728px;min-height:90px;display:grid;place-items:center;border:2px dashed #cbb5ee;border-radius:14px;color:#8b6fb8;font-size:13px;background:rgba(255,255,255,.5);padding:8px;text-align:center}
.fi .adwrap{margin:18px auto;max-width:970px;text-align:center}
.fi .adwrap small{display:block;font-size:11px;color:#777;margin-bottom:4px}
.fi .abw{position:fixed;inset:0;z-index:100;background:rgba(20,10,40,.88);display:grid;place-items:center;padding:16px}
.fi .abw .box{background:#fff;border-radius:24px;padding:28px;max-width:440px;width:100%;text-align:center}
.fi .abw h3{font-size:24px;margin:8px 0}
.fi .abw p{color:#5b5b73;font-size:15px;margin-top:6px}
.fi .abw ol{text-align:left;margin:14px 0 0 22px;font-size:14px;color:#444;line-height:1.7}
.fi .abw .btn{border-radius:14px;padding:14px 28px;width:100%;margin-top:18px}

/* ----- Reviews ----- */
.fi .rev{padding:24px;margin-top:18px}
.fi .rev h2{margin-top:0}
.fi .revgrid{display:grid;grid-template-columns:1fr 1fr;gap:24px;align-items:start}
.fi .rlist{display:grid;gap:12px}
.fi .ritem{background:#faf5ff;border-radius:16px;padding:14px}
.fi .ritem b{font-size:15px}.fi .ritem p{font-size:14px;color:#444;margin-top:4px}
.fi .stars{color:#f9a825;letter-spacing:2px}
.fi .empty{color:#777;font-size:14px}
.fi form.rf{display:grid;gap:10px}
.fi .rf input,.fi .rf textarea{font:inherit;font-size:15px;padding:12px 14px;border:2px solid #e3d3fb;border-radius:12px;width:100%}
.fi .rf textarea{min-height:110px;resize:vertical}
.fi .rf .star-in button{border:0;background:none;font-size:30px;cursor:pointer;color:#ccc;padding:0 2px}
.fi .rf .star-in button.on{color:#f9a825}
.fi .rf .send{border:0;cursor:pointer;color:#fff;font:inherit;font-weight:700;font-size:16px;padding:14px;border-radius:12px;background:linear-gradient(90deg,#a21fe0,#ff4f6e,#ff8a3d)}
.fi .rf .send:disabled{opacity:.6;cursor:default}
.fi .hp{position:absolute;left:-9999px}

@media(max-width:900px){
 .fi .hero{grid-template-columns:1fr}.fi .art{min-height:420px}.fi .links{display:none}
 .fi .chips,.fi .feat{grid-template-columns:1fr 1fr;gap:14px}.fi .feat>div{border:0}
 .fi .person{left:20px;width:240px}.fi .yt{width:210px}
 .fi .revgrid{grid-template-columns:1fr}
}
@media(max-width:520px){.fi .bar{flex-direction:column;gap:8px}.fi .bar .in{border-radius:14px}
 .fi .btn{border-radius:14px;padding:14px}.fi .art{min-height:560px}.fi .yt{top:360px;right:auto;left:10px}}
 /* YouTube card ko image se alag karna */
.fi .hero{grid-template-columns:minmax(0,1.15fr) minmax(0,1fr)}
.fi .art{position:relative;min-height:0;display:flex;align-items:center;justify-content:flex-end;gap:14px}
.fi .person{position:static;flex:1 1 0;min-width:0;max-width:300px;width:auto;height:auto;aspect-ratio:300/340;object-fit:cover}
.fi .yt{position:static;flex:0 0 220px;width:220px}
@media(max-width:900px){
 .fi .hero{grid-template-columns:1fr}
 .fi .art{justify-content:center}
 .fi .person{max-width:260px}
}
@media(max-width:520px){
 .fi .art{flex-direction:column}
 .fi .person{width:100%;max-width:260px;flex:none}
 .fi .yt{width:100%;flex:none}
}
`;

const Cam = ({ s = 26 }) => (
  <svg
    width={s}
    height={s}
    viewBox="0 0 24 24"
    fill="none"
    stroke="#fff"
    strokeWidth="2"
  >
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.5" cy="6.5" r=".8" fill="#fff" />
  </svg>
);

const chips = [
  ["⚡", "Super Fast", "Download", "#ffeede"],
  ["⚙️", "No App", "Required", "#e4ecff"],
  ["🛡️", "100%", "Free", "#dff7ee"],
  ["🎵", "Video &", "Audio (MP3)", "#efe6ff"],
];
const feats = [
  ["HD", "High Quality", "Download videos up to 4K quality", "#f4e3ff"],
  [
    "🖼️",
    "All Content",
    "Supports videos, reels, photos and stories",
    "#ffe3ef",
  ],
  ["✅", "No Login", "No Instagram login required", "#dff7ee"],
  [
    "📱",
    "Works on All Devices",
    "Use on mobile, tablet and desktop",
    "#ece6ff",
  ],
];

/* ====================== Adblock detection ====================== */
function useAdblock() {
  const [blocked, setBlocked] = useState(false);

  const check = useCallback(async () => {
    let found = false;

    // 1) Bait element: adblock ke cosmetic filters ise chhupa dete hain
    const bait = document.createElement("div");
    bait.className =
      "adsbox ad-banner ad-placement adsbygoogle pub_300x250 text-ad";
    bait.style.cssText =
      "position:absolute;left:-9999px;top:-9999px;width:10px;height:10px;";
    bait.innerHTML = "&nbsp;";
    document.body.appendChild(bait);
    await new Promise((r) => setTimeout(r, 150));
    const cs = window.getComputedStyle(bait);
    if (
      bait.offsetHeight === 0 ||
      cs.display === "none" ||
      cs.visibility === "hidden"
    ) {
      found = true;
    }
    bait.remove();

    // 2) Network check: adblock ad-script ki request hi block kar dete hain
    if (!found) {
      try {
        await fetch(AD_PROBE_URL, {
          method: "HEAD",
          mode: "no-cors",
          cache: "no-store",
        });
      } catch {
        found = true;
      }
    }

    setBlocked(found);
  }, []);

  useEffect(() => {
    if (!ENFORCE_ADBLOCK) return;
    check();
    // User adblock band karke wapas aaye to dobara check
    window.addEventListener("focus", check);
    return () => window.removeEventListener("focus", check);
  }, [check]);

  return ENFORCE_ADBLOCK && blocked;
}

function AdblockWall() {
  return (
    <div
      className="fi"
      style={{ minHeight: 0, padding: 0, background: "none" }}
    >
      <style>{css}</style>
      <div className="abw" role="alertdialog" aria-modal="true">
        <div className="box">
          <div style={{ fontSize: 44 }}>🚫</div>
          <h3>Please turn off your ad blocker</h3>
          <p>
            This site is free to use and ads are what keep it running. Please
            disable your ad blocker (or allow this site) to continue.
          </p>
          <ol>
            <li>Click your ad blocker icon in the browser toolbar.</li>
            <li>Choose "Pause" / "Disable on this site".</li>
            <li>Refresh this page.</li>
          </ol>
          <button className="btn" onClick={() => window.location.reload()}>
            I have disabled it - Refresh
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Ad slot (AdSense) ---------- */
function AdSlot() {
  useEffect(() => {
    if (!ADSENSE_CLIENT) return;
    if (!document.querySelector("script[data-adsense]")) {
      const s = document.createElement("script");
      s.async = true;
      s.src = `${AD_PROBE_URL}?client=${ADSENSE_CLIENT}`;
      s.crossOrigin = "anonymous";
      s.setAttribute("data-adsense", "1");
      document.head.appendChild(s);
    }
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      /* ignore */
    }
  }, []);

  if (!ADSENSE_CLIENT) {
    return import.meta.env.DEV ? (
      <div className="adph">Ad space (set ADSENSE_CLIENT in App.jsx)</div>
    ) : null;
  }

  return (
    <div className="adwrap">
      <small>Advertisement</small>
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={ADSENSE_SLOT}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}

/* ====================== Downloader logic (dono pages ke liye) ====================== */

// YouTube link se video id nikalo (turant thumbnail dikhane ke liye)
function ytId(url) {
  const m = /(?:v=|youtu\.be\/|shorts\/)([A-Za-z0-9_-]{11})/.exec(url);
  return m ? m[1] : null;
}

function useDownloader({ validate, invalidText }) {
  const [link, setLink] = useState("");
  const [msg, setMsg] = useState({ text: "", ok: true });
  const [info, setInfo] = useState(null);
  const [preview, setPreview] = useState(null); // turant dikhne wala thumbnail/title
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(""); // kaunsa button prepare ho raha hai
  const abortRef = useRef(null);
  const lastUrl = useRef("");

  const reset = () => {
    abortRef.current?.abort();
    lastUrl.current = "";
    setInfo(null);
    setPreview(null);
    setLoading(false);
  };

  const change = (v) => {
    setLink(v);
    reset();
    setMsg({ text: "", ok: true });
  };

  const clear = () => change("");

  const analyzeUrl = async (url) => {
    abortRef.current?.abort(); // purani request band
    const ac = new AbortController();
    abortRef.current = ac;
    lastUrl.current = url;

    setLoading(true);
    setInfo(null);
    setMsg({ text: "Checking link...", ok: true });

    // Turant dikhao: YouTube ka thumbnail seedha YouTube se, title oEmbed se (backend ka wait nahi)
    const id = ytId(url);
    if (id) {
      setPreview({
        thumbnail: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
        title: "",
      });
      fetch(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
        { signal: ac.signal },
      )
        .then((r) => r.json())
        .then((o) => {
          if (!ac.signal.aborted && o.title)
            setPreview((p) => (p ? { ...p, title: o.title } : p));
        })
        .catch(() => {});
    } else {
      setPreview(null);
    }

    try {
      const res = await fetch(
        `${API}/api/media/info?url=${encodeURIComponent(url)}`,
        { method: "POST", signal: ac.signal },
      );
      const data = await res.json();
      if (!res.ok || !data.success)
        throw new Error(data.message || "Could not read this link.");
      setInfo(data);
      setPreview(null);
      setMsg({ text: "Link looks good. Choose a format below.", ok: true });
    } catch (e) {
      if (e.name === "AbortError") return;
      setPreview(null);
      lastUrl.current = ""; // dobara try kar sake
      setMsg({
        text:
          e instanceof TypeError
            ? "Cannot reach the server. Is the backend running?"
            : e.message,
        ok: false,
      });
    } finally {
      if (!ac.signal.aborted) setLoading(false);
    }
  };

  // Button / Enter
  const analyze = () => {
    const url = link.trim();
    if (!validate(url)) {
      reset();
      setMsg({ text: invalidText, ok: false });
      return;
    }
    if (url === lastUrl.current && (loading || info)) return; // pehle se chal raha hai
    analyzeUrl(url);
  };

  // Paste karte hi turant check shuru (button dabane ka wait nahi)
  const paste = (e) => {
    const t = (e.clipboardData?.getData("text") || "").trim();
    if (validate(t)) {
      e.preventDefault();
      setLink(t);
      setMsg({ text: "", ok: true });
      analyzeUrl(t);
    }
  };

  // quality = "720p" ya "best"; audio = "mp3" / "m4a" (sirf audio ke liye)
  const download = async (quality, audio) => {
    const key = audio || quality;
    const label = audio ? audio.toUpperCase() : quality;
    setBusy(key);
    setMsg({
      text: `Preparing ${label}... this can take a little while.`,
      ok: true,
    });
    try {
      const params = new URLSearchParams({ url: link.trim(), quality });
      if (audio) params.set("audio", audio);

      const res = await fetch(`${API}/api/media/download?${params}`);

      if (!res.ok) {
        let m = "Download failed. Please try again.";
        try {
          m = (await res.json()).message || m;
        } catch {
          /* ignore */
        }
        throw new Error(m);
      }

      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") || "";
      const match = /filename="?([^";]+)"?/i.exec(cd);
      const filename = match
        ? match[1]
        : audio
          ? `audio.${audio}`
          : "download.mp4";

      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 10000);

      setMsg({ text: "Done! Your download has started.", ok: true });
    } catch (e) {
      setMsg({
        text:
          e instanceof TypeError
            ? "Cannot reach the server. Is the backend running?"
            : e.message,
        ok: false,
      });
    } finally {
      setBusy("");
    }
  };

  return {
    link,
    msg,
    info,
    preview,
    loading,
    busy,
    change,
    paste,
    clear,
    analyze,
    download,
  };
}

/* bytes -> "45 MB" / "1.25 GB" */
function fmtSize(bytes) {
  if (!bytes || bytes <= 0) return "";
  const KB = 1024;
  const MB = KB * 1024;
  const GB = MB * 1024;
  if (bytes >= GB) return `${(bytes / GB).toFixed(2)} GB`;
  if (bytes >= 100 * MB) return `${Math.round(bytes / MB)} MB`;
  if (bytes >= MB) return `${(bytes / MB).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / KB))} KB`;
}

/* ---------- Link bar + preview + video/audio options ---------- */
function DownloaderBox({
  d,
  placeholder,
  label,
  example,
  red,
  quickQualities = [], // info aane tak turant dikhne wali qualities
}) {
  const checking = d.loading && !d.info; // asli info abhi aa rahi hai
  const formats = d.info
    ? d.info.formats || []
    : checking
      ? quickQualities.map((q) => ({
          quality: q,
          value: parseInt(q, 10),
          size: 0,
        }))
      : [];
  const hasHigh = formats.some((f) => f.value >= 1440);
  const showBox = !!d.info || checking;
  const showAudio = checking || formats.length > 0;
  const pv = d.info
    ? { thumbnail: d.info.thumbnail, title: d.info.title }
    : d.preview;

  return (
    <>
      <div className="bar">
        <label className="in">
          🔗
          <input
            value={d.link}
            onChange={(e) => d.change(e.target.value)}
            onPaste={d.paste}
            onKeyDown={(e) => e.key === "Enter" && d.analyze()}
            placeholder={placeholder}
            aria-label={label}
          />
          {d.link && (
            <button className="x" onClick={d.clear} aria-label="Clear">
              ✕
            </button>
          )}
        </label>
        <button
          className={`btn${red ? " red" : ""}`}
          onClick={d.analyze}
          disabled={d.loading}
        >
          {d.loading ? "Checking..." : "⬇ Download"}
        </button>
      </div>
      <p
        className="msg"
        style={{ color: d.msg.ok ? "#0f9d74" : "#d6204f" }}
        role="status"
      >
        {d.msg.text}
      </p>
      <p className="ex">{example}</p>

      {pv && (
        <div className="pv">
          {pv.thumbnail && (
            <img
              src={pv.thumbnail}
              alt=""
              referrerPolicy="no-referrer"
              onError={(e) => (e.currentTarget.style.display = "none")}
            />
          )}
          <b>{pv.title || (d.loading ? "Loading..." : "")}</b>
        </div>
      )}

      {showBox && (
        <div className="qbox">
          <h4>🎬 Video (MP4)</h4>
          <div className="qgrid">
            {formats.length === 0 && (
              <button
                className="qbtn"
                disabled={!!d.busy}
                onClick={() => d.download("best")}
              >
                {d.busy === "best" ? "Preparing..." : "Download"}
                <small>{checking ? "Best quality" : "Original"}</small>
              </button>
            )}
            {formats.map((f) => (
              <button
                key={f.quality}
                className="qbtn"
                disabled={!!d.busy}
                onClick={() => d.download(f.quality)}
              >
                {d.busy === f.quality ? "Preparing..." : f.quality}
                <small>
                  {checking
                    ? "Checking..."
                    : [
                        f.value >= 2160 ? "4K" : f.value >= 1440 ? "2K" : "",
                        f.size > 0 ? `~${fmtSize(f.size)}` : "",
                      ]
                        .filter(Boolean)
                        .join(" · ") || "Free"}
                </small>
              </button>
            ))}
          </div>
          {hasHigh && (
            <p className="ex">
              1440p / 4K files may need VLC player to play on some devices.
            </p>
          )}

          {showAudio && (
            <>
              <h4 className="second">🎵 Audio only</h4>
              <div className="qgrid">
                {["mp3", "m4a"].map((a) => {
                  const size =
                    a === "mp3" ? d.info?.mp3Size : d.info?.audioSize;
                  return (
                    <button
                      key={a}
                      className="qbtn audio"
                      disabled={!!d.busy}
                      onClick={() => d.download("best", a)}
                    >
                      {d.busy === a ? "Preparing..." : a.toUpperCase()}
                      <small>
                        {size > 0
                          ? `~${fmtSize(size)}`
                          : a === "mp3"
                            ? "Works everywhere"
                            : "Original quality"}
                      </small>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}

/* ---------- Reviews: form -> your email, list -> only approved ones ---------- */
function Reviews() {
  const [name, setName] = useState("");
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");
  const [state, setState] = useState("idle"); // idle | sending | done | error

  const submit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setState("sending");
    try {
      const res = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          access_key: WEB3FORMS_KEY,
          subject: "New review on Fastest Insta Video Downloader",
          name: name.trim() || "Anonymous",
          rating: `${rating}/5`,
          message: text.trim(),
          botcheck: "",
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error("failed");
      setState("done");
      setName("");
      setText("");
      setRating(5);
    } catch {
      setState("error");
    }
  };

  return (
    <section className="card rev" id="reviews">
      <h2>
        User <span className="pink">Reviews</span>
      </h2>
      <div className="revgrid">
        <div className="rlist">
          {APPROVED_REVIEWS.length === 0 && (
            <p className="empty">No reviews yet. Be the first to write one.</p>
          )}
          {APPROVED_REVIEWS.map((r, i) => (
            <div className="ritem" key={i}>
              <div className="stars" aria-label={`${r.rating} out of 5`}>
                {"★".repeat(r.rating)}
                {"☆".repeat(5 - r.rating)}
              </div>
              <b>{r.name}</b>
              <p>{r.text}</p>
            </div>
          ))}
        </div>

        <form className="rf" onSubmit={submit}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name (optional)"
            aria-label="Your name"
            maxLength={40}
          />
          <div className="star-in" role="radiogroup" aria-label="Rating">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                type="button"
                key={n}
                className={n <= rating ? "on" : ""}
                onClick={() => setRating(n)}
                aria-label={`${n} star`}
              >
                ★
              </button>
            ))}
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write your review..."
            aria-label="Your review"
            maxLength={500}
            required
          />
          <input
            className="hp"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
          />
          <button className="send" disabled={state === "sending"}>
            {state === "sending" ? "Sending..." : "Submit review"}
          </button>
          <p
            className="msg"
            role="status"
            style={{ color: state === "error" ? "#d6204f" : "#0f9d74" }}
          >
            {state === "done" && "Thanks! Your review was sent."}
            {state === "error" && "Could not send. Please try again."}
          </p>
        </form>
      </div>
    </section>
  );
}

/* ====================== Page 1: Instagram ====================== */
function InstaDownloaderLanding() {
  const d = useDownloader({
    validate: (v) => INSTA_RE.test(v),
    invalidText: "Paste a valid Instagram link, like instagram.com/reel/XXXXXX",
  });

  return (
    <div className="fi">
      <style>{css}</style>
      <div className="wrap">
        <nav className="card">
          <div className="brand">
            <div className="logo">
              <Cam />
            </div>
            <div>
              Fastest <span className="pink">Insta</span>
              <br />
              <span className="purple">Video Downloader</span>
            </div>
          </div>
          <div className="links">
            <a className="on" href="#home">
              🏠 Home
            </a>
            <a href="#features">☆ Features</a>
            <a href="#reviews">💬 Reviews</a>
          </div>
        </nav>

        <section className="card hero" id="home" style={{ marginTop: 14 }}>
          <div>
            <span className="badge">⚡ Fast • Free • No Login Required</span>
            <h1>
              Fastest <span className="pink">Insta</span>
              <br />
              <span className="purple">Video Downloader</span>
            </h1>
            <p className="sub">
              Download Instagram Videos, Reels, Photos, Stories in just one
              click. Video or audio (MP3). Fast, Free and Easy to Use.
            </p>

            <DownloaderBox
              d={d}
              placeholder="Paste Instagram link here..."
              label="Instagram link"
              example="Example: https://www.instagram.com/reel/XXXXXX/"
              quickQualities={[]}
            />

            <div className="chips">
              {chips.map(([i, a, b, c]) => (
                <div className="chip" key={a}>
                  <div className="ico" style={{ background: c }}>
                    {i}
                  </div>
                  <div>
                    {a}
                    <br />
                    {b}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="art">
            <img
              className="person"
              src={girl}
              alt="Girl pointing at download box"
            />
            <div className="ig" aria-hidden="true">
              <Cam s={48} />
            </div>
            <a
              className="yt"
              href="#/youtube"
              aria-label="Open YouTube video downloader"
            >
              <div className="ytlogo">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="#fff">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
              <h3>
                You can also download{" "}
                <span style={{ color: "#e50914" }}>YouTube Video</span>
              </h3>
              <div className="pill">🎞️ Videos</div>
              <div className="pill">🎵 Audio (MP3)</div>
              <div className="pill">
                <b
                  style={{
                    background: "#4338ca",
                    color: "#fff",
                    fontSize: 11,
                    padding: "2px 5px",
                    borderRadius: 4,
                  }}
                >
                  HD
                </b>{" "}
                144p - 4K
              </div>
              <span className="ytgo">Open YouTube Downloader</span>
            </a>
          </div>
        </section>

        <section className="card feat" id="features">
          {feats.map(([i, t, dsc, c]) => (
            <div key={t}>
              <div
                className="ico"
                style={{
                  background: c,
                  width: 56,
                  height: 56,
                  fontSize: i === "HD" ? 18 : 24,
                  fontWeight: 800,
                  color: "#c026d3",
                }}
              >
                {i}
              </div>
              <p>
                <b>{t}</b>
                <span>{dsc}</span>
              </p>
            </div>
          ))}
        </section>

        <AdSlot />

        <Reviews />
      </div>
    </div>
  );
}

/* ====================== Page 2: YouTube ====================== */
function YouTubePage() {
  const d = useDownloader({
    validate: (v) => YT_RE.test(v),
    invalidText: "Paste a valid YouTube link, like youtube.com/watch?v=XXXX",
  });

  return (
    <div className="fi">
      <style>{css}</style>
      <div className="wrap">
        <nav className="card">
          <div className="brand">
            <div className="logo">
              <Cam />
            </div>
            <div>
              Fastest <span className="pink">Insta</span>
              <br />
              <span className="purple">Video Downloader</span>
            </div>
          </div>
          <div className="links" style={{ display: "flex" }}>
            <a className="back" href="#/" style={{ background: "#e50914" }}>
              ← Back to Home
            </a>
          </div>
        </nav>

        <section className="card ytpage" style={{ marginTop: 14 }}>
          <div className="ytlogo" style={{ margin: "0 auto" }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="#fff">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
          <h1>
            YouTube <span style={{ color: "#e50914" }}>Video Downloader</span>
          </h1>
          <p className="sub">
            Paste a YouTube link and choose your quality, from 144p up to 4K,
            with audio. Or download only the audio as MP3.
          </p>

          <DownloaderBox
            d={d}
            placeholder="Paste YouTube link here..."
            label="YouTube link"
            example="Example: https://www.youtube.com/watch?v=XXXXXXXXXXX"
            quickQualities={["144p", "360p", "720p", "1080p"]}
            red
          />
        </section>

        <AdSlot />
      </div>
    </div>
  );
}

/* ====================== Tiny hash router ====================== */
export default function App() {
  const [route, setRoute] = useState(window.location.hash);
  const blocked = useAdblock();

  useEffect(() => {
    const onChange = () => {
      const h = window.location.hash;
      setRoute(h);
      // sirf page badalne par top par jao, #reviews/#features jaise anchors par nahi
      if (h === "" || h.startsWith("#/")) window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  return (
    <>
      {blocked && <AdblockWall />}
      {route === "#/youtube" ? <YouTubePage /> : <InstaDownloaderLanding />}
    </>
  );
}
