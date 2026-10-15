package com.instadownloader.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

  // Default me localhost (local testing) aur Render wali frontend site dono
  // allowed hain.
  // Agar Render me app.cors.origins / APP_CORS_ORIGINS set hoga to wahi value use
  // hogi.
  @Value("${app.cors.origins:http://localhost:5173,https://fastest-insta-rk.onrender.com}")
  private String origins;

  private final RateLimitInterceptor rateLimit;

  public WebConfig(RateLimitInterceptor rateLimit) {
    this.rateLimit = rateLimit;
  }

  @Override
  public void addCorsMappings(CorsRegistry registry) {
    registry.addMapping("/api/**")
        .allowedOrigins(origins.trim().split("\\s*,\\s*"))
        .allowedMethods("GET", "POST", "OPTIONS")
        .allowedHeaders("*")
        .exposedHeaders("Content-Disposition")
        .maxAge(3600);
  }

  @Override
  public void addInterceptors(InterceptorRegistry registry) {
    registry.addInterceptor(rateLimit).addPathPatterns("/api/**");
  }
}
