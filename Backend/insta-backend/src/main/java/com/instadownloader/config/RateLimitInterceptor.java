package com.instadownloader.config;

import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Simple per-IP limit (fixed 1-minute window, memory me).
 * Ye interceptor hai (filter nahi), taaki 429 response me bhi CORS headers
 * aayein.
 */
@Component
public class RateLimitInterceptor implements HandlerInterceptor {

  private static final long WINDOW_MS = 60_000;

  private record Window(long start, AtomicInteger count) {
  }

  private final Map<String, Window> windows = new ConcurrentHashMap<>();

  @Value("${ratelimit.info-per-minute:20}")
  private int infoLimit;

  @Value("${ratelimit.download-per-minute:5}")
  private int downloadLimit;

  @Value("${ratelimit.order-per-minute:10}")
  private int orderLimit;

  @Value("${app.trust-proxy:false}")
  private boolean trustProxy;

  @Override
  public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler)
      throws Exception {

    if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
      return true;
    }

    String path = request.getRequestURI();
    String bucket;
    int limit;

    if (path.startsWith("/api/media/info")) {
      bucket = "info";
      limit = infoLimit;
    } else if (path.startsWith("/api/media/download")) {
      bucket = "download";
      limit = downloadLimit;
    } else if (path.startsWith("/api/premium/order") || path.startsWith("/api/premium/verify")) {
      bucket = "order";
      limit = orderLimit;
    } else {
      return true;
    }

    long now = System.currentTimeMillis();

    if (windows.size() > 10_000) {
      windows.entrySet().removeIf(e -> now - e.getValue().start() >= WINDOW_MS);
    }

    Window w = windows.compute(bucket + ":" + clientIp(request), (k, old) -> {
      if (old == null || now - old.start() >= WINDOW_MS) {
        return new Window(now, new AtomicInteger(1));
      }
      old.count().incrementAndGet();
      return old;
    });

    if (w.count().get() > limit) {
      response.setStatus(429);
      response.setHeader("Retry-After", "60");
      response.setContentType("application/json;charset=UTF-8");
      response.getOutputStream().write(
          "{\"success\":false,\"message\":\"Too many requests. Please try again in a minute.\"}"
              .getBytes(StandardCharsets.UTF_8));
      return false;
    }
    return true;
  }

  private String clientIp(HttpServletRequest request) {
    if (trustProxy) {
      String xff = request.getHeader("X-Forwarded-For");
      if (xff != null && !xff.isBlank()) {
        return xff.split(",")[0].trim();
      }
    }
    return request.getRemoteAddr();
  }
}
