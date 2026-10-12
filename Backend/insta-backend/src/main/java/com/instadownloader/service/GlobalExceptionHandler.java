package com.instadownloader.service;

import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {

  @ExceptionHandler(ApiException.class)
  public ResponseEntity<Map<String, Object>> onApi(ApiException e) {
    return ResponseEntity.status(e.getStatus())
        .body(Map.<String, Object>of("success", false, "message", e.getMessage()));
  }

  @ExceptionHandler(MissingServletRequestParameterException.class)
  public ResponseEntity<Map<String, Object>> onMissing(MissingServletRequestParameterException e) {
    return ResponseEntity.badRequest()
        .body(Map.<String, Object>of("success", false,
            "message", "Missing parameter: " + e.getParameterName()));
  }
}