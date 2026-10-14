import { useState, useEffect, useCallback, useRef } from "react";
import girl from "./assets/girl.png";

const API = import.meta.env.VITE_API_URL || "http://localhost:8080";
const WEB3FORMS_KEY = "YOUR_WEB3FORMS_ACCESS_KEY";
const ADSENSE_CLIENT = "";
const ADSENSE_SLOT = "";

const INSTA_RE =
  /^https?:\/\/(www\.)?instagram\.com\/(reel|reels|p|tv|stories)\/[^/?#]+/i;
const YT_RE =
  /^https?:\/\/(www\.|m\.)?(youtube\.com\/(watch|shorts)|youtu\.be\/).+/i;

// Backend sirf https links leta hai, isliye http ko https bana do aur spaces hata do
const fixUrl = (v) => (v || "").trim().replace(/^http:\/\//i, "https://");

const css = `
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap');
*{box-sizing:border-box}body{margin:0}.fi{font-family:Poppins,system-ui,sans-serif;color:#1a1a2e;min-height:100vh;padding:14px;background:radial-gradient(circle at 0% 20%,#c24bff 0,transparent 35%),radial-gradient(circle at 100% 10%,#ff5fa8 0,transparent 35%),linear-gradient(180deg,#e9d5ff,#fdf2f8)}
.fi *{box-sizing:border-box}.wrap{max-width:1180px;margin:auto}.card{background:#fff;border-radius:24px;box-shadow:0 10px 30px #7828a01f}.pink{color:#f0146e}.purple{color:#8b1fd6}
nav{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:12px 24px;flex-wrap:wrap}.brand{display:flex;align-items:center;gap:10px;font-weight:800;line-height:1.1;font-size:20px}.logo{width:44px;height:44px;border-radius:12px;background:linear-gradient(45deg,#f9a825,#f0146e,#8b1fd6);display:grid;place-items:center;color:white;font-size:26px}.links{display:flex;gap:24px;font-weight:500;font-size:15px}.links a{color:#1a1a2e;text-decoration:none}.hero{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:24px;padding:28px 24px;align-items:center;margin-top:14px}.badge{display:inline-flex;background:#fde4ef;color:#f0146e;font-weight:600;font-size:13px;padding:6px 14px;border-radius:99px}h1{font-size:clamp(34px,5vw,62px);line-height:1.04;font-weight:800;margin:14px 0}.sub{font-size:17px;color:#5b5b73;max-width:600px;line-height:1.6}.bar{display:flex;margin-top:22px;max-width:650px}.bar .in{flex:1;display:flex;align-items:center;gap:10px;background:#fff;border:2px solid #6b2bd9;border-radius:14px 0 0 14px;padding:0 14px;min-width:0}.bar input{flex:1;min-width:0;border:0;outline:0;font:inherit;font-size:15px;padding:16px 0}.x{border:0;background:none;cursor:pointer;font-size:18px}.btn{border:0;cursor:pointer;color:white;font:inherit;font-weight:700;font-size:16px;padding:0 24px;border-radius:0 14px 14px 0;background:linear-gradient(90deg,#a21fe0,#ff4f6e,#ff8a3d)}.btn:disabled,.qbtn:disabled{opacity:.6;cursor:wait}.msg{margin:8px 0 0;font-size:14px;min-height:20px}.ex{font-size:12px;color:#666;margin-top:6px}.art{display:flex;align-items:center;justify-content:center;gap:14px;min-width:0}.person{width:min(45%,260px);height:auto;aspect-ratio:300/340;object-fit:cover;border-radius:50% 50% 30% 30%;background:#f7d1e7}.ytcard{width:min(52%,250px);padding:18px;border-radius:24px;background:linear-gradient(#fff,#fde8f3);text-decoration:none;color:inherit;box-shadow:0 10px 30px #e509141f}.ytlogo{width:70px;height:50px;border-radius:14px;background:#f00;color:#fff;display:grid;place-items:center;font-size:28px;margin-bottom:12px}.ytcard h3{font-size:20px;line-height:1.25}.pill{background:#fff;border-radius:10px;padding:8px 10px;margin-top:8px;font-size:13px}.ytgo{display:inline-block;margin-top:12px;background:#e50914;color:white;font-weight:700;font-size:12px;padding:8px 12px;border-radius:99px}
.chips{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:20px}.chip{display:flex;align-items:center;gap:8px;background:#fff;border-radius:14px;padding:10px;font-size:12px;font-weight:600;line-height:1.3;box-shadow:0 4px 14px #0000000f}.ico{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;font-size:20px;flex:none}
.feat{display:grid;grid-template-columns:repeat(4,1fr);margin:18px 0;padding:20px}.feat>div{display:flex;gap:12px;padding:0 12px;border-right:1px solid #eee}.feat>div:last-child{border:0}.feat b{display:block;font-size:14px}.feat span{font-size:12px;color:#666;display:block;margin-top:4px}
h2{text-align:center;font-size:28px;font-weight:800;margin:22px 0 16px}.pv{display:flex;gap:14px;align-items:center;max-width:650px;margin-top:14px;background:#fff;border-radius:16px;padding:12px;box-shadow:0 4px 14px #00000012;text-align:left;flex-wrap:wrap}.pv img{width:210px;max-width:100%;aspect-ratio:16/9;height:auto;object-fit:cover;border-radius:12px;background:#eee}.pv b{font-size:14px;line-height:1.4;flex:1;min-width:120px}.pv iframe{display:block;width:100%;max-width:360px;aspect-ratio:9/16;border:0;border-radius:12px;background:#f5f5f5}
.qbox{max-width:650px;margin-top:12px;padding:16px;border-radius:18px;background:#faf5ff;border:1px solid #eadcff;text-align:left}.qbox h4{font-size:15px;margin:0 0 10px}.qbox h4.second{margin-top:16px}.qgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:10px}.qbtn{border:2px solid #e3d3fb;background:#fff;border-radius:12px;padding:10px;font:inherit;font-weight:700;font-size:14px;cursor:pointer;color:#6b2bd9}.qbtn:hover:not(:disabled){border-color:#8b1fd6}.qbtn.audio{border-color:#c9ecdc;color:#0f9d74}.qbtn small{display:block;font-weight:500;font-size:11px;color:#777;margin-top:4px}.adph{margin:18px auto;max-width:728px;min-height:70px;display:grid;place-items:center;border:2px dashed #cbb5ee;border-radius:14px;color:#8b6fb8;font-size:13px;background:#ffffff80;padding:8px;text-align:center}.adwrap{margin:18px auto;max-width:970px;text-align:center}.adwrap small{display:block;font-size:11px;color:#777;margin-bottom:4px}
.rev{padding:24px;margin-top:18px}.revgrid{display:grid;grid-template-columns:1fr 1fr;gap:24px}.rlist{display:grid;gap:12px}.ritem{background:#faf5ff;border-radius:16px;padding:14px}.ritem b{font-size:15px}.ritem p{font-size:14px;color:#444;margin-top:4px}.stars{color:#f9a825;letter-spacing:2px}.empty{color:#777;font-size:14px}.rf{display:grid;gap:10px}.rf input,.rf textarea{font:inherit;font-size:14px;padding:12px 14px;border:2px solid #e3d3fb;border-radius:12px;width:100%}.rf textarea{min-height:100px;resize:vertical}.star-in button{border:0;background:none;font-size:28px;cursor:pointer;color:#ccc;padding:0 2px}.star-in button.on{color:#f9a825}.send{border:0;cursor:pointer;color:white;font:inherit;font-weight:700;font-size:15px;padding:13px;border-radius:12px;background:linear-gradient(90deg,#a21fe0,#ff4f6e,#ff8a3d)}.hp{position:absolute;left:-9999px}
.ytpage{text-align:center;padding:40px 24px;margin-top:14px}.ytpage .sub{margin:auto}.ytpage .bar,.ytpage .pv,.ytpage .qbox{margin-left:auto;margin-right:auto}.btn.red{background:linear-gradient(90deg,#e50914,#ff5a36)}.ytpage .in{border-color:#e50914}
@media(max-width:900px){.hero{grid-template-columns:1fr}.art{margin-top:12px}.chips,.feat{grid-template-columns:1fr 1fr}.feat>div{border:0}.revgrid{grid-template-columns:1fr}.links{display:none}}
@media(max-width:520px){.fi{padding:8px}.hero{padding:20px 14px}.bar{flex-direction:column;gap:8px}.bar .in{border-radius:14px}.btn{border-radius:14px;padding:14px}.art{flex-direction:column}.person,.ytcard{width:100%;max-width:280px}.chips{grid-template-columns:1fr 1fr}.feat{grid-template-columns:1fr;gap:14px}.pv{flex-direction:column;align-items:stretch}.pv iframe{max-width:100%}nav{padding:12px}}
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

function ytId(url) {
  const m = /(?:v=|youtu\.be\/|shorts\/)([A-Za-z0-9_-]{11})/.exec(url);
  return m ? m[1] : null;
}

function instaPreviewUrl(url) {
  try {
    const parsed = new URL(url);
    if (!/instagram\.com$/i.test(parsed.hostname.replace(/^www\./i, "")))
      return null;
    const match = parsed.pathname.match(/^\/(reel|reels|p|tv)\/([^/]+)/i);
    if (!match) return null;
    const type =
      match[1].toLowerCase() === "reels" ? "reel" : match[1].toLowerCase();
    return `https://www.instagram.com/${type}/${match[2]}/embed/`;
  } catch {
    return null;
  }
}

function useAdblock() {
  const [blocked, setBlocked] = useState(false);
  const check = useCallback(async () => {
    let found = false;
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
    )
      found = true;
    bait.remove();
    if (!found) {
      try {
        await fetch(
          "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js",
          {
            method: "HEAD",
            mode: "no-cors",
            cache: "no-store",
          },
        );
      } catch {
        found = true;
      }
    }
    setBlocked(found);
  }, []);
  useEffect(() => {
    // FIX: jab tak AdSense set nahi hai (ads hain hi nahi), adblock check mat chalao
    if (import.meta.env.DEV || !ADSENSE_CLIENT) return;
    check();
    window.addEventListener("focus", check);
    return () => window.removeEventListener("focus", check);
  }, [check]);
  return !import.meta.env.DEV && !!ADSENSE_CLIENT && blocked;
}

function AdblockWall() {
  return (
    <div className="fi">
      <style>{css}</style>
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 100,
          background: "#140a28e0",
          display: "grid",
          placeItems: "center",
          padding: 16,
        }}
      >
        <div
          className="card"
          style={{ padding: 28, maxWidth: 440, textAlign: "center" }}
        >
          <div style={{ fontSize: 44 }}>🚫</div>
          <h2>Please turn off your ad blocker</h2>
          <p>
            This site is free to use and ads help keep it running. Please
            disable your ad blocker for this site and refresh.
          </p>
          <button
            className="btn"
            style={{ borderRadius: 14, padding: 14, marginTop: 16 }}
            onClick={() => window.location.reload()}
          >
            I have disabled it — Refresh
          </button>
        </div>
      </div>
    </div>
  );
}

function AdSlot() {
  useEffect(() => {
    if (!ADSENSE_CLIENT) return;
    if (!document.querySelector("script[data-adsense]")) {
      const s = document.createElement("script");
      s.async = true;
      s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;
      s.crossOrigin = "anonymous";
      s.setAttribute("data-adsense", "1");
      document.head.appendChild(s);
    }
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {}
  }, []);
  if (!ADSENSE_CLIENT)
    return import.meta.env.DEV ? (
      <div className="adph">Ad space (set ADSENSE_CLIENT in App.jsx)</div>
    ) : null;
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

function fmtSize(bytes) {
  if (!bytes || bytes <= 0) return "";
  const KB = 1024,
    MB = KB * 1024,
    GB = MB * 1024;
  if (bytes >= GB) return `${(bytes / GB).toFixed(2)} GB`;
  if (bytes >= 100 * MB) return `${Math.round(bytes / MB)} MB`;
  if (bytes >= MB) return `${(bytes / MB).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / KB))} KB`;
}

function useDownloader({ validate, invalidText, auto = true }) {
  const [link, setLink] = useState("");
  const [msg, setMsg] = useState({ text: "", ok: true });
  const [info, setInfo] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const abortRef = useRef(null);
  const lastUrl = useRef("");
  const timerRef = useRef(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    lastUrl.current = "";
    setInfo(null);
    setPreview(null);
    setLoading(false);
  }, []);

  const analyzeUrl = useCallback(async (url) => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    lastUrl.current = url;
    setLoading(true);
    setInfo(null);
    setMsg({ text: "Checking link and loading preview...", ok: true });

    // Preview request starts immediately, in parallel with backend analysis.
    const id = ytId(url);
    const embedUrl = instaPreviewUrl(url);
    if (id) {
      setPreview({
        thumbnail: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
        title: "",
        embedUrl: null,
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
    } else if (embedUrl) {
      setPreview({ thumbnail: "", title: "Instagram video preview", embedUrl });
    } else {
      setPreview(null);
    }

    try {
      const res = await fetch(
        `${API}/api/media/info?url=${encodeURIComponent(url)}`,
        {
          method: "POST",
          signal: ac.signal,
        },
      );
      let data;
      try {
        data = await res.json();
      } catch {
        throw new Error("Server returned an invalid response.");
      }
      if (!res.ok || !data.success)
        throw new Error(data.message || "Could not read this link.");
      if (ac.signal.aborted) return;
      setInfo(data);
      setMsg({ text: "Link looks good. Choose a format below.", ok: true });
    } catch (e) {
      if (e.name === "AbortError") return;
      lastUrl.current = "";
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
  }, []);

  const change = useCallback(
    (v) => {
      setLink(v);
      reset();
      setMsg({ text: "", ok: true });
      if (timerRef.current) clearTimeout(timerRef.current);
      // FIX: http -> https aur trim
      const url = fixUrl(v);
      if (auto && validate(url)) {
        timerRef.current = setTimeout(() => analyzeUrl(url), 250);
      }
    },
    [auto, validate, reset, analyzeUrl],
  );

  useEffect(
    () => () => {
      abortRef.current?.abort();
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const analyze = () => {
    // FIX: http -> https aur trim
    const url = fixUrl(link);
    if (!validate(url)) {
      reset();
      setMsg({ text: invalidText, ok: false });
      return;
    }
    if (url === lastUrl.current && (loading || info)) return;
    analyzeUrl(url);
  };

  const paste = (e) => {
    const t = fixUrl(e.clipboardData?.getData("text") || "");
    if (validate(t)) {
      e.preventDefault();
      change(t);
    }
  };

  const clear = () => change("");

  const download = async (quality, audio) => {
    const key = audio || quality;
    const label = audio ? audio.toUpperCase() : quality;
    setBusy(key);
    setMsg({
      text: `Preparing ${label}... this can take a little while.`,
      ok: true,
    });
    try {
      // FIX: download me bhi https wala link jaaye
      const params = new URLSearchParams({ url: fixUrl(link), quality });
      if (audio) params.set("audio", audio);
      const res = await fetch(`${API}/api/media/download?${params}`);
      if (!res.ok) {
        let m = "Download failed. Please try again.";
        try {
          m = (await res.json()).message || m;
        } catch {}
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
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
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

function DownloaderBox({
  d,
  placeholder,
  label,
  example,
  red = false,
  quickQualities = [],
}) {
  const checking = d.loading && !d.info;
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
  const showAudio = !!d.info || checking;
  const pv = d.info
    ? {
        thumbnail: d.info.thumbnail,
        title: d.info.title,
        embedUrl: d.preview?.embedUrl,
      }
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
            <button
              type="button"
              className="x"
              onClick={d.clear}
              aria-label="Clear"
            >
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
          {pv.embedUrl ? (
            <iframe
              src={pv.embedUrl}
              title="Instagram video preview"
              loading="eager"
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <>
              {pv.thumbnail && (
                <img
                  src={pv.thumbnail}
                  alt="Video thumbnail"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              )}
              <b>{pv.title || (d.loading ? "Loading preview..." : "")}</b>
            </>
          )}
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
              1440p / 4K files may need VLC player on some devices.
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

function Reviews() {
  const [name, setName] = useState("");
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState("");
  const [state, setState] = useState("idle");

  const submit = async (e) => {
    e.preventDefault();
    if (!review.trim()) return;
    if (WEB3FORMS_KEY === "YOUR_WEB3FORMS_ACCESS_KEY") {
      setState("error");
      return;
    }
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
          message: review.trim(),
          botcheck: "",
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error("failed");
      setState("done");
      setName("");
      setReview("");
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
          <p className="empty">No reviews yet. Be the first to write one.</p>
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
            value={review}
            onChange={(e) => setReview(e.target.value)}
            placeholder="Write your review..."
            aria-label="Your review"
            maxLength={500}
            required
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
            {state === "error" &&
              (WEB3FORMS_KEY === "YOUR_WEB3FORMS_ACCESS_KEY"
                ? "Add your Web3Forms access key in App.jsx first."
                : "Could not send. Please try again.")}
          </p>
        </form>
      </div>
    </section>
  );
}

function InstaDownloaderLanding() {
  const validate = useCallback((v) => INSTA_RE.test(v), []);
  const d = useDownloader({
    validate,
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
            <a href="#home">🏠 Home</a>
            <a href="#features">☆ Features</a>
            <a href="#reviews">💬 Reviews</a>
          </div>
        </nav>
        <section className="card hero" id="home">
          <div>
            <span className="badge">⚡ Fast • Free • No Login Required</span>
            <h1>
              Fastest <span className="pink">Insta</span>
              <br />
              <span className="purple">Video Downloader</span>
            </h1>
            <p className="sub">
              Download Instagram videos, Reels, photos and supported content.
              Paste a link to preview it and load available download options.
            </p>
            <DownloaderBox
              d={d}
              placeholder="Paste Instagram link here..."
              label="Instagram link"
              example="Example: https://www.instagram.com/reel/XXXXXX/"
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
            <img className="person" src={girl} alt="Illustration" />
            <a
              className="ytcard"
              href="#/youtube"
              aria-label="Open YouTube video downloader"
            >
              <div className="ytlogo">▶</div>
              <h3>
                You can also download{" "}
                <span style={{ color: "#e50914" }}>YouTube Video</span>
              </h3>
              <div className="pill">🎞️ Videos</div>
              <div className="pill">🎵 Audio (MP3)</div>
              <div className="pill">HD 144p - 4K</div>
              <span className="ytgo">Open YouTube Downloader</span>
            </a>
          </div>
        </section>
        <section className="card feat" id="features">
          {feats.map(([i, t, desc, c]) => (
            <div key={t}>
              <div
                className="ico"
                style={{
                  background: c,
                  width: 52,
                  height: 52,
                  fontSize: i === "HD" ? 18 : 23,
                  fontWeight: 800,
                  color: "#c026d3",
                }}
              >
                {i}
              </div>
              <p>
                <b>{t}</b>
                <span>{desc}</span>
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

function YouTubePage() {
  const validate = useCallback((v) => YT_RE.test(v), []);
  const d = useDownloader({
    validate,
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
            <a href="#/">← Back to Home</a>
          </div>
        </nav>
        <section className="card ytpage">
          <div className="ytlogo" style={{ margin: "0 auto" }}>
            ▶
          </div>
          <h1>
            YouTube <span style={{ color: "#e50914" }}>Video Downloader</span>
          </h1>
          <p className="sub">
            Paste a YouTube link and choose an available quality. Audio-only
            options are also shown when supported by the backend.
          </p>
          <DownloaderBox
            d={d}
            placeholder="Paste YouTube link here..."
            label="YouTube link"
            example="Example: https://www.youtube.com/watch?v=XXXXXXXXXXX"
            red
            quickQualities={["144p", "360p", "720p", "1080p"]}
          />
        </section>
        <AdSlot />
      </div>
    </div>
  );
}

export default function App() {
  const [route, setRoute] = useState(window.location.hash);
  const blocked = useAdblock();
  useEffect(() => {
    const onChange = () => {
      const h = window.location.hash;
      setRoute(h);
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
