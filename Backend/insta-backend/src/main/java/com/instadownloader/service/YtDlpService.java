package com.instadownloader.service;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.regex.Pattern;
import java.util.stream.Stream;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

@Service
public class YtDlpService {

  private static final Logger log = LoggerFactory.getLogger(YtDlpService.class);

  /** quality = chhoti side (720 => 720p), size = andaza (bytes, 0 = pata nahi) */
  public record QualityInfo(int quality, long size) {
  }

  public record MediaInfo(String platform, String title, String thumbnail,
      List<QualityInfo> qualities, long audioSize, double duration) {
  }

  private record ProcResult(int exit, String out, String err) {
  }

  private record Cached(MediaInfo info, long expires) {
  }

  /*
   * Sirf in links ki ijazat hai. Ye allow-list command injection / SSRF se
   * bachati hai
   * (URL kisi bhi aur site ka ya ajeeb characters wala nahi ho sakta).
   */
  private static final Pattern ALLOWED_URL = Pattern.compile(
      "^https://(?:www\\.|m\\.)?(?:"
          + "instagram\\.com/(?:reel|reels|p|tv)/[A-Za-z0-9_-]+/?"
          + "|instagram\\.com/stories/[A-Za-z0-9_.]+/[0-9]+/?"
          + "|youtube\\.com/watch\\?v=[A-Za-z0-9_-]{11}"
          + "|youtube\\.com/shorts/[A-Za-z0-9_-]{11}"
          + "|youtu\\.be/[A-Za-z0-9_-]{11}"
          + ")(?:[?&#][A-Za-z0-9_=&%.~-]*)?$",
      Pattern.CASE_INSENSITIVE);

  @Value("${ytdlp.path:yt-dlp}")
  private String ytDlpPath;

  @Value("${ytdlp.cookies:}")
  private String cookies;

  // Optional: ffmpeg ka folder/path, agar PATH me nahi milta (video+audio jodne
  // ke liye zaroori)
  @Value("${ytdlp.ffmpeg-location:}")
  private String ffmpegLocation;

  @Value("${ytdlp.max-filesize:500M}")
  private String maxFilesize;

  private final Semaphore slots;
  // Same link dobara aaye (ya quality badle) to yt-dlp dobara nahi chalega: 10
  // minute cache
  private final Map<String, Cached> infoCache = new ConcurrentHashMap<>();
  // Same link ke liye ek hi yt-dlp chalta hai (auto-check + button click dono
  // aaye to bhi)
  private final Map<String, CompletableFuture<MediaInfo>> inflight = new ConcurrentHashMap<>();
  private final ExecutorService infoPool = Executors.newCachedThreadPool(r -> {
    Thread t = new Thread(r, "info-worker");
    t.setDaemon(true);
    return t;
  });
  private final ObjectMapper mapper = new ObjectMapper();

  public YtDlpService(@Value("${ytdlp.max-concurrent:3}") int maxConcurrent) {
    this.slots = new Semaphore(Math.max(1, maxConcurrent));
  }

  public boolean isAllowed(String url) {
    return url != null && url.length() <= 300 && ALLOWED_URL.matcher(url.trim()).matches();
  }

  public String platform(String url) {
    return url.toLowerCase().contains("instagram.com") ? "instagram" : "youtube";
  }

  // ---------------- INFO ----------------
  public MediaInfo fetchInfo(String url) {
    Cached c = infoCache.get(url);
    if (c != null && c.expires() > System.currentTimeMillis()) {
      return c.info();
    }

    // Is link ka yt-dlp pehle se chal raha ho to naya nahi chalta, uska wait karta
    // hai
    CompletableFuture<MediaInfo> f = inflight.computeIfAbsent(url,
        k -> CompletableFuture.supplyAsync(() -> loadInfo(k), infoPool));

    try {
      MediaInfo fresh = f.get(60, TimeUnit.SECONDS);

      if (infoCache.size() > 500) {
        infoCache.clear();
      }
      infoCache.put(url, new Cached(fresh, System.currentTimeMillis() + 10 * 60_000L));
      return fresh;

    } catch (ExecutionException e) {
      if (e.getCause() instanceof ApiException api) {
        throw api;
      }
      throw new ApiException(HttpStatus.BAD_GATEWAY, "Could not read media details.");
    } catch (TimeoutException e) {
      throw new ApiException(HttpStatus.GATEWAY_TIMEOUT, "Timed out while fetching the media.");
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "Interrupted. Please try again.");
    } finally {
      inflight.remove(url, f);
    }
  }

  private MediaInfo loadInfo(String url) {
    List<String> cmd = baseArgs();
    cmd.add("-J");
    if ("youtube".equals(platform(url))) {
      // Tez: HLS manifest aur auto-translated subtitles ka kaam skip (inki zaroorat
      // nahi)
      cmd.add("--extractor-args");
      cmd.add("youtube:skip=hls,translated_subs");
    }
    cmd.add(url);

    ProcResult r = run(cmd, 40);
    String out = r.out().trim();

    if (r.exit() != 0 || !out.startsWith("{")) {
      log.warn("yt-dlp info failed: {}", r.err());
      throw new ApiException(HttpStatus.BAD_GATEWAY, friendlyError(r.err()));
    }

    try {
      JsonNode root = mapper.readTree(out);
      JsonNode item = root;
      JsonNode entries = root.path("entries");
      if (entries.isArray() && entries.size() > 0 && !entries.get(0).isNull()) {
        item = entries.get(0); // carousel: pehla item
      }

      String title = item.path("title").asText(root.path("title").asText("Video"));
      String thumb = item.path("thumbnail").asText(root.path("thumbnail").asText(null));
      return new MediaInfo(platform(url), title, thumb, qualities(item), audioSize(item),
          item.path("duration").asDouble(0));
    } catch (IOException e) {
      throw new ApiException(HttpStatus.BAD_GATEWAY, "Could not read media details.");
    }
  }

  /*
   * "Quality" = video ki chhoti side. 1080x1920 (vertical reel) bhi 1080p hai,
   * 1920x1080 (landscape) bhi 1080p. Isse vertical reels galti se "locked" nahi
   * hongi.
   */
  private static List<QualityInfo> qualities(JsonNode item) {
    double duration = item.path("duration").asDouble(0);
    long audio = audioSize(item);

    // Har quality ke liye ek format chuno (H.264 ko prefer, jaise download me hota
    // hai)
    Map<Integer, JsonNode> best = new TreeMap<>();
    for (JsonNode f : item.path("formats")) {
      if ("none".equals(f.path("vcodec").asText("none"))) {
        continue;
      }
      int w = f.path("width").asInt(0);
      int h = f.path("height").asInt(0);
      int q = (w > 0 && h > 0) ? Math.min(w, h) : Math.max(w, h);
      if (q <= 0) {
        continue;
      }
      JsonNode cur = best.get(q);
      if (cur == null || better(f, cur)) {
        best.put(q, f);
      }
    }

    List<QualityInfo> out = new ArrayList<>();
    for (Map.Entry<Integer, JsonNode> e : best.entrySet()) {
      JsonNode f = e.getValue();
      long size = formatSize(f, duration);
      boolean hasAudio = !"none".equals(f.path("acodec").asText("none"));
      if (size > 0 && !hasAudio) {
        size += audio; // sirf-video format hai, to audio ka size bhi jodo
      }
      out.add(new QualityInfo(e.getKey(), size));
    }
    return out;
  }

  private static boolean better(JsonNode a, JsonNode b) {
    boolean ah = a.path("vcodec").asText("").startsWith("avc1");
    boolean bh = b.path("vcodec").asText("").startsWith("avc1");
    if (ah != bh) {
      return ah;
    }
    return a.path("tbr").asDouble(0) > b.path("tbr").asDouble(0);
  }

  /**
   * Format ka size (bytes): pehle exact, phir approx, phir bitrate x duration se
   * andaza.
   */
  private static long formatSize(JsonNode f, double duration) {
    long size = f.path("filesize").asLong(0);
    if (size <= 0) {
      size = f.path("filesize_approx").asLong(0);
    }
    if (size <= 0) {
      double tbr = f.path("tbr").asDouble(0); // kbit/s
      if (tbr > 0 && duration > 0) {
        size = (long) (tbr * duration * 125); // kbit/s -> bytes
      }
    }
    return Math.max(size, 0);
  }

  /** Sabse achhe audio-only format (m4a ko prefer) ka size. */
  private static long audioSize(JsonNode item) {
    double duration = item.path("duration").asDouble(0);
    long best = 0;
    long bestScore = -1;
    for (JsonNode f : item.path("formats")) {
      boolean noVideo = "none".equals(f.path("vcodec").asText("none"));
      boolean hasAudio = !"none".equals(f.path("acodec").asText("none"));
      if (!noVideo || !hasAudio) {
        continue;
      }
      long size = formatSize(f, duration);
      long score = ("m4a".equals(f.path("ext").asText("")) ? 1_000_000L : 0L)
          + (long) f.path("abr").asDouble(0);
      if (size > 0 && score > bestScore) {
        bestScore = score;
        best = size;
      }
    }
    return best;
  }

  // ---------------- DOWNLOAD ----------------
  /**
   * Media temp folder me download karke file ka path deta hai. Baad me cleanup()
   * zaroor chalao.
   */
  public Path download(String url, int maxQuality) {

    boolean got;
    try {
      got = slots.tryAcquire(5, TimeUnit.SECONDS);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "Interrupted. Please try again.");
    }
    if (!got) {
      throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "Server is busy. Please try again in a minute.");
    }

    Path dir = null;
    try {
      dir = Files.createTempDirectory("dl-");

      // Quality cap hard hai: chhoti side <= maxQuality. Cap se upar wala format
      // kabhi nahi chunega.
      String q = String.valueOf(maxQuality);
      String selector = "bv*[height<=?" + q + "]+ba/bv*[width<=?" + q + "]+ba"
          + "/b[height<=?" + q + "]/b[width<=?" + q + "]";

      List<String> cmd = baseArgs();
      cmd.add("--playlist-items");
      cmd.add("1");
      cmd.add("--max-filesize");
      cmd.add(maxFilesize);
      cmd.add("-N"); // 4 parts ek saath download (YouTube ke liye tez)
      cmd.add("4");
      cmd.add("--no-mtime");
      // Same quality me H.264 video + AAC audio ko prefer karo (har player me chalta
      // hai).
      // Default me YouTube AV1 + Opus deta hai jo Windows Media Player nahi chala
      // pata.
      cmd.add("-S");
      cmd.add("res,vcodec:h264,acodec:aac");
      cmd.add("-f");
      cmd.add(selector);
      cmd.add("--merge-output-format");
      cmd.add("mp4");
      cmd.add("-o");
      cmd.add(dir.resolve("media.%(ext)s").toString());
      cmd.add(url);

      ProcResult r = run(cmd, 300);

      if (r.exit() != 0) {
        log.warn("yt-dlp download failed: {}", r.err());
        deleteDir(dir);
        throw new ApiException(HttpStatus.BAD_GATEWAY, friendlyError(r.err()));
      }

      if (!r.err().isBlank()) {
        log.info("yt-dlp: {}", r.err().trim());
      }

      String errLower = r.err().toLowerCase();
      if (errLower.contains("ffmpeg is not installed") || errLower.contains("ffmpeg not found")) {
        log.error("ffmpeg nahi mila, video aur audio jud nahi sakte. PATH theek karo ya "
            + "application.properties me ytdlp.ffmpeg-location set karo.");
        deleteDir(dir);
        throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR,
            "Server setup problem: ffmpeg is missing, so video and audio could not be merged.");
      }

      // Final (merge hui) file ka naam sirf "media.mp4" jaisa hota hai.
      // "media.f251.webm" jaise
      // naam adhoore tukde hain (sirf audio ya sirf video), wo user ko kabhi nahi
      // dene.
      try (Stream<Path> files = Files.list(dir)) {
        List<Path> all = files.toList();
        Path found = all.stream()
            .filter(p -> p.getFileName().toString().matches("(?i)media\\.[a-z0-9]{2,5}"))
            .findFirst()
            .orElse(null);
        if (found == null) {
          log.error("Merged file nahi bani. Temp folder me files: {}. ffmpeg PATH me hai? File bahut badi to nahi?",
              all.stream().map(x -> x.getFileName().toString()).toList());
          deleteDir(dir);
          throw new ApiException(HttpStatus.BAD_GATEWAY,
              "Could not prepare this quality (file too large, or video and audio could not be merged). Try a lower quality.");
        }
        return found;
      }
    } catch (IOException e) {
      deleteDir(dir);
      throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Server storage error.");
    } finally {
      slots.release();
    }
  }

  /** Sirf audio download (mp3 ya m4a). Baad me cleanup() zaroor chalao. */
  public Path downloadAudio(String url, String fmt) {

    boolean got;
    try {
      got = slots.tryAcquire(5, TimeUnit.SECONDS);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "Interrupted. Please try again.");
    }
    if (!got) {
      throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "Server is busy. Please try again in a minute.");
    }

    Path dir = null;
    try {
      dir = Files.createTempDirectory("dl-");

      List<String> cmd = baseArgs();
      cmd.add("--playlist-items");
      cmd.add("1");
      cmd.add("--max-filesize");
      cmd.add(maxFilesize);
      cmd.add("-N");
      cmd.add("4");
      cmd.add("--no-mtime");
      cmd.add("-f");
      // m4a me original AAC mil jaata hai (re-encode nahi hota, tez); mp3 ke liye
      // ffmpeg convert karta hai
      cmd.add("m4a".equals(fmt) ? "bestaudio[ext=m4a]/bestaudio/best" : "bestaudio/best");
      cmd.add("-x");
      cmd.add("--audio-format");
      cmd.add(fmt);
      cmd.add("--audio-quality");
      cmd.add("0");
      cmd.add("-o");
      cmd.add(dir.resolve("media.%(ext)s").toString());
      cmd.add(url);

      ProcResult r = run(cmd, 300);

      if (r.exit() != 0) {
        log.warn("yt-dlp audio failed: {}", r.err());
        deleteDir(dir);
        throw new ApiException(HttpStatus.BAD_GATEWAY, friendlyError(r.err()));
      }

      try (Stream<Path> files = Files.list(dir)) {
        Path found = files
            .filter(p -> !p.getFileName().toString().endsWith(".part"))
            .findFirst()
            .orElse(null);
        if (found == null) {
          deleteDir(dir);
          throw new ApiException(HttpStatus.BAD_GATEWAY, "Audio download failed. Please try again.");
        }
        return found;
      }
    } catch (IOException e) {
      deleteDir(dir);
      throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Server storage error.");
    } finally {
      slots.release();
    }
  }

  public void cleanup(Path file) {
    if (file != null) {
      deleteDir(file.getParent());
    }
  }

  // ---------------- helpers ----------------
  private List<String> baseArgs() {
    List<String> cmd = new ArrayList<>();
    cmd.add(ytDlpPath);
    cmd.add("--no-warnings");
    cmd.add("--no-playlist");
    cmd.add("--socket-timeout");
    cmd.add("15");
    if (cookies != null && !cookies.isBlank()) {
      cmd.add("--cookies");
      cmd.add(cookies);
    }
    if (ffmpegLocation != null && !ffmpegLocation.isBlank()) {
      cmd.add("--ffmpeg-location");
      cmd.add(ffmpegLocation);
    }
    return cmd;
  }

  private Process startProcess(List<String> cmd) {
    try {
      return new ProcessBuilder(cmd).start();
    } catch (IOException e) {
      log.error("Cannot start yt-dlp ({}): {}", ytDlpPath, e.getMessage());
      throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR,
          "Downloader is not set up on the server (yt-dlp not found).");
    }
  }

  private ProcResult run(List<String> cmd, int timeoutSec) {
    final Process p = startProcess(cmd); // shell nahi, args list -> injection nahi

    CompletableFuture<String> out = CompletableFuture.supplyAsync(() -> readAll(p.getInputStream()));
    CompletableFuture<String> err = CompletableFuture.supplyAsync(() -> readAll(p.getErrorStream()));

    try {
      if (!p.waitFor(timeoutSec, TimeUnit.SECONDS)) {
        killTree(p);
        throw new ApiException(HttpStatus.GATEWAY_TIMEOUT, "Timed out while fetching the media.");
      }
      return new ProcResult(p.exitValue(), out.get(10, TimeUnit.SECONDS), err.get(10, TimeUnit.SECONDS));
    } catch (InterruptedException e) {
      killTree(p);
      Thread.currentThread().interrupt();
      throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "Interrupted. Please try again.");
    } catch (ExecutionException | TimeoutException e) {
      killTree(p);
      throw new ApiException(HttpStatus.BAD_GATEWAY, "Downloader failed. Please try again.");
    }
  }

  private static void killTree(Process p) {
    p.descendants().forEach(ProcessHandle::destroyForcibly);
    p.destroyForcibly();
  }

  private static String readAll(InputStream in) {
    try (in) {
      return new String(in.readAllBytes(), StandardCharsets.UTF_8);
    } catch (IOException e) {
      return "";
    }
  }

  private static void deleteDir(Path dir) {
    if (dir == null) {
      return;
    }
    try (Stream<Path> walk = Files.walk(dir)) {
      walk.sorted(Comparator.reverseOrder()).forEach(p -> {
        try {
          Files.deleteIfExists(p);
        } catch (IOException ignored) {
        }
      });
    } catch (IOException ignored) {
    }
  }

  private static String friendlyError(String stderr) {
    String s = stderr == null ? "" : stderr.toLowerCase();
    if (s.contains("ffmpeg") && (s.contains("not found") || s.contains("not installed"))) {
      return "Server setup problem: ffmpeg is missing.";
    }
    if (s.contains("login required") || s.contains("rate-limit") || s.contains("cookies")) {
      return "Instagram is asking for login for this link (private post, or this server was blocked). Try another public link.";
    }
    if (s.contains("sign in to confirm") || s.contains("not a bot")) {
      return "YouTube blocked the request from this server. Please try again later.";
    }
    if (s.contains("private")) {
      return "This content is private.";
    }
    if (s.contains("unavailable") || s.contains("not found") || s.contains("404")) {
      return "This content is unavailable or was removed.";
    }
    if (s.contains("requested format is not available")) {
      return "This quality is not available for this video.";
    }
    if (s.contains("larger than max-filesize") || s.contains("max-filesize")) {
      return "This file is too large to download here.";
    }
    return "Could not fetch this link. Please try again.";
  }
}
