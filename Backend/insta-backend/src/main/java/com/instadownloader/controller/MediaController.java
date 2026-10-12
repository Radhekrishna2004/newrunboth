
package com.instadownloader.controller;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.instadownloader.service.ApiException;
import com.instadownloader.service.PremiumService;
import com.instadownloader.service.YtDlpService;
import com.instadownloader.service.YtDlpService.MediaInfo;
import com.instadownloader.service.YtDlpService.QualityInfo;

import jakarta.servlet.http.HttpServletResponse;

@RestController
@RequestMapping("/api/media")
public class MediaController {

  private static final int FREE_MAX_QUALITY = 4320;
  private static final int BUFFER_SIZE = 1024 * 1024;

  private final YtDlpService ytDlp;
  private final PremiumService premium;

  public MediaController(
      YtDlpService ytDlp,
      PremiumService premium) {
    this.ytDlp = ytDlp;
    this.premium = premium;
  }

  @RequestMapping(value = "/info", method = { RequestMethod.GET, RequestMethod.POST })
  public Map<String, Object> info(
      @RequestParam("url") String url) {

    if (!ytDlp.isAllowed(url)) {
      throw new ApiException(
          HttpStatus.BAD_REQUEST,
          "Invalid or unsupported link.");
    }

    MediaInfo info = ytDlp.fetchInfo(url.trim());

    List<Map<String, Object>> formats = new ArrayList<>();

    for (QualityInfo qi : info.qualities()) {
      int q = qi.quality();

      if (q < 144) {
        continue;
      }

      Map<String, Object> format = new LinkedHashMap<>();
      format.put("quality", q + "p");
      format.put("value", q);
      format.put("locked", q > FREE_MAX_QUALITY);
      format.put("size", qi.size());

      formats.add(format);
    }

    Map<String, Object> result = new LinkedHashMap<>();
    result.put("success", true);
    result.put("platform", info.platform());
    result.put("title", info.title());
    result.put("thumbnail", info.thumbnail());
    result.put("freeMaxQuality", FREE_MAX_QUALITY);
    result.put("audioSize", info.audioSize());
    result.put("mp3Size",
        (long) (info.duration() * 245 * 125));
    result.put("formats", formats);

    return result;
  }

  @GetMapping("/download")
  public void download(
      @RequestParam("url") String url,
      @RequestParam(value = "quality", defaultValue = "720p") String quality,
      @RequestParam(value = "audio", required = false) String audio,
      @RequestParam(value = "token", required = false) String token,
      HttpServletResponse response) throws IOException {

    if (!ytDlp.isAllowed(url)) {
      throw new ApiException(
          HttpStatus.BAD_REQUEST,
          "Invalid or unsupported link.");
    }

    Path file = null;

    try {
      if (audio != null && !audio.isBlank()) {
        String format = audio.trim().toLowerCase();

        if (!format.equals("mp3")
            && !format.equals("m4a")) {
          throw new ApiException(
              HttpStatus.BAD_REQUEST,
              "Invalid audio format.");
        }

        file = ytDlp.downloadAudio(url.trim(), format);

      } else {
        int requestedQuality = parseQuality(quality);

        if (requestedQuality > FREE_MAX_QUALITY
            && !premium.isValid(token)) {
          throw new ApiException(
              HttpStatus.PAYMENT_REQUIRED,
              "This quality needs Premium.");
        }

        file = ytDlp.download(
            url.trim(), requestedQuality);
      }

      if (file == null || !Files.isRegularFile(file)) {
        throw new IOException(
            "Downloaded file was not found.");
      }

      long fileSize = Files.size(file);

      String originalName = file.getFileName().toString();

      String extension = originalName.contains(".")
          ? originalName.substring(
              originalName.lastIndexOf('.') + 1)
              .toLowerCase()
          : "mp4";

      response.setContentType(contentType(extension));

      response.setHeader(
          HttpHeaders.CONTENT_DISPOSITION,
          ContentDisposition.attachment()
              .filename("download." + extension)
              .build()
              .toString());

      response.setContentLengthLong(fileSize);

      byte[] buffer = new byte[BUFFER_SIZE];

      try (InputStream input = Files.newInputStream(file)) {

        OutputStream output = response.getOutputStream();
        int bytesRead;

        while ((bytesRead = input.read(buffer)) != -1) {
          output.write(buffer, 0, bytesRead);
        }

        output.flush();
      }

    } catch (IOException e) {
      if (!response.isCommitted()) {
        response.reset();
        response.setStatus(
            HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
        response.setContentType("text/plain;charset=UTF-8");
        response.getWriter().write(
            "Download failed. Check server logs and available disk space.");
      } else {
        throw e;
      }

    } finally {
      if (file != null) {
        ytDlp.cleanup(file);
      }
    }
  }

  private static int parseQuality(String quality) {
    String value = quality == null
        ? ""
        : quality.trim().toLowerCase();

    if (value.equals("best")) {
      return FREE_MAX_QUALITY;
    }

    if (value.equals("4k")) {
      return 2160;
    }

    if (value.endsWith("p")) {
      value = value.substring(
          0, value.length() - 1);
    }

    try {
      int resolution = Integer.parseInt(value);

      if (resolution >= 100 && resolution <= 4320) {
        return resolution;
      }
    } catch (NumberFormatException ignored) {
      // Invalid quality is handled below.
    }

    throw new ApiException(
        HttpStatus.BAD_REQUEST,
        "Invalid quality.");
  }

  private static String contentType(String extension) {
    return switch (extension) {
      case "mp4" -> "video/mp4";
      case "webm" -> "video/webm";
      case "mp3" -> "audio/mpeg";
      case "m4a" -> "audio/mp4";
      case "jpg", "jpeg" -> "image/jpeg";
      case "png" -> "image/png";
      case "webp" -> "image/webp";
      default -> "application/octet-stream";
    };
  }
}
