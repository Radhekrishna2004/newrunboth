package com.instadownloader.service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.annotation.PostConstruct;

/**
 * Razorpay order banana, payment verify karna, aur signed "premium token" dena.
 *
 * NOTE: paymentExpiry abhi memory me hai, server restart par saaf ho jaata hai
 * (token phir bhi chalega kyunki wo signed hai). Live karte waqt database me
 * rakho.
 */
@Service
public class PremiumService {

  private static final Logger log = LoggerFactory.getLogger(PremiumService.class);
  private static final Pattern ID = Pattern.compile("^[A-Za-z0-9_]{5,64}$");
  private static final Pattern HEX64 = Pattern.compile("^[a-fA-F0-9]{64}$");

  @Value("${razorpay.key-id}")
  private String keyId;

  @Value("${razorpay.key-secret}")
  private String keySecret;

  @Value("${premium.token-secret}")
  private String tokenSecret;

  @Value("${premium.price-paise:1900}")
  private int pricePaise;

  @Value("${premium.days:30}")
  private int days;

  private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
  private final ObjectMapper mapper = new ObjectMapper();
  private final Map<String, Long> paymentExpiry = new ConcurrentHashMap<>();

  @PostConstruct
  void checkConfig() {
    if (tokenSecret == null || tokenSecret.length() < 32 || tokenSecret.startsWith("CHANGE_ME")) {
      log.warn("premium.token-secret kamzor/default hai. Live karne se pehle lamba random secret daalo!");
    }
  }

  // 1) Frontend Razorpay checkout kholne se pehle order mangta hai
  public Map<String, Object> createOrder() {
    try {
      String body = mapper.writeValueAsString(Map.of(
          "amount", pricePaise,
          "currency", "INR",
          "receipt", "rcpt_" + UUID.randomUUID().toString().substring(0, 12)));

      String auth = Base64.getEncoder()
          .encodeToString((keyId + ":" + keySecret).getBytes(StandardCharsets.UTF_8));

      HttpRequest req = HttpRequest.newBuilder(URI.create("https://api.razorpay.com/v1/orders"))
          .timeout(Duration.ofSeconds(15))
          .header("Authorization", "Basic " + auth)
          .header("Content-Type", "application/json")
          .POST(HttpRequest.BodyPublishers.ofString(body))
          .build();

      HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString());

      if (res.statusCode() != 200) {
        log.warn("Razorpay order failed: {} {}", res.statusCode(), res.body());
        throw new ApiException(HttpStatus.BAD_GATEWAY, "Could not start payment. Please try again.");
      }

      JsonNode json = mapper.readTree(res.body());
      Map<String, Object> out = new LinkedHashMap<>();
      out.put("success", true);
      out.put("orderId", json.path("id").asText());
      out.put("amount", json.path("amount").asInt());
      out.put("currency", json.path("currency").asText("INR"));
      out.put("keyId", keyId); // key id public hoti hai, secret nahi
      return out;

    } catch (ApiException e) {
      throw e;
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "Interrupted. Please try again.");
    } catch (Exception e) {
      log.warn("Razorpay order error: {}", e.getMessage());
      throw new ApiException(HttpStatus.BAD_GATEWAY, "Could not start payment. Please try again.");
    }
  }

  // 2) Payment ke baad Razorpay ka signature check karke premium token deta hai
  public Map<String, Object> verifyAndIssue(String orderId, String paymentId, String signature) {

    if (orderId == null || paymentId == null || signature == null
        || !ID.matcher(orderId).matches()
        || !ID.matcher(paymentId).matches()
        || !HEX64.matcher(signature).matches()) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid payment details.");
    }

    String expected = HexFormat.of().formatHex(hmac(orderId + "|" + paymentId, keySecret));

    boolean ok = MessageDigest.isEqual(
        expected.getBytes(StandardCharsets.UTF_8),
        signature.toLowerCase().getBytes(StandardCharsets.UTF_8));

    if (!ok) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "Payment verification failed.");
    }

    long now = Instant.now().getEpochSecond();
    // Ek payment ek hi baar 30 din deta hai; dobara verify karne se expiry nahi
    // badhti
    long exp = paymentExpiry.computeIfAbsent(paymentId, k -> now + days * 86400L);

    if (exp <= now) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "This premium period has already ended.");
    }

    Map<String, Object> out = new LinkedHashMap<>();
    out.put("success", true);
    out.put("token", makeToken(exp, paymentId));
    out.put("expiresAt", exp);
    return out;
  }

  // 3) Token check (download se pehle)
  public boolean isValid(String token) {
    return validUntil(token) > 0;
  }

  /** Token sahi aur expire nahi hua to expiry (epoch seconds), warna 0. */
  public long validUntil(String token) {
    try {
      if (token == null || token.length() > 300) {
        return 0;
      }
      String[] parts = token.split("\\.");
      if (parts.length != 2) {
        return 0;
      }
      String payload = new String(Base64.getUrlDecoder().decode(parts[0]), StandardCharsets.UTF_8);
      byte[] sig = Base64.getUrlDecoder().decode(parts[1]);

      if (!MessageDigest.isEqual(hmac(payload, tokenSecret), sig)) {
        return 0;
      }

      long exp = Long.parseLong(payload.substring(0, payload.indexOf('.')));
      return exp > Instant.now().getEpochSecond() ? exp : 0;
    } catch (Exception e) {
      return 0;
    }
  }

  private String makeToken(long exp, String paymentId) {
    String payload = exp + "." + paymentId;
    Base64.Encoder enc = Base64.getUrlEncoder().withoutPadding();
    return enc.encodeToString(payload.getBytes(StandardCharsets.UTF_8))
        + "." + enc.encodeToString(hmac(payload, tokenSecret));
  }

  private static byte[] hmac(String data, String secret) {
    try {
      Mac mac = Mac.getInstance("HmacSHA256");
      mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
      return mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
    } catch (Exception e) {
      throw new IllegalStateException("HMAC error", e);
    }
  }
}
