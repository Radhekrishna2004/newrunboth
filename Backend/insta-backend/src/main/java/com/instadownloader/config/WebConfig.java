package com.instadownloader.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

  @Value("${app.cors.origins:http://localhost:5173}")
  private String origins;

  private final RateLimitInterceptor rateLimit;

  public WebConfig(RateLimitInterceptor rateLimit) {
    this.rateLimit = rateLimit;
  }

  @Override
  public void addCorsMappings(CorsRegistry registry) {
    registry.addMapping("/api/**")
        .allowedOrigins(origins.split("\\s*,\\s*"))
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
