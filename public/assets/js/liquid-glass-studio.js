/**
 * LiquidGlassStudio — standalone vanilla JS WebGL library
 * Extracted and bundled from iyinchao/liquid-glass-studio
 * UMD pattern, no dependencies (html2canvas optional)
 * STEP hardcoded to 9 (full production effect)
 */
(function (root, factory) {
  'use strict';
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.LiquidGlassStudio = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // GLSL Shaders (inlined as template strings)
  // ---------------------------------------------------------------------------

  var VERTEX_SHADER = `#version 300 es

in vec4 a_position;
out vec2 v_uv;

void main() {
  v_uv = (a_position.xy + 1.0) * 0.5;
  gl_Position = a_position;
}`;

  var FRAGMENT_BG_SHADER = `#version 300 es

precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform vec2 u_resolution;
uniform float u_dpr;
uniform vec2 u_mouse;
uniform vec2 u_mouseSpring;
uniform float u_time;
uniform float u_mergeRate;
uniform float u_shapeWidth;
uniform float u_shapeHeight;
uniform float u_shapeRadius;
uniform float u_shapeRoundness;
uniform float u_shadowExpand;
uniform float u_shadowFactor;
uniform vec2 u_shadowPosition;
uniform int u_bgType;
uniform sampler2D u_bgTexture;
uniform float u_bgTextureRatio;
uniform int u_bgTextureReady;
uniform int u_showShape1;

float chessboard(vec2 uv, float size, int mode) {
  float yBars = step(size * 2.0, mod(uv.y * 2.0, size * 4.0));
  float xBars = step(size * 2.0, mod(uv.x * 2.0, size * 4.0));
  if (mode == 0) {
    return yBars;
  } else if (mode == 1) {
    return xBars;
  } else {
    return abs(yBars - xBars);
  }
}

float halfColor(vec2 uv) {
  if (uv.y > 0.5) {
    return 1.0;
  } else {
    return 0.0;
  }
}

float sdCircle(vec2 p, float r) {
  return length(p) - r;
}

float superellipseCornerSDF(vec2 p, float r, float n) {
  p = abs(p);
  float v = pow(pow(p.x, n) + pow(p.y, n), 1.0 / n);
  return v - r;
}

float roundedRectSDF(vec2 p, vec2 center, float width, float height, float cornerRadius, float n) {
  p -= center;
  float cr = cornerRadius * u_dpr;
  vec2 d = abs(p) - vec2(width * u_dpr, height * u_dpr) * 0.5;
  float dist;
  if (d.x > -cr && d.y > -cr) {
    vec2 cornerCenter = sign(p) * (vec2(width * u_dpr, height * u_dpr) * 0.5 - vec2(cr));
    vec2 cornerP = p - cornerCenter;
    dist = superellipseCornerSDF(cornerP, cr, n);
  } else {
    dist = min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
  }
  return dist;
}

float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

float mainSDF(vec2 p1, vec2 p2, vec2 p) {
  vec2 p1n = p1 + p / u_resolution.y;
  vec2 p2n = p2 + p / u_resolution.y;
  float d1 = u_showShape1 == 1 ? sdCircle(p1n, 100.0 * u_dpr / u_resolution.y) : 1.0;
  float d2 = roundedRectSDF(
    p2n,
    vec2(0.0),
    u_shapeWidth / u_resolution.y,
    u_shapeHeight / u_resolution.y,
    u_shapeRadius / u_resolution.y,
    u_shapeRoundness
  );
  return smin(d1, d2, u_mergeRate);
}

vec2 getCoverUV(vec2 uv, float canvasAspect, float textureAspect) {
  if (canvasAspect > textureAspect) {
    float scale = textureAspect / canvasAspect;
    uv.y = uv.y * scale + 0.5 - 0.5 * scale;
  } else {
    float scale = canvasAspect / textureAspect;
    uv.x = uv.x * scale + 0.5 - 0.5 * scale;
  }
  return uv;
}

void main() {
  vec2 u_resolution1x = u_resolution.xy / u_dpr;
  vec3 bgColor = vec3(1.0);

  if (u_bgType <= 0) {
    bgColor = vec3(1.0 - chessboard(gl_FragCoord.xy / u_dpr, 20.0, 2) / 4.0);
  } else if (u_bgType <= 1) {
    if (v_uv.x < 0.5 && v_uv.y > 0.5) {
      bgColor = vec3(chessboard(gl_FragCoord.xy / u_dpr, 10.0, 0));
    } else if (v_uv.x > 0.5 && v_uv.y < 0.5) {
      bgColor = vec3(chessboard(gl_FragCoord.xy / u_dpr, 10.0, 1));
    } else if (v_uv.x < 0.5 && v_uv.y < 0.5) {
      bgColor = vec3(0.0);
    }
  } else if (u_bgType <= 2) {
    bgColor = vec3(halfColor(gl_FragCoord.xy / u_resolution) * 0.6 + 0.3);
  } else if (u_bgType <= 11) {
    if (u_bgTextureReady != 1) {
      bgColor = vec3(1.0 - chessboard(gl_FragCoord.xy / u_dpr, 20.0, 2) / 4.0);
    } else {
      vec2 uv = getCoverUV(v_uv, u_resolution.x / u_resolution.y, u_bgTextureRatio);
      bgColor = texture(u_bgTexture, uv).rgb;
    }
  }

  vec2 p1 =
    (vec2(0, 0) -
      u_resolution.xy * 0.5 +
      vec2(u_shadowPosition.x * u_dpr, u_shadowPosition.y * u_dpr)) /
    u_resolution.y;
  vec2 p2 =
    (vec2(0, 0) - u_mouseSpring + vec2(u_shadowPosition.x * u_dpr, u_shadowPosition.y * u_dpr)) /
    u_resolution.y;
  float merged = mainSDF(p1, p2, gl_FragCoord.xy);

  float shadow = exp(-1.0 / u_shadowExpand * abs(merged) * u_resolution1x.y) * 0.6 * u_shadowFactor;

  fragColor = vec4(bgColor - vec3(shadow), 1.0);
}`;

  var FRAGMENT_BG_VBLUR_SHADER = `#version 300 es

precision highp float;

#define MAX_BLUR_RADIUS (200)

in vec2 v_uv;

uniform sampler2D u_prevPassTexture;
uniform vec2 u_resolution;
uniform int u_blurRadius;
uniform float u_blurWeights[MAX_BLUR_RADIUS + 1];

out vec4 fragColor;

void main() {
  vec2 texelSize = 1.0 / u_resolution;
  vec4 color = texture(u_prevPassTexture, v_uv) * u_blurWeights[0];
  for (int i = 1; i <= u_blurRadius; ++i) {
    float w = u_blurWeights[i];
    vec2 offset = vec2(float(i)) * texelSize;
    color += texture(u_prevPassTexture, v_uv + vec2(offset.x, 0.0)) * w;
    color += texture(u_prevPassTexture, v_uv - vec2(offset.x, 0.0)) * w;
  }
  fragColor = color;
}`;

  var FRAGMENT_BG_HBLUR_SHADER = `#version 300 es

precision highp float;

#define MAX_BLUR_RADIUS (200)

in vec2 v_uv;

uniform sampler2D u_prevPassTexture;
uniform vec2 u_resolution;
uniform int u_blurRadius;
uniform float u_blurWeights[MAX_BLUR_RADIUS + 1];

out vec4 fragColor;

void main() {
  vec2 texelSize = 1.0 / u_resolution;
  vec4 color = texture(u_prevPassTexture, v_uv) * u_blurWeights[0];
  for (int i = 1; i <= u_blurRadius; ++i) {
    float w = u_blurWeights[i];
    vec2 offset = vec2(float(i)) * texelSize;
    color += texture(u_prevPassTexture, v_uv + vec2(0.0, offset.y)) * w;
    color += texture(u_prevPassTexture, v_uv - vec2(0.0, offset.y)) * w;
  }
  fragColor = color;
}`;

  // STEP=9 only — debug paths (STEP 0-8) stripped for production size reduction
  var FRAGMENT_MAIN_SHADER = `#version 300 es

precision highp float;

#define PI (3.14159265359)

const float N_R = 1.0 - 0.02;
const float N_G = 1.0;
const float N_B = 1.0 + 0.02;

in vec2 v_uv;
uniform sampler2D u_blurredBg;
uniform sampler2D u_bg;
uniform vec2 u_resolution;
uniform float u_dpr;
uniform vec2 u_mouse;
uniform vec2 u_mouseSpring;
uniform float u_mergeRate;
uniform float u_shapeWidth;
uniform float u_shapeHeight;
uniform float u_shapeRadius;
uniform float u_shapeRoundness;
uniform vec4 u_tint;
uniform float u_refThickness;
uniform float u_refFactor;
uniform float u_refDispersion;
uniform float u_refFresnelRange;
uniform float u_refFresnelFactor;
uniform float u_refFresnelHardness;
uniform float u_glareRange;
uniform float u_glareConvergence;
uniform float u_glareOppositeFactor;
uniform float u_glareFactor;
uniform float u_glareHardness;
uniform float u_glareAngle;
uniform int u_blurEdge;
uniform int u_showShape1;

out vec4 fragColor;

float sdCircle(vec2 p, float r) {
  return length(p) - r;
}

float superellipseCornerSDF(vec2 p, float r, float n) {
  p = abs(p);
  float v = pow(pow(p.x, n) + pow(p.y, n), 1.0 / n);
  return v - r;
}

float roundedRectSDF(vec2 p, vec2 center, float width, float height, float cornerRadius, float n) {
  p -= center;
  float cr = cornerRadius * u_dpr;
  vec2 d = abs(p) - vec2(width * u_dpr, height * u_dpr) * 0.5;
  float dist;
  if (d.x > -cr && d.y > -cr) {
    vec2 cornerCenter = sign(p) * (vec2(width * u_dpr, height * u_dpr) * 0.5 - vec2(cr));
    vec2 cornerP = p - cornerCenter;
    dist = superellipseCornerSDF(cornerP, cr, n);
  } else {
    dist = min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
  }
  return dist;
}

float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

float mainSDF(vec2 p1, vec2 p2, vec2 p) {
  vec2 p1n = p1 + p / u_resolution.y;
  vec2 p2n = p2 + p / u_resolution.y;
  float d1 = u_showShape1 == 1 ? sdCircle(p1n, 100.0 * u_dpr / u_resolution.y) : 1.0;
  float d2 = roundedRectSDF(
    p2n,
    vec2(0.0),
    u_shapeWidth / u_resolution.y,
    u_shapeHeight / u_resolution.y,
    u_shapeRadius / u_resolution.y,
    u_shapeRoundness
  );
  return smin(d1, d2, u_mergeRate);
}

vec2 getNormal(vec2 p1, vec2 p2, vec2 p) {
  vec2 h = vec2(max(abs(dFdx(p.x)), 0.0001), max(abs(dFdy(p.y)), 0.0001));
  vec2 grad =
    vec2(
      mainSDF(p1, p2, p + vec2(h.x, 0.0)) - mainSDF(p1, p2, p - vec2(h.x, 0.0)),
      mainSDF(p1, p2, p + vec2(0.0, h.y)) - mainSDF(p1, p2, p - vec2(0.0, h.y))
    ) /
    (2.0 * h);
  return grad * 1.414213562 * 1000.0;
}

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

const vec3 D65_WHITE = vec3(0.95045592705, 1.0, 1.08905775076);
const vec3 D50_WHITE = vec3(0.96429567643, 1.0, 0.82510460251);
vec3 WHITE = D65_WHITE;
const mat3 RGB_TO_XYZ_M = mat3(
  0.4124, 0.3576, 0.1805,
  0.2126, 0.7152, 0.0722,
  0.0193, 0.1192, 0.9505
);
const mat3 XYZ_TO_XYZ50_M = mat3(
   1.0479298208405488  ,  0.022946793341019088, -0.05019222954313557 ,
   0.029627815688159344,  0.990434484573249   , -0.01707382502938514 ,
  -0.009243058152591178,  0.015055144896577895,  0.7518742899580008
);
const mat3 XYZ_TO_RGB_M = mat3(
   3.2406255, -1.537208 , -0.4986286,
  -0.9689307,  1.8757561,  0.0415175,
   0.0557101, -0.2040211,  1.0569959
);
const mat3 XYZ50_TO_XYZ_M = mat3(
   0.9554734527042182  , -0.023098536874261423,  0.0632593086610217  ,
  -0.028369706963208136,  1.0099954580058226  ,  0.021041398966943008,
   0.012314001688319899, -0.020507696433477912,  1.3303659366080753
);
float UNCOMPAND_SRGB(float a) {
  return a > 0.04045
    ? pow((a + 0.055) / 1.055, 2.4)
    : a / 12.92;
}
float COMPAND_RGB(float a) {
  return a <= 0.0031308
    ? 12.92 * a
    : 1.055 * pow(a, 0.41666666666) - 0.055;
}
vec3 RGB_TO_XYZ(vec3 rgb) {
  return WHITE == D65_WHITE
    ? rgb * RGB_TO_XYZ_M
    : rgb * RGB_TO_XYZ_M * XYZ_TO_XYZ50_M;
}
vec3 SRGB_TO_RGB(vec3 srgb) {
  return vec3(UNCOMPAND_SRGB(srgb.x), UNCOMPAND_SRGB(srgb.y), UNCOMPAND_SRGB(srgb.z));
}
vec3 RGB_TO_SRGB(vec3 rgb) {
  return vec3(COMPAND_RGB(rgb.x), COMPAND_RGB(rgb.y), COMPAND_RGB(rgb.z));
}
vec3 SRGB_TO_XYZ(vec3 srgb) {
  return RGB_TO_XYZ(SRGB_TO_RGB(srgb));
}
float XYZ_TO_LAB_F(float x) {
  return x > 0.00885645167
    ? pow(x, 0.333333333)
    : 7.78703703704 * x + 0.13793103448;
}
vec3 XYZ_TO_LAB(vec3 xyz) {
  vec3 xyz_scaled = xyz / WHITE;
  xyz_scaled = vec3(
    XYZ_TO_LAB_F(xyz_scaled.x),
    XYZ_TO_LAB_F(xyz_scaled.y),
    XYZ_TO_LAB_F(xyz_scaled.z)
  );
  return vec3(
    116.0 * xyz_scaled.y - 16.0,
    500.0 * (xyz_scaled.x - xyz_scaled.y),
    200.0 * (xyz_scaled.y - xyz_scaled.z)
  );
}
vec3 SRGB_TO_LAB(vec3 srgb) {
  return XYZ_TO_LAB(SRGB_TO_XYZ(srgb));
}
vec3 LAB_TO_LCH(vec3 Lab) {
  return vec3(Lab.x, sqrt(dot(Lab.yz, Lab.yz)), atan(Lab.z, Lab.y) * 57.2957795131);
}
vec3 SRGB_TO_LCH(vec3 srgb) {
  return LAB_TO_LCH(SRGB_TO_LAB(srgb));
}
vec3 XYZ_TO_RGB(vec3 xyz) {
  return WHITE == D65_WHITE
    ? xyz * XYZ_TO_RGB_M
    : xyz * XYZ50_TO_XYZ_M * XYZ_TO_RGB_M;
}
vec3 XYZ_TO_SRGB(vec3 xyz) {
  return RGB_TO_SRGB(XYZ_TO_RGB(xyz));
}
float LAB_TO_XYZ_F(float x) {
  return x > 0.206897
    ? x * x * x
    : 0.12841854934 * (x - 0.137931034);
}
vec3 LAB_TO_XYZ(vec3 Lab) {
  float w = (Lab.x + 16.0) / 116.0;
  return WHITE *
  vec3(LAB_TO_XYZ_F(w + Lab.y / 500.0), LAB_TO_XYZ_F(w), LAB_TO_XYZ_F(w - Lab.z / 200.0));
}
vec3 LAB_TO_SRGB(vec3 lab) {
  return XYZ_TO_SRGB(LAB_TO_XYZ(lab));
}
vec3 LCH_TO_LAB(vec3 LCh) {
  return vec3(LCh.x, LCh.y * cos(LCh.z * 0.01745329251), LCh.y * sin(LCh.z * 0.01745329251));
}
vec3 LCH_TO_SRGB(vec3 lch) {
  return LAB_TO_SRGB(LCH_TO_LAB(lch));
}

float vec2ToAngle(vec2 v) {
  float angle = atan(v.y, v.x);
  if (angle < 0.0) angle += 2.0 * PI;
  return angle;
}

vec4 getTextureDispersion(
  sampler2D tex1,
  sampler2D tex2,
  float mixRate,
  vec2 offset,
  float factor
) {
  vec4 pixel = vec4(1.0);
  float bgR = texture(tex1, v_uv + offset * (1.0 - (N_R - 1.0) * factor)).r;
  float bgG = texture(tex1, v_uv + offset * (1.0 - (N_G - 1.0) * factor)).g;
  float bgB = texture(tex1, v_uv + offset * (1.0 - (N_B - 1.0) * factor)).b;
  float blurR = texture(tex2, v_uv + offset * (1.0 - (N_R - 1.0) * factor)).r;
  float blurG = texture(tex2, v_uv + offset * (1.0 - (N_G - 1.0) * factor)).g;
  float blurB = texture(tex2, v_uv + offset * (1.0 - (N_B - 1.0) * factor)).b;
  pixel.r = mix(bgR, blurR, mixRate);
  pixel.g = mix(bgG, blurG, mixRate);
  pixel.b = mix(bgB, blurB, mixRate);
  return pixel;
}

void main() {
  vec2 u_resolution1x = u_resolution.xy / u_dpr;
  vec2 p1 = (vec2(0, 0) - u_resolution.xy * 0.5) / u_resolution.y;
  vec2 p2 = (vec2(0, 0) - u_mouseSpring) / u_resolution.y;
  float merged = mainSDF(p1, p2, gl_FragCoord.xy);

  vec4 outColor;

  // STEP=9: full production liquid glass effect
  if (merged < 0.005) {
    float nmerged = -1.0 * (merged * u_resolution1x.y);

    float x_R_ratio = 1.0 - nmerged / u_refThickness;
    float thetaI = asin(pow(x_R_ratio, 2.0));
    float thetaT = asin(1.0 / u_refFactor * sin(thetaI));
    float edgeFactor = -1.0 * tan(thetaT - thetaI);
    if (nmerged >= u_refThickness) {
      edgeFactor = 0.0;
    }

    if (edgeFactor <= 0.0) {
      outColor = texture(u_blurredBg, v_uv);
      outColor = mix(outColor, vec4(u_tint.r, u_tint.g, u_tint.b, 1.0), u_tint.a * 0.8);
    } else {
      float edgeH = nmerged / u_refThickness;
      vec2 normal = getNormal(p1, p2, gl_FragCoord.xy);
      vec4 blurredPixel = getTextureDispersion(
        u_bg,
        u_blurredBg,
        u_blurEdge > 0
          ? 1.0
          : edgeH,
        -normal *
          edgeFactor *
          0.05 *
          u_dpr *
          vec2(
            u_resolution.y / (u_resolution1x.x * u_dpr),
            1.0
          ),
        u_refDispersion
      );

      outColor = mix(blurredPixel, vec4(u_tint.r, u_tint.g, u_tint.b, 1.0), u_tint.a * 0.8);

      float fresnelFactor = clamp(
        pow(
          1.0 +
            merged * u_resolution1x.y / 1500.0 * pow(500.0 / u_refFresnelRange, 2.0) +
            u_refFresnelHardness,
          5.0
        ),
        0.0,
        1.0
      );

      vec3 fresnelTintLCH = SRGB_TO_LCH(
        mix(vec3(1.0), vec3(u_tint.r, u_tint.g, u_tint.b), u_tint.a * 0.5)
      );
      fresnelTintLCH.x += 20.0 * fresnelFactor * u_refFresnelFactor;
      fresnelTintLCH.x = clamp(fresnelTintLCH.x, 0.0, 100.0);

      outColor = mix(
        outColor,
        vec4(LCH_TO_SRGB(fresnelTintLCH), 1.0),
        fresnelFactor * u_refFresnelFactor * 0.7 * length(normal)
      );

      float glareGeoFactor = clamp(
        pow(
          1.0 +
            merged * u_resolution1x.y / 1500.0 * pow(500.0 / u_glareRange, 2.0) +
            u_glareHardness,
          5.0
        ),
        0.0,
        1.0
      );

      float glareAngle = (vec2ToAngle(normalize(normal)) - PI / 4.0 + u_glareAngle) * 2.0;
      int glareFarside = 0;
      if (
        glareAngle > PI * (2.0 - 0.5) && glareAngle < PI * (4.0 - 0.5) ||
        glareAngle < PI * (0.0 - 0.5)
      ) {
        glareFarside = 1;
      }
      float glareAngleFactor =
        (0.5 + sin(glareAngle) * 0.5) *
        (glareFarside == 1
          ? 1.2 * u_glareOppositeFactor
          : 1.2) *
        u_glareFactor;
      glareAngleFactor = clamp(pow(glareAngleFactor, 0.1 + u_glareConvergence * 2.0), 0.0, 1.0);

      vec3 glareTintLCH = SRGB_TO_LCH(
        mix(blurredPixel.rgb, vec3(u_tint.r, u_tint.g, u_tint.b), u_tint.a * 0.5)
      );
      glareTintLCH.x += 150.0 * glareAngleFactor * glareGeoFactor;
      glareTintLCH.y += 30.0 * glareAngleFactor * glareGeoFactor;
      glareTintLCH.x = clamp(glareTintLCH.x, 0.0, 120.0);

      outColor = mix(
        outColor,
        vec4(LCH_TO_SRGB(glareTintLCH), 1.0),
        glareAngleFactor * glareGeoFactor * length(normal)
      );
    }
  } else {
    outColor = texture(u_bg, v_uv);
  }

  // smooth edge transition
  outColor = mix(outColor, texture(u_bg, v_uv), smoothstep(-0.001, 0.001, merged));

  fragColor = outColor;
}`;

  // ---------------------------------------------------------------------------
  // Utilities
  // ---------------------------------------------------------------------------

  /**
   * Computes a normalized Gaussian kernel for a given radius.
   * sigma = radius / 3
   */
  function computeGaussianKernelByRadius(radius) {
    var sigma = radius / 3.0;
    var kernel = [];
    var sum = 0;
    for (var i = 0; i <= radius; i++) {
      var weight = Math.exp(-0.5 * (i * i) / (sigma * sigma));
      kernel.push(weight);
      sum += i === 0 ? weight : weight * 2;
    }
    return kernel.map(function (w) { return w / sum; });
  }

  // ---------------------------------------------------------------------------
  // DampedSpring — replaces @react-spring/web Controller
  // ---------------------------------------------------------------------------

  /**
   * Simple critically-damped spring integrator.
   * Tracks a 2D target with configurable stiffness and damping.
   * Call update(dt) each frame with dt in seconds.
   */
  function DampedSpring(stiffness, damping) {
    this.x = 0; this.y = 0;
    this.vx = 0; this.vy = 0;
    this.tx = 0; this.ty = 0;
    this.stiffness = stiffness || 300;
    this.damping = damping || 25;
  }

  DampedSpring.prototype.setTarget = function (x, y) {
    this.tx = x;
    this.ty = y;
  };

  DampedSpring.prototype.update = function (dt) {
    var ax = (this.tx - this.x) * this.stiffness - this.vx * this.damping;
    var ay = (this.ty - this.y) * this.stiffness - this.vy * this.damping;
    this.vx += ax * dt;
    this.vy += ay * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  };

  DampedSpring.prototype.isSettled = function () {
    var dx = Math.abs(this.tx - this.x);
    var dy = Math.abs(this.ty - this.y);
    var sv = Math.abs(this.vx) + Math.abs(this.vy);
    return dx < 0.5 && dy < 0.5 && sv < 1.0;
  };

  // ---------------------------------------------------------------------------
  // ShaderProgram — compiles, links, detects uniforms & attributes
  // ---------------------------------------------------------------------------

  function ShaderProgram(gl, vertexSrc, fragmentSrc) {
    this.gl = gl;
    this.uniforms = {};
    this.attributes = {};
    this.program = this._createProgram(vertexSrc, fragmentSrc);
    this._detectAttributes();
    this._detectUniforms();
  }

  ShaderProgram.prototype._createShader = function (type, source) {
    var gl = this.gl;
    var shader = gl.createShader(type);
    if (!shader) throw new Error('Failed to create shader');
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      var info = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error('Shader compile error: ' + info);
    }
    return shader;
  };

  ShaderProgram.prototype._createProgram = function (vertexSrc, fragmentSrc) {
    var gl = this.gl;
    var program = gl.createProgram();
    if (!program) throw new Error('Failed to create program');
    var vs = this._createShader(gl.VERTEX_SHADER, vertexSrc);
    var fs = this._createShader(gl.FRAGMENT_SHADER, fragmentSrc);
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      var info = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new Error('Program link error: ' + info);
    }
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    return program;
  };

  ShaderProgram.prototype._detectAttributes = function () {
    var gl = this.gl;
    var n = gl.getProgramParameter(this.program, gl.ACTIVE_ATTRIBUTES);
    for (var i = 0; i < n; i++) {
      var info = gl.getActiveAttrib(this.program, i);
      if (!info) continue;
      var loc = gl.getAttribLocation(this.program, info.name);
      this.attributes[info.name] = { location: loc, size: info.size, type: info.type };
    }
  };

  ShaderProgram.prototype._detectUniforms = function () {
    var gl = this.gl;
    var n = gl.getProgramParameter(this.program, gl.ACTIVE_UNIFORMS);
    var arrayRegex = /\[\d+\]$/;
    for (var i = 0; i < n; i++) {
      var info = gl.getActiveUniform(this.program, i);
      if (!info) continue;
      var loc = gl.getUniformLocation(this.program, info.name);
      if (!loc) continue;
      var originalName = info.name;
      if (arrayRegex.test(originalName)) {
        var baseName = originalName.replace(arrayRegex, '');
        this.uniforms[baseName] = { location: loc, type: info.type, isArray: { size: info.size } };
      } else {
        this.uniforms[originalName] = { location: loc, type: info.type, isArray: false };
      }
    }
  };

  ShaderProgram.prototype.use = function () {
    this.gl.useProgram(this.program);
  };

  ShaderProgram.prototype.setUniform = function (name, value) {
    var gl = this.gl;
    var u = this.uniforms[name];
    if (!u) return;
    var loc = u.location;

    if (u.isArray && Array.isArray(value)) {
      switch (u.type) {
        case gl.FLOAT:       gl.uniform1fv(loc, value); break;
        case gl.FLOAT_VEC2:  gl.uniform2fv(loc, value); break;
        case gl.FLOAT_VEC3:  gl.uniform3fv(loc, value); break;
        case gl.FLOAT_VEC4:  gl.uniform4fv(loc, value); break;
      }
    } else {
      switch (u.type) {
        case gl.FLOAT:       gl.uniform1f(loc, value); break;
        case gl.FLOAT_VEC2:  gl.uniform2fv(loc, value); break;
        case gl.FLOAT_VEC3:  gl.uniform3fv(loc, value); break;
        case gl.FLOAT_VEC4:  gl.uniform4fv(loc, value); break;
        case gl.INT:         gl.uniform1i(loc, value); break;
        case gl.SAMPLER_2D:  gl.uniform1i(loc, value); break;
        case gl.FLOAT_MAT3:  gl.uniformMatrix3fv(loc, false, value); break;
        case gl.FLOAT_MAT4:  gl.uniformMatrix4fv(loc, false, value); break;
      }
    }
  };

  ShaderProgram.prototype.getAttributeLocation = function (name) {
    var attr = this.attributes[name];
    return attr ? attr.location : -1;
  };

  ShaderProgram.prototype.dispose = function () {
    var gl = this.gl;
    if (this.program) {
      var shaders = gl.getAttachedShaders(this.program);
      if (shaders) {
        shaders.forEach(function (s) { gl.deleteShader(s); });
      }
      gl.deleteProgram(this.program);
    }
    this.uniforms = {};
    this.attributes = {};
  };

  // ---------------------------------------------------------------------------
  // FrameBuffer — RGBA16F offscreen framebuffer with depth attachment
  // ---------------------------------------------------------------------------

  function FrameBuffer(gl, width, height) {
    this.gl = gl;
    this.width = width;
    this.height = height;
    this._create();
  }

  FrameBuffer.prototype._create = function () {
    var gl = this.gl;

    var fbo = gl.createFramebuffer();
    if (!fbo) throw new Error('Failed to create framebuffer');
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);

    var texture = gl.createTexture();
    if (!texture) throw new Error('Failed to create color texture');
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, this.width, this.height, 0, gl.RGBA, gl.FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

    var depthTex = gl.createTexture();
    if (!depthTex) throw new Error('Failed to create depth texture');
    gl.bindTexture(gl.TEXTURE_2D, depthTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, this.width, this.height, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depthTex, 0);

    var status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error('Framebuffer incomplete: ' + status);
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);

    this.fbo = fbo;
    this.texture = texture;
    this.depthTexture = depthTex;
  };

  FrameBuffer.prototype.bind = function () {
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.fbo);
  };

  FrameBuffer.prototype.unbind = function () {
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
  };

  FrameBuffer.prototype.getTexture = function () {
    return this.texture;
  };

  FrameBuffer.prototype.resize = function (width, height) {
    this.width = width;
    this.height = height;
    var gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, width, height, 0, gl.RGBA, gl.FLOAT, null);
    gl.bindTexture(gl.TEXTURE_2D, this.depthTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, width, height, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
  };

  FrameBuffer.prototype.dispose = function () {
    var gl = this.gl;
    gl.deleteFramebuffer(this.fbo);
    gl.deleteTexture(this.texture);
    gl.deleteTexture(this.depthTexture);
  };

  // ---------------------------------------------------------------------------
  // RenderPass — one shader pass (writes to FBO or screen)
  // ---------------------------------------------------------------------------

  function RenderPass(gl, vertexSrc, fragmentSrc, outputToScreen) {
    this.gl = gl;
    this.outputToScreen = outputToScreen || false;
    this.program = new ShaderProgram(gl, vertexSrc, fragmentSrc);
    this.frameBuffer = outputToScreen
      ? null
      : new FrameBuffer(gl, gl.canvas.width, gl.canvas.height);
    this.vao = this._createVAO();
    this.config = { name: '', inputs: null };
  }

  RenderPass.prototype._createVAO = function () {
    var gl = this.gl;
    var vao = gl.createVertexArray();
    if (!vao) throw new Error('Failed to create VAO');
    gl.bindVertexArray(vao);

    var buffer = gl.createBuffer();
    if (!buffer) throw new Error('Failed to create vertex buffer');
    var vertices = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    var posLoc = this.program.getAttributeLocation('a_position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    this._buffer = buffer;
    return vao;
  };

  RenderPass.prototype.render = function (uniforms) {
    var gl = this.gl;

    if (this.frameBuffer) {
      this.frameBuffer.bind();
    } else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    this.program.use();

    if (uniforms) {
      var textureCount = 0;
      var self = this;
      Object.keys(uniforms).forEach(function (name) {
        var value = uniforms[name];
        if (value instanceof WebGLTexture) {
          gl.activeTexture(gl.TEXTURE0 + textureCount);
          gl.bindTexture(gl.TEXTURE_2D, value);
          self.program.setUniform(name, textureCount);
          textureCount++;
        } else {
          self.program.setUniform(name, value);
        }
      });
    }

    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);

    if (this.frameBuffer) {
      this.frameBuffer.unbind();
    }
  };

  RenderPass.prototype.getOutputTexture = function () {
    return this.frameBuffer ? this.frameBuffer.getTexture() : null;
  };

  RenderPass.prototype.resize = function (width, height) {
    if (this.frameBuffer) {
      this.frameBuffer.resize(width, height);
    }
  };

  RenderPass.prototype.dispose = function () {
    if (this.frameBuffer) this.frameBuffer.dispose();
    this.program.dispose();
    var gl = this.gl;
    gl.deleteBuffer(this._buffer);
    gl.deleteVertexArray(this.vao);
  };

  // ---------------------------------------------------------------------------
  // MultiPassRenderer — orchestrates N render passes in sequence
  // ---------------------------------------------------------------------------

  function MultiPassRenderer(canvas, configs) {
    var gl = canvas.getContext('webgl2');
    if (!gl) throw new Error('WebGL2 not supported');

    var ext = gl.getExtension('EXT_color_buffer_float');
    if (!ext) throw new Error('EXT_color_buffer_float not supported');

    this.gl = gl;
    this.globalUniforms = {};
    this.passes = {};
    this.passesArray = [];

    var self = this;
    configs.forEach(function (cfg, index) {
      var pass = new RenderPass(
        gl,
        cfg.shader.vertex,
        cfg.shader.fragment,
        cfg.outputToScreen || false
      );
      pass.config = { name: cfg.name, inputs: cfg.inputs || null };
      self.passes[cfg.name] = pass;
      self.passesArray[index] = pass;
    });
  }

  MultiPassRenderer.prototype.resize = function (width, height) {
    this.passesArray.forEach(function (pass) { pass.resize(width, height); });
  };

  MultiPassRenderer.prototype.setUniform = function (name, value) {
    this.globalUniforms[name] = value;
  };

  MultiPassRenderer.prototype.setUniforms = function (uniforms) {
    var g = this.globalUniforms;
    Object.keys(uniforms).forEach(function (k) { g[k] = uniforms[k]; });
  };

  MultiPassRenderer.prototype.render = function (passUniforms) {
    var self = this;
    this.passesArray.forEach(function (pass, index) {
      var uniforms = {};
      // merge globals
      Object.keys(self.globalUniforms).forEach(function (k) {
        uniforms[k] = self.globalUniforms[k];
      });
      // merge per-pass overrides (by name or index)
      if (passUniforms) {
        var override = Array.isArray(passUniforms)
          ? passUniforms[index]
          : passUniforms[pass.config.name];
        if (override) {
          Object.keys(override).forEach(function (k) { uniforms[k] = override[k]; });
        }
      }
      // resolve input textures
      if (pass.config.inputs) {
        Object.keys(pass.config.inputs).forEach(function (uniformName) {
          var fromPassName = pass.config.inputs[uniformName];
          var fromPass = self.passes[fromPassName];
          if (fromPass) {
            uniforms[uniformName] = fromPass.getOutputTexture();
          }
        });
      }
      pass.render(uniforms);
    });
  };

  MultiPassRenderer.prototype.dispose = function () {
    var gl = this.gl;
    this.passesArray.forEach(function (pass) { pass.dispose(); });
    this.passes = {};
    this.passesArray = [];
    this.globalUniforms = {};
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
  };

  // ---------------------------------------------------------------------------
  // Texture helpers
  // ---------------------------------------------------------------------------

  /**
   * Creates a 1x1 solid RGBA8 WebGL texture from a color array [r, g, b, a] (0-255).
   * Used as the fallback when html2canvas is not available.
   */
  function createSolidTexture(gl, r, g, b, a) {
    var texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.RGBA,
      1, 1, 0,
      gl.RGBA, gl.UNSIGNED_BYTE,
      new Uint8Array([r || 220, g || 220, b || 220, a !== undefined ? a : 255])
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return texture;
  }

  /**
   * Uploads an HTMLImageElement or HTMLCanvasElement to a WebGL texture.
   * Returns { texture, ratio }.
   */
  function uploadImageTexture(gl, source) {
    var texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);
    var w = source.naturalWidth || source.width || 1;
    var h = source.naturalHeight || source.height || 1;
    return { texture: texture, ratio: w / h };
  }

  // ---------------------------------------------------------------------------
  // Background capture — uses html2canvas if available, else solid color
  // ---------------------------------------------------------------------------

  /**
   * Captures the area behind the target element.
   * Returns a Promise that resolves to { canvas } (an HTMLCanvasElement).
   * The element is temporarily hidden so it does not appear in the screenshot.
   */
  function captureBackground(targetElement, canvas) {
    if (typeof window.html2canvas !== 'function') {
      return Promise.resolve(null);
    }

    var rect = targetElement.getBoundingClientRect();
    var scrollX = window.pageXOffset || document.documentElement.scrollLeft;
    var scrollY = window.pageYOffset || document.documentElement.scrollTop;

    // Hide overlay canvas and target element during capture
    var prevTargetVis = targetElement.style.visibility;
    var prevCanvasVis = canvas.style.visibility;
    targetElement.style.visibility = 'hidden';
    canvas.style.visibility = 'hidden';

    return window.html2canvas(document.body, {
      x: rect.left + scrollX,
      y: rect.top + scrollY,
      width: rect.width,
      height: rect.height,
      useCORS: true,
      allowTaint: true,
      scale: window.devicePixelRatio || 1,
      logging: false,
    }).then(function (captured) {
      targetElement.style.visibility = prevTargetVis;
      canvas.style.visibility = prevCanvasVis;
      return captured;
    }).catch(function () {
      targetElement.style.visibility = prevTargetVis;
      canvas.style.visibility = prevCanvasVis;
      return null;
    });
  }

  // ---------------------------------------------------------------------------
  // Default options
  // ---------------------------------------------------------------------------

  var DEFAULTS = {
    shapeWidth: null,     // auto from element
    shapeHeight: null,    // auto from element
    shapeRadius: 80,
    shapeRoundness: 4,

    refThickness: 20,
    refFactor: 1.4,
    refDispersion: 7,

    refFresnelRange: 30,
    refFresnelHardness: 20,
    refFresnelFactor: 20,

    glareRange: 30,
    glareHardness: 20,
    glareFactor: 90,
    glareConvergence: 50,
    glareOppositeFactor: 80,
    glareAngle: -45,

    blurRadius: 1,
    blurEdge: true,

    tint: [1, 1, 1, 0],

    shadowExpand: 25,
    shadowFactor: 15,
    shadowPosition: [0, 10],

    mergeRate: 0,
    showShape1: false,

    captureInterval: 1000,
  };

  // ---------------------------------------------------------------------------
  // LiquidGlassStudio — main public API class
  // ---------------------------------------------------------------------------

  /**
   * Creates a liquid glass WebGL effect overlaid on a DOM element.
   *
   * @param {HTMLElement} element  - Target DOM element to overlay
   * @param {object}      options  - Configuration (see DEFAULTS above)
   */
  function LiquidGlassStudio(element, options) {
    if (!(this instanceof LiquidGlassStudio)) {
      return new LiquidGlassStudio(element, options);
    }

    this._element = element;
    this._opts = Object.assign({}, DEFAULTS, options || {});
    this._destroyed = false;
    this._raf = null;
    this._lastTime = null;
    this._lastCaptureTime = 0;
    this._bgTexture = null;
    this._bgTextureRatio = 1;
    this._bgTextureReady = false;
    this._mouseX = 0;
    this._mouseY = 0;
    this._spring = new DampedSpring(300, 25);

    this._init();
  }

  LiquidGlassStudio.prototype._init = function () {
    var self = this;
    var element = this._element;
    var opts = this._opts;

    // Ensure parent is positioned so our absolute canvas sits correctly
    var parentPos = getComputedStyle(element.parentElement || element).position;
    if (parentPos === 'static') {
      (element.parentElement || element).style.position = 'relative';
    }

    // Create the overlay canvas
    var canvas = document.createElement('canvas');
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '9999';

    // Size canvas to match element
    var rect = element.getBoundingClientRect();
    var dpr = window.devicePixelRatio || 1;
    var w = rect.width;
    var h = rect.height;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);

    // Append canvas inside parent, positioned over element
    var parent = element.parentElement || document.body;
    parent.appendChild(canvas);
    this._canvas = canvas;

    // Position canvas over element using offsetTop/offsetLeft relative to parent
    this._positionCanvas();

    // Build MultiPassRenderer (4 passes: bgPass → vBlur → hBlur → main)
    var renderer;
    try {
      renderer = new MultiPassRenderer(canvas, [
        {
          name: 'bgPass',
          shader: { vertex: VERTEX_SHADER, fragment: FRAGMENT_BG_SHADER },
        },
        {
          name: 'vBlurPass',
          shader: { vertex: VERTEX_SHADER, fragment: FRAGMENT_BG_VBLUR_SHADER },
          inputs: { u_prevPassTexture: 'bgPass' },
        },
        {
          name: 'hBlurPass',
          shader: { vertex: VERTEX_SHADER, fragment: FRAGMENT_BG_HBLUR_SHADER },
          inputs: { u_prevPassTexture: 'vBlurPass' },
        },
        {
          name: 'mainPass',
          shader: { vertex: VERTEX_SHADER, fragment: FRAGMENT_MAIN_SHADER },
          inputs: { u_blurredBg: 'hBlurPass', u_bg: 'bgPass' },
          outputToScreen: true,
        },
      ]);
    } catch (e) {
      console.error('[LiquidGlassStudio] Failed to initialize WebGL renderer:', e);
      return;
    }
    this._renderer = renderer;

    // Create fallback solid-color bg texture
    var gl = canvas.getContext('webgl2');
    this._gl = gl;
    this._fallbackTexture = createSolidTexture(gl, 220, 220, 220, 255);
    this._bgTexture = this._fallbackTexture;

    // Set initial viewport and resolution uniform
    gl.viewport(0, 0, canvas.width, canvas.height);
    renderer.setUniform('u_resolution', [canvas.width, canvas.height]);
    renderer.setUniform('u_dpr', dpr);

    // Mouse tracking on the document (spring target updated in canvas-relative coords)
    this._onMouseMove = function (e) {
      var r = canvas.getBoundingClientRect();
      // pixel coords relative to canvas center, Y-flipped (WebGL origin is bottom-left)
      self._mouseX = (e.clientX - r.left) * dpr;
      self._mouseY = (r.height - (e.clientY - r.top)) * dpr;
      self._spring.setTarget(
        self._mouseX - canvas.width / 2,
        self._mouseY - canvas.height / 2
      );
    };
    document.addEventListener('mousemove', this._onMouseMove);

    // ResizeObserver to handle element size changes
    if (typeof ResizeObserver !== 'undefined') {
      this._resizeObserver = new ResizeObserver(function () {
        self._handleResize();
      });
      this._resizeObserver.observe(element);
    }

    // Initial background capture
    this._captureBackground();

    // Start render loop
    this._startRenderLoop();
  };

  LiquidGlassStudio.prototype._positionCanvas = function () {
    var element = this._element;
    var canvas = this._canvas;

    // Use offsetTop/offsetLeft relative to the offset parent
    var offsetEl = element;
    var top = 0;
    var left = 0;
    // Walk up to the canvas's parent to compute relative position
    var canvasParent = canvas.parentElement;
    while (offsetEl && offsetEl !== canvasParent) {
      top += offsetEl.offsetTop || 0;
      left += offsetEl.offsetLeft || 0;
      offsetEl = offsetEl.offsetParent;
    }
    canvas.style.top = top + 'px';
    canvas.style.left = left + 'px';
  };

  LiquidGlassStudio.prototype._handleResize = function () {
    if (this._destroyed) return;

    var element = this._element;
    var canvas = this._canvas;
    var gl = this._gl;
    var renderer = this._renderer;
    var dpr = window.devicePixelRatio || 1;
    var rect = element.getBoundingClientRect();
    var w = rect.width;
    var h = rect.height;

    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);

    this._positionCanvas();

    gl.viewport(0, 0, canvas.width, canvas.height);
    renderer.resize(canvas.width, canvas.height);
    renderer.setUniform('u_resolution', [canvas.width, canvas.height]);
    renderer.setUniform('u_dpr', dpr);

    // Re-capture background after resize
    this._captureBackground();
  };

  LiquidGlassStudio.prototype._captureBackground = function () {
    var self = this;
    var gl = this._gl;
    var canvas = this._canvas;

    captureBackground(this._element, canvas).then(function (capturedCanvas) {
      if (self._destroyed) return;
      if (!capturedCanvas) {
        // html2canvas unavailable — keep fallback solid texture
        return;
      }
      // Upload captured canvas as bg texture
      if (self._bgTexture && self._bgTexture !== self._fallbackTexture) {
        gl.deleteTexture(self._bgTexture);
      }
      var result = uploadImageTexture(gl, capturedCanvas);
      self._bgTexture = result.texture;
      self._bgTextureRatio = result.ratio;
      self._bgTextureReady = true;
      self._lastCaptureTime = Date.now();
    });
  };

  LiquidGlassStudio.prototype._startRenderLoop = function () {
    var self = this;
    var lastTime = null;

    var idleFrames = 0;

    function loop(now) {
      if (self._destroyed) return;
      self._raf = requestAnimationFrame(loop);

      var dt = lastTime !== null ? Math.min((now - lastTime) / 1000, 0.05) : 0.016;
      lastTime = now;

      self._spring.update(dt);

      // Skip rendering when spring is settled (save GPU)
      var settled = self._spring.isSettled();
      if (settled) {
        idleFrames++;
        if (idleFrames > 5) return; // stop rendering after 5 idle frames
      } else {
        idleFrames = 0;
      }

      self._render();

      // Periodic background re-capture
      var interval = self._opts.captureInterval;
      if (interval > 0 && self._bgTextureReady) {
        var elapsed = Date.now() - self._lastCaptureTime;
        if (elapsed >= interval) {
          self._captureBackground();
        }
      }
    }

    this._raf = requestAnimationFrame(loop);
  };

  LiquidGlassStudio.prototype._render = function () {
    var opts = this._opts;
    var renderer = this._renderer;
    var canvas = this._canvas;
    var gl = this._gl;
    var dpr = window.devicePixelRatio || 1;
    var spring = this._spring;

    var W = canvas.width;
    var H = canvas.height;

    // Auto-detect shape size from element if not explicitly set
    var shapeW = opts.shapeWidth !== null ? opts.shapeWidth : W / dpr;
    var shapeH = opts.shapeHeight !== null ? opts.shapeHeight : H / dpr;

    var minDim = Math.min(shapeW, shapeH);
    var shapeRadius = (minDim / 2) * (opts.shapeRadius / 100);

    // Gaussian blur weights
    var blurRadius = Math.max(0, Math.min(Math.round(opts.blurRadius), 200));
    var blurWeights = computeGaussianKernelByRadius(blurRadius);

    // Spring position — pixel coords relative to canvas center
    var springX = spring.x;
    var springY = spring.y;

    // Global uniforms (shared across all passes)
    renderer.setUniforms({
      u_resolution: [W, H],
      u_dpr: dpr,
      u_blurWeights: blurWeights,
      u_blurRadius: blurRadius,
      u_mouse: [this._mouseX, this._mouseY],
      u_mouseSpring: [springX, springY],
      u_shapeWidth: shapeW,
      u_shapeHeight: shapeH,
      u_shapeRadius: shapeRadius,
      u_shapeRoundness: opts.shapeRoundness,
      u_mergeRate: opts.mergeRate,
      u_glareAngle: (opts.glareAngle * Math.PI) / 180,
      u_showShape1: opts.showShape1 ? 1 : 0,
    });

    // Shadow position (shader expects negated values)
    var shadowPos = opts.shadowPosition;

    // Tint — accepts [r, g, b, a] already normalized 0-1
    var tint = opts.tint;

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    renderer.render({
      bgPass: {
        u_bgType: 11, // texture mode
        u_bgTexture: this._bgTexture,
        u_bgTextureRatio: this._bgTextureRatio,
        u_bgTextureReady: this._bgTextureReady ? 1 : 0,
        u_shadowExpand: opts.shadowExpand,
        u_shadowFactor: opts.shadowFactor / 100,
        u_shadowPosition: [-shadowPos[0], -shadowPos[1]],
      },
      mainPass: {
        u_tint: tint,
        u_refThickness: opts.refThickness,
        u_refFactor: opts.refFactor,
        u_refDispersion: opts.refDispersion,
        u_refFresnelRange: opts.refFresnelRange,
        u_refFresnelHardness: opts.refFresnelHardness / 100,
        u_refFresnelFactor: opts.refFresnelFactor / 100,
        u_glareRange: opts.glareRange,
        u_glareHardness: opts.glareHardness / 100,
        u_glareConvergence: opts.glareConvergence / 100,
        u_glareOppositeFactor: opts.glareOppositeFactor / 100,
        u_glareFactor: opts.glareFactor / 100,
        u_blurEdge: opts.blurEdge ? 1 : 0,
      },
    });
  };

  /**
   * Update one or more options at runtime without destroying the effect.
   * @param {object} newOpts - Partial options to merge
   */
  LiquidGlassStudio.prototype.setOptions = function (newOpts) {
    Object.assign(this._opts, newOpts);
  };

  /**
   * Force a background re-capture immediately.
   */
  LiquidGlassStudio.prototype.captureNow = function () {
    this._captureBackground();
  };

  /**
   * Destroy the effect, remove the canvas, and free all WebGL resources.
   */
  LiquidGlassStudio.prototype.destroy = function () {
    if (this._destroyed) return;
    this._destroyed = true;

    if (this._raf !== null) {
      cancelAnimationFrame(this._raf);
      this._raf = null;
    }

    document.removeEventListener('mousemove', this._onMouseMove);

    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = null;
    }

    if (this._renderer) {
      this._renderer.dispose();
      this._renderer = null;
    }

    if (this._gl && this._fallbackTexture) {
      this._gl.deleteTexture(this._fallbackTexture);
    }
    if (this._gl && this._bgTexture && this._bgTexture !== this._fallbackTexture) {
      this._gl.deleteTexture(this._bgTexture);
    }

    if (this._canvas && this._canvas.parentElement) {
      this._canvas.parentElement.removeChild(this._canvas);
    }
    this._canvas = null;
    this._gl = null;
  };

  // ---------------------------------------------------------------------------
  // Expose internals for advanced use
  // ---------------------------------------------------------------------------

  LiquidGlassStudio.DampedSpring = DampedSpring;
  LiquidGlassStudio.MultiPassRenderer = MultiPassRenderer;
  LiquidGlassStudio.ShaderProgram = ShaderProgram;
  LiquidGlassStudio.FrameBuffer = FrameBuffer;
  LiquidGlassStudio.computeGaussianKernelByRadius = computeGaussianKernelByRadius;

  LiquidGlassStudio.SHADERS = {
    vertex: VERTEX_SHADER,
    fragmentBg: FRAGMENT_BG_SHADER,
    fragmentBgVblur: FRAGMENT_BG_VBLUR_SHADER,
    fragmentBgHblur: FRAGMENT_BG_HBLUR_SHADER,
    fragmentMain: FRAGMENT_MAIN_SHADER,
  };

  return LiquidGlassStudio;
});
