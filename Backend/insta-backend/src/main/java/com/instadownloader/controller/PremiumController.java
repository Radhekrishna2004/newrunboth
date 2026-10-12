package com.instadownloader.controller;

import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.instadownloader.service.PremiumService;

@RestController
@RequestMapping("/api/premium")
public class PremiumController {

  public record VerifyRequest(
      @JsonProperty("razorpay_order_id") String orderId,
      @JsonProperty("razorpay_payment_id") String paymentId,
      @JsonProperty("razorpay_signature") String signature) {
  }

  private final PremiumService premium;

  public PremiumController(PremiumService premium) {
    this.premium = premium;
  }

  /** Step 1: ₹19 ka order banao -> frontend Razorpay checkout kholega. */
  @PostMapping("/order")
  public Map<String, Object> order() {
    return premium.createOrder();
  }

  /**
   * Step 2: payment ke baad Razorpay ke 3 values bhejo -> premium token milega.
   */
  @PostMapping("/verify")
  public Map<String, Object> verify(@RequestBody VerifyRequest r) {
    return premium.verifyAndIssue(r.orderId(), r.paymentId(), r.signature());
  }

  /**
   * Frontend page load par check kare ki saved token abhi bhi valid hai ya nahi.
   */
  @GetMapping("/status")
  public Map<String, Object> status(
      @RequestHeader(value = "X-Premium-Token", required = false) String token) {

    long exp = premium.validUntil(token);

    Map<String, Object> out = new LinkedHashMap<>();
    out.put("success", true);
    out.put("active", exp > 0);
    out.put("expiresAt", exp);
    return out;
  }
}
