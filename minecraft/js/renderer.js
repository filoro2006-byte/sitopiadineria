// Renderer WebGL2
(function () {
  'use strict';
  const MC = (window.MC = window.MC || {});
  const WH = MC.WH;

  // ---------------- Matematica ----------------
  const mat4 = {
    create() { const m = new Float32Array(16); m[0] = m[5] = m[10] = m[15] = 1; return m; },
    perspective(out, fovy, aspect, near, far) {
      const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
      out.fill(0);
      out[0] = f / aspect; out[5] = f; out[10] = (far + near) * nf; out[11] = -1; out[14] = 2 * far * near * nf;
      return out;
    },
    mul(out, a, b) {
      const r = new Float32Array(16);
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
        let s = 0;
        for (let k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k];
        r[i * 4 + j] = s;
      }
      out.set(r);
      return out;
    },
    rotX(out, a) { out.fill(0); const c = Math.cos(a), s = Math.sin(a); out[0] = 1; out[5] = c; out[6] = s; out[9] = -s; out[10] = c; out[15] = 1; return out; },
    rotY(out, a) { out.fill(0); const c = Math.cos(a), s = Math.sin(a); out[0] = c; out[2] = -s; out[5] = 1; out[8] = s; out[10] = c; out[15] = 1; return out; },
    rotZ(out, a) { out.fill(0); const c = Math.cos(a), s = Math.sin(a); out[0] = c; out[1] = s; out[4] = -s; out[5] = c; out[10] = 1; out[15] = 1; return out; },
    translate(out, x, y, z) { out.fill(0); out[0] = out[5] = out[10] = out[15] = 1; out[12] = x; out[13] = y; out[14] = z; return out; },
    scale(out, x, y, z) { out.fill(0); out[0] = x; out[5] = y; out[10] = z; out[15] = 1; return out; },
    invert(out, m) {
      const a00 = m[0], a01 = m[1], a02 = m[2], a03 = m[3], a10 = m[4], a11 = m[5], a12 = m[6], a13 = m[7];
      const a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11], a30 = m[12], a31 = m[13], a32 = m[14], a33 = m[15];
      const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11;
      const b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12, b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30;
      const b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
      let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
      if (!det) return null;
      det = 1 / det;
      out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det; out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
      out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det; out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
      out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det; out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
      out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det; out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
      out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det; out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
      out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det; out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
      out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det; out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
      out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det; out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
      return out;
    },
    transformPoint(m, x, y, z) {
      return [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];
    },
  };
  MC.mat4 = mat4;

  // ---------------- Shader ----------------
  const CHUNK_VS = `#version 300 es
precision highp float;
layout(location=0) in vec4 a_pos;
layout(location=1) in vec4 a_uvf;
layout(location=2) in vec4 a_light;
layout(location=3) in vec4 a_tint;
uniform mat4 u_vp;
uniform mat4 u_shadowMat;
uniform vec3 u_off;
uniform vec3 u_cam;
uniform float u_time;
out vec3 v_uvl;
out vec2 v_light;
out float v_shade;
out float v_dist;
out float v_flags;
out vec4 v_tint;
out vec3 v_rel;
out vec3 v_nrm;
out vec3 v_sh;
out vec3 v_wp;
const vec3 NRM[8] = vec3[8](vec3(1.,0.,0.), vec3(-1.,0.,0.), vec3(0.,1.,0.), vec3(0.,-1.,0.), vec3(0.,0.,1.), vec3(0.,0.,-1.), vec3(0.,1.,0.), vec3(0.,1.,0.));
void main(){
  vec3 rel = a_pos.xyz / 128.0 + u_off;
  vec3 wp = rel + u_cam;
  int f = int(a_uvf.z + 0.5);
  if ((f & 1) != 0) {
    float ph = wp.x * 0.7 + wp.z * 0.9 + u_time * 1.8;
    rel.x += sin(ph) * 0.07 + sin(ph * 2.3) * 0.02;
    rel.z += cos(ph * 0.8) * 0.05;
  }
  if ((f & 2) != 0) {
    float ph = wp.x * 0.5 + wp.y * 0.35 + wp.z * 0.6 + u_time * 1.4;
    rel.x += sin(ph) * 0.018;
    rel.y += cos(ph * 1.3) * 0.012;
  }
  if ((f & 4) != 0) {
    rel.y += (sin(wp.x * 1.3 + u_time * 1.7) + cos(wp.z * 1.1 + u_time * 1.3)) * 0.02 - 0.03;
  }
  int ni = int(a_light.z + 0.5);
  vec3 n = NRM[ni];
  gl_Position = u_vp * vec4(rel, 1.0);
  v_uvl = vec3(a_uvf.x / 16.0, 1.0 - a_uvf.y / 16.0, a_pos.w);
  v_light = a_light.xy / 17.0;
  v_shade = a_uvf.w / 255.0;
  v_dist = length(rel);
  v_flags = a_uvf.z + (ni == 6 ? 256.0 : 0.0) + (ni == 7 ? 512.0 : 0.0);
  v_tint = vec4(a_tint.rgb / 255.0, a_tint.w);
  v_rel = rel;
  v_nrm = n;
  v_wp = wp;
  vec4 sp = u_shadowMat * vec4(rel + n * 0.04, 1.0);
  v_sh = sp.xyz * 0.5 + 0.5;
}`;

  const LIGHT_FN = `
uniform float u_day;
uniform vec3 u_skyCol;
uniform float u_bright;
uniform float u_gamma;
uniform float u_flicker;
uniform int u_shadows;
uniform vec3 u_lightDir;
uniform float u_direct;
uniform highp sampler2DShadow u_shadowTex;
uniform float u_shadowTexel;
float lcurve(float l){
  float f = clamp(l / 15.0, 0.0, 1.0);
  float b = f / (3.0 - 2.0 * f);
  float bb = 1.0 - pow(1.0 - b, 4.0);
  return mix(b, bb, u_gamma);
}
float shadowAt(vec3 sc){
  if (sc.x <= 0.001 || sc.x >= 0.999 || sc.y <= 0.001 || sc.y >= 0.999 || sc.z >= 1.0) return 1.0;
  float d = sc.z - 0.0015;
  float s = 0.0;
  float o = u_shadowTexel;
  s += texture(u_shadowTex, vec3(sc.xy + vec2(-o, -o), d));
  s += texture(u_shadowTex, vec3(sc.xy + vec2( o, -o), d));
  s += texture(u_shadowTex, vec3(sc.xy + vec2(-o,  o), d));
  s += texture(u_shadowTex, vec3(sc.xy + vec2( o,  o), d));
  return s * 0.25;
}
// restituisce la luce e (in .w) la quota di sole diretto usata per i riflessi
vec4 lightOf(float sky, float blk, vec3 n, vec3 sc, int kind, float dist){
  float ls = lcurve(sky) * u_day;
  float sun = 0.0;
  if (u_shadows == 1 && u_direct > 0.001) {
    float ndl = kind == 1 ? 0.8 : (kind == 2 ? 0.6 : dot(n, u_lightDir));
    float outdoor = smoothstep(9.0, 14.0, sky);
    float fade = 1.0 - smoothstep(64.0, 84.0, dist);
    float sh = mix(1.0, shadowAt(sc), fade);
    sun = clamp(ndl * 1.4, 0.0, 1.0) * sh * outdoor;
    ls *= mix(1.0, mix(0.68, 1.12, sun), u_direct * outdoor + (1.0 - outdoor) * 0.0);
  }
  float lb = lcurve(blk) * u_flicker;
  vec3 l = max(u_skyCol * ls, vec3(1.0, 0.86, 0.66) * lb);
  l = max(l, vec3(u_bright));
  return vec4(l, sun);
}`;

  const CHUNK_FS = `#version 300 es
precision highp float;
precision highp sampler2DArray;
uniform sampler2DArray u_tex;
uniform vec3 u_fogCol;
uniform vec2 u_fog;
uniform float u_time;
uniform int u_pass;
uniform vec3 u_sunDir;
uniform vec3 u_zenith;
uniform vec3 u_horizon;
uniform int u_fancyWater;
${LIGHT_FN}
in vec3 v_uvl;
in vec2 v_light;
in float v_shade;
in float v_dist;
in float v_flags;
in vec4 v_tint;
in vec3 v_rel;
in vec3 v_nrm;
in vec3 v_sh;
in vec3 v_wp;
out vec4 o;
void main(){
  vec2 uv = v_uvl.xy;
  int fa = int(v_flags + 0.5);
  int f = fa & 255;
  int kind = (fa & 256) != 0 ? 1 : ((fa & 512) != 0 ? 2 : 0);
  if ((f & 32) != 0) {
    uv = uv + vec2(u_time * 0.02, u_time * 0.035);
    uv.x += sin(uv.y * 6.2832 + u_time * 1.3) * 0.04;
    uv.y += cos(uv.x * 6.2832 + u_time * 1.1) * 0.03;
  }
  if ((f & 16) != 0) {
    uv = uv + vec2(sin(u_time * 0.25 + uv.y * 3.0) * 0.06, u_time * 0.015);
  }
  vec4 t = texture(u_tex, vec3(uv, v_uvl.z));
  int mode = int(v_tint.w + 0.5);
  if (mode == 2) {
    float m = clamp((1.0 - t.a) * 4.0, 0.0, 1.0);
    t.rgb *= mix(vec3(1.0), v_tint.rgb, m);
    t.a = 1.0;
  } else if (mode == 1) {
    t.rgb *= v_tint.rgb;
  }
  if (u_pass == 0 && t.a < 0.5) discard;
  if (u_pass == 1 && t.a < 0.02) discard;
  vec4 L = ((f & 8) != 0) ? vec4(1.0, 1.0, 1.0, 0.0) : lightOf(v_light.x, v_light.y, v_nrm, v_sh, kind, v_dist);
  vec3 col = t.rgb * L.rgb * v_shade;
  float alpha = t.a;
  if ((f & 32) != 0) {
    col += vec3(0.05, 0.07, 0.1) * u_day * v_light.x / 15.0;
    if ((f & 4) != 0 && u_fancyWater == 1) {
      // superficie dell'acqua: onde, fresnel, cielo riflesso e riflesso del sole
      vec2 p = v_wp.xz;
      float tt = u_time;
      vec3 nw = normalize(vec3(
        cos(p.x * 1.7 + tt * 1.6) * 0.06 + cos(p.x * 3.1 - p.y * 2.3 + tt * 2.3) * 0.035 + sin(p.y * 0.9 + p.x * 0.4 + tt) * 0.03,
        1.0,
        sin(p.y * 1.9 + tt * 1.3) * 0.06 + sin(p.y * 3.7 + p.x * 1.9 - tt * 2.1) * 0.035));
      vec3 V = normalize(-v_rel);
      float ndv = max(dot(nw, V), 0.0);
      float fres = 0.04 + 0.96 * pow(1.0 - ndv, 5.0);
      vec3 R = reflect(-V, nw);
      vec3 sky = mix(u_horizon, u_zenith, pow(clamp(R.y, 0.0, 1.0), 0.6));
      float outdoor = smoothstep(8.0, 14.0, v_light.x);
      col = mix(col, sky * (0.35 + 0.65 * u_day) , fres * 0.85 * outdoor);
      float spec = pow(max(dot(R, u_sunDir), 0.0), 220.0) * (u_shadows == 1 ? L.w : outdoor) * u_direct;
      col += vec3(1.0, 0.92, 0.75) * spec * 2.5;
      alpha = mix(alpha, 1.0, fres * 0.7);
    }
  }
  float fog = smoothstep(u_fog.x, u_fog.y, v_dist);
  col = mix(col, u_fogCol, fog);
  o = vec4(col, u_pass == 1 ? mix(alpha, 1.0, fog * 0.6) : 1.0);
}`;

  const SHADOW_VS = `#version 300 es
precision highp float;
layout(location=0) in vec4 a_pos;
layout(location=1) in vec4 a_uvf;
uniform mat4 u_shadowMat;
uniform vec3 u_off;
uniform vec3 u_cam;
uniform float u_time;
out vec3 v_uvl;
void main(){
  vec3 rel = a_pos.xyz / 128.0 + u_off;
  vec3 wp = rel + u_cam;
  int f = int(a_uvf.z + 0.5);
  if ((f & 1) != 0) {
    float ph = wp.x * 0.7 + wp.z * 0.9 + u_time * 1.8;
    rel.x += sin(ph) * 0.07 + sin(ph * 2.3) * 0.02;
    rel.z += cos(ph * 0.8) * 0.05;
  }
  gl_Position = u_shadowMat * vec4(rel, 1.0);
  v_uvl = vec3(a_uvf.x / 16.0, 1.0 - a_uvf.y / 16.0, a_pos.w);
}`;
  const SHADOW_FS = `#version 300 es
precision highp float;
precision highp sampler2DArray;
uniform sampler2DArray u_tex;
in vec3 v_uvl;
out vec4 o;
void main(){
  if (texture(u_tex, v_uvl).a < 0.5) discard;
  o = vec4(1.0);
}`;

  // --------- Post-processing ---------
  const FS_VS = `#version 300 es
layout(location=0) in vec2 a_p;
out vec2 v_uv;
void main(){ v_uv = a_p * 0.5 + 0.5; gl_Position = vec4(a_p, 0.0, 1.0); }`;
  const BRIGHT_FS = `#version 300 es
precision highp float;
uniform sampler2D u_src;
uniform vec2 u_texel;
in vec2 v_uv;
out vec4 o;
void main(){
  vec3 c = vec3(0.0);
  c += texture(u_src, v_uv + u_texel * vec2(-1.0, -1.0)).rgb;
  c += texture(u_src, v_uv + u_texel * vec2( 1.0, -1.0)).rgb;
  c += texture(u_src, v_uv + u_texel * vec2(-1.0,  1.0)).rgb;
  c += texture(u_src, v_uv + u_texel * vec2( 1.0,  1.0)).rgb;
  c *= 0.25;
  float l = max(max(c.r, c.g), c.b);
  float k = smoothstep(0.86, 1.0, l);
  o = vec4(c * k, 1.0);
}`;
  const BLUR_FS = `#version 300 es
precision highp float;
uniform sampler2D u_src;
uniform vec2 u_dir;
in vec2 v_uv;
out vec4 o;
void main(){
  vec3 c = texture(u_src, v_uv).rgb * 0.227;
  c += texture(u_src, v_uv + u_dir * 1.385).rgb * 0.316;
  c += texture(u_src, v_uv - u_dir * 1.385).rgb * 0.316;
  c += texture(u_src, v_uv + u_dir * 3.231).rgb * 0.070;
  c += texture(u_src, v_uv - u_dir * 3.231).rgb * 0.070;
  o = vec4(c, 1.0);
}`;
  const RAYS_FS = `#version 300 es
precision highp float;
uniform sampler2D u_src;
uniform sampler2D u_depth;
uniform vec2 u_sun;
uniform float u_strength;
in vec2 v_uv;
out vec4 o;
void main(){
  vec2 d = (u_sun - v_uv) / 40.0;
  vec2 p = v_uv;
  float acc = 0.0, w = 1.0;
  for (int i = 0; i < 40; i++) {
    float sky = texture(u_depth, p).r >= 0.99999 ? 1.0 : 0.0;
    float br = smoothstep(0.82, 1.0, dot(texture(u_src, p).rgb, vec3(0.33)));
    acc += sky * br * w;
    w *= 0.965;
    p += d;
  }
  float fall = 1.0 - smoothstep(0.0, 0.9, length((v_uv - u_sun) * vec2(1.6, 1.0)));
  o = vec4(vec3(acc / 40.0 * u_strength * fall), 1.0);
}`;
  const COMP_FS = `#version 300 es
precision highp float;
uniform sampler2D u_scene;
uniform sampler2D u_bloom;
uniform sampler2D u_rays;
uniform vec3 u_rayCol;
uniform float u_time;
uniform float u_underwater;
uniform float u_bloomAmt;
uniform float u_exposure;
in vec2 v_uv;
out vec4 o;
void main(){
  vec2 uv = v_uv;
  if (u_underwater > 0.5) {
    uv += vec2(sin(uv.y * 24.0 + u_time * 2.0), cos(uv.x * 20.0 + u_time * 1.7)) * 0.0025;
  }
  vec3 c = texture(u_scene, uv).rgb;
  c += texture(u_bloom, uv).rgb * u_bloomAmt;
  c += texture(u_rays, uv).rgb * u_rayCol;
  // compressione morbida delle luci alte (i colori sotto 0.8 restano invariati)
  vec3 hi = max(c - 0.8, 0.0);
  c = min(c, 0.8) + (1.0 - exp(-hi * 4.0)) * 0.2;
  c = pow(max(c, 0.0), vec3(1.07)) * u_exposure;
  float g = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(vec3(g), c, 1.14);
  if (u_underwater > 0.5) c = mix(c, c * vec3(0.55, 0.8, 1.05), 0.5);
  vec2 q = v_uv - 0.5;
  c *= 1.0 - dot(q, q) * 0.55;
  o = vec4(c, 1.0);
}`;
  const COPY_FS = `#version 300 es
precision highp float;
uniform sampler2D u_src;
in vec2 v_uv;
out vec4 o;
void main(){ o = texture(u_src, v_uv); }`;

  const SKY_VS = `#version 300 es
layout(location=0) in vec2 a_p;
out vec2 v_ndc;
void main(){ v_ndc = a_p; gl_Position = vec4(a_p, 0.9999, 1.0); }`;

  const SKY_FS = `#version 300 es
precision highp float;
uniform mat4 u_inv;
uniform vec3 u_sun;
uniform vec3 u_zenith;
uniform vec3 u_horizon;
uniform vec3 u_sunset;
uniform float u_sunsetAmt;
uniform float u_night;
uniform float u_starRot;
uniform float u_underwater;
uniform vec3 u_fogCol;
in vec2 v_ndc;
out vec4 o;
float h13(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.yzx + 33.33); return fract((p.x + p.y) * p.z); }
void main(){
  vec4 pp = u_inv * vec4(v_ndc, 1.0, 1.0);
  vec3 d = normalize(pp.xyz / pp.w);
  float h = d.y;
  vec3 col = mix(u_horizon, u_zenith, pow(clamp(h, 0.0, 1.0), 0.55));
  if (h < 0.0) col = u_horizon;
  float sd = max(dot(d, u_sun), 0.0);
  col += u_sunset * u_sunsetAmt * pow(sd, 5.0) * (1.0 - clamp(abs(h) * 1.6, 0.0, 1.0));
  // sole quadrato
  vec3 right = vec3(0.0, 0.0, 1.0);
  vec3 up = normalize(cross(right, u_sun));
  float ds = dot(d, u_sun);
  if (ds > 0.0) {
    vec2 q = vec2(dot(d, right), dot(d, up)) / ds;
    float m = max(abs(q.x), abs(q.y));
    col += vec3(1.0, 0.85, 0.55) * exp(-m * 9.0) * 0.35 * (1.0 - u_night * 0.9);
    if (m < 0.075) col = mix(col, vec3(1.0, 0.98, 0.82) * 1.3, 1.0 - u_night * 0.5);
  }
  // luna
  vec3 moon = -u_sun;
  float dm = dot(d, moon);
  if (dm > 0.0) {
    vec2 q = vec2(dot(d, right), dot(d, -up)) / dm;
    float m = max(abs(q.x), abs(q.y));
    if (m < 0.055) {
      vec2 g = floor((q + 0.055) / 0.11 * 8.0);
      float cr = h13(vec3(g, 3.0));
      vec3 mc = vec3(0.86, 0.88, 0.95) * (cr > 0.8 ? 0.72 : 1.0);
      col = mix(col, mc, 0.2 + 0.75 * u_night);
    } else {
      col += vec3(0.25, 0.3, 0.45) * exp(-m * 12.0) * 0.25 * u_night;
    }
  }
  // stelle
  if (u_night > 0.01 && h > -0.1) {
    float c = cos(u_starRot), s = sin(u_starRot);
    vec3 sd2 = vec3(c * d.x - s * d.y, s * d.x + c * d.y, d.z);
    vec3 cell = floor(sd2 * 220.0);
    float r = h13(cell);
    if (r > 0.9965) {
      vec3 fp = fract(sd2 * 220.0) - 0.5;
      float st = smoothstep(0.35, 0.0, length(fp)) * (r - 0.9965) / 0.0035;
      col += vec3(st) * u_night * clamp(h * 4.0 + 0.4, 0.0, 1.0);
    }
  }
  if (u_underwater > 0.5) col = u_fogCol;
  o = vec4(col, 1.0);
}`;

  const ENT_VS = `#version 300 es
precision highp float;
layout(location=0) in vec3 a_pos;
layout(location=1) in vec3 a_uvl;
layout(location=2) in vec4 a_col;
uniform mat4 u_vp;
out vec3 v_uvl;
out vec4 v_col;
out float v_dist;
void main(){
  gl_Position = u_vp * vec4(a_pos, 1.0);
  v_uvl = a_uvl;
  v_col = a_col;
  v_dist = length(a_pos);
}`;
  const ENT_FS = `#version 300 es
precision highp float;
precision highp sampler2DArray;
uniform sampler2DArray u_tex;
uniform vec3 u_fogCol;
uniform vec2 u_fog;
uniform int u_useTex;
in vec3 v_uvl;
in vec4 v_col;
in float v_dist;
out vec4 o;
void main(){
  vec4 t = u_useTex == 1 ? texture(u_tex, v_uvl) : vec4(1.0);
  if (t.a < 0.1) discard;
  vec4 c = t * v_col;
  float fog = smoothstep(u_fog.x, u_fog.y, v_dist);
  c.rgb = mix(c.rgb, u_fogCol, fog);
  o = c;
}`;

  const CLOUD_VS = `#version 300 es
precision highp float;
layout(location=0) in vec3 a_pos;
layout(location=1) in float a_shade;
uniform mat4 u_vp;
uniform vec3 u_off;
out float v_shade;
out float v_dist;
void main(){
  vec3 p = a_pos + u_off;
  gl_Position = u_vp * vec4(p, 1.0);
  v_shade = a_shade;
  v_dist = length(p.xz);
}`;
  const CLOUD_FS = `#version 300 es
precision highp float;
uniform vec3 u_col;
uniform vec3 u_fogCol;
uniform float u_range;
in float v_shade;
in float v_dist;
out vec4 o;
void main(){
  vec3 c = u_col * v_shade;
  float fog = smoothstep(u_range * 0.45, u_range, v_dist);
  o = vec4(mix(c, u_fogCol, fog), 0.82 * (1.0 - fog));
}`;

  const LINE_VS = `#version 300 es
layout(location=0) in vec3 a_pos;
uniform mat4 u_vp;
void main(){ gl_Position = u_vp * vec4(a_pos, 1.0); }`;
  const LINE_FS = `#version 300 es
precision mediump float;
uniform vec4 u_col;
out vec4 o;
void main(){ o = u_col; }`;

  function compile(gl, vs, fs) {
    const mk = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('Shader: ' + gl.getShaderInfoLog(s));
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, mk(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('Link: ' + gl.getProgramInfoLog(p));
    const u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(p, i);
      u[info.name] = gl.getUniformLocation(p, info.name);
    }
    return { p, u };
  }

  // ---------------- Batch per entità ----------------
  const EF = 10; // float per vertice
  class Batch {
    constructor(gl, maxQuads, idx) {
      this.gl = gl;
      this.max = maxQuads;
      this.data = new Float32Array(maxQuads * 4 * EF);
      this.n = 0;
      this.vao = gl.createVertexArray();
      this.buf = gl.createBuffer();
      gl.bindVertexArray(this.vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
      gl.bufferData(gl.ARRAY_BUFFER, this.data.byteLength, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, EF * 4, 0);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, EF * 4, 12);
      gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, EF * 4, 24);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idx);
      gl.bindVertexArray(null);
    }
    vert(x, y, z, u, v, l, r, g, b, a) {
      const d = this.data, o = this.n * EF;
      d[o] = x; d[o + 1] = y; d[o + 2] = z; d[o + 3] = u; d[o + 4] = v; d[o + 5] = l;
      d[o + 6] = r; d[o + 7] = g; d[o + 8] = b; d[o + 9] = a;
      this.n++;
    }
    full() { return this.n + 4 > this.max * 4; }
    // quad con 4 angoli p (array di 12) e uv
    quad(p, u0, v0, u1, v1, layer, r, g, b, a) {
      if (this.full()) return;
      this.vert(p[0], p[1], p[2], u0, v1, layer, r, g, b, a);
      this.vert(p[3], p[4], p[5], u1, v1, layer, r, g, b, a);
      this.vert(p[6], p[7], p[8], u1, v0, layer, r, g, b, a);
      this.vert(p[9], p[10], p[11], u0, v0, layer, r, g, b, a);
    }
    // box trasformato: m = matrice locale->relativa camera; dimensioni in [x0..x1]
    box(m, x0, y0, z0, x1, y1, z1, layers, light, col, uvs) {
      const FCs = BOX_FACES;
      for (let f = 0; f < 6; f++) {
        const L = Array.isArray(layers) ? layers[f] : layers;
        if (L < 0) continue;
        const sh = BOX_SHADE[f] * light;
        const pts = [];
        for (let k = 0; k < 4; k++) {
          const c = FCs[f][k];
          const q = mat4.transformPoint(m, c[0] ? x1 : x0, c[1] ? y1 : y0, c[2] ? z1 : z0);
          pts.push(q[0], q[1], q[2]);
        }
        const uv = uvs ? uvs[f] : [0, 0, 1, 1];
        const cr = col ? col[0] : 1, cg = col ? col[1] : 1, cb = col ? col[2] : 1, ca = col ? col[3] : 1;
        this.quad(pts, uv[0], uv[1], uv[2], uv[3], L, sh * cr, sh * cg, sh * cb, ca);
      }
    }
    flush(vp) {
      if (!this.n) return;
      const gl = this.gl;
      gl.bindVertexArray(this.vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.data.subarray(0, this.n * EF));
      gl.drawElements(gl.TRIANGLES, (this.n / 4) * 6, gl.UNSIGNED_INT, 0);
      gl.bindVertexArray(null);
      this.n = 0;
    }
  }
  const BOX_FACES = [
    [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]],
    [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]],
    [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]],
    [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]],
    [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]],
    [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]],
  ];
  const BOX_SHADE = [0.6, 0.6, 1.0, 0.5, 0.8, 0.8];

  class Renderer {
    constructor(canvas) {
      this.canvas = canvas;
      const gl = canvas.getContext('webgl2', { antialias: true, alpha: false, depth: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
      if (!gl) throw new Error('WebGL2 non disponibile');
      this.gl = gl;
      this.renderScale = 1;
      this.fov = 70;
      this.proj = mat4.create();
      this.view = mat4.create();
      this.vp = mat4.create();
      this.tmp = mat4.create();
      this.tmp2 = mat4.create();
      this.planes = new Float32Array(24);
      this.stats = { sections: 0, drawn: 0, tris: 0 };

      this.chunkProg = compile(gl, CHUNK_VS, CHUNK_FS);
      this.skyProg = compile(gl, SKY_VS, SKY_FS);
      this.entProg = compile(gl, ENT_VS, ENT_FS);
      this.cloudProg = compile(gl, CLOUD_VS, CLOUD_FS);
      this.lineProg = compile(gl, LINE_VS, LINE_FS);
      this.shadowProg = compile(gl, SHADOW_VS, SHADOW_FS);
      this.brightProg = compile(gl, FS_VS, BRIGHT_FS);
      this.blurProg = compile(gl, FS_VS, BLUR_FS);
      this.raysProg = compile(gl, FS_VS, RAYS_FS);
      this.compProg = compile(gl, FS_VS, COMP_FS);
      this.copyProg = compile(gl, FS_VS, COPY_FS);
      this.shadowSize = 0;
      this.shadowMat = mat4.create();
      this.shadowOn = false;
      this.post = null;
      this.fx = { shaders: false, shadows: false };
      this._initShadow(1);

      // indici condivisi per quad
      const MAXQ = 1 << 17;
      const idx = new Uint32Array(MAXQ * 6);
      for (let i = 0, v = 0; i < idx.length; i += 6, v += 4) {
        idx[i] = v; idx[i + 1] = v + 1; idx[i + 2] = v + 2; idx[i + 3] = v; idx[i + 4] = v + 2; idx[i + 5] = v + 3;
      }
      this.maxQuads = MAXQ;
      this.idx = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.idx);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);

      // triangolo a schermo intero
      this.skyVao = gl.createVertexArray();
      gl.bindVertexArray(this.skyVao);
      const sb = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, sb);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.bindVertexArray(null);

      this.batch = new Batch(gl, 20000, this.idx);
      this.batchT = new Batch(gl, 4000, this.idx);

      // linee di selezione
      this.lineVao = gl.createVertexArray();
      this.lineBuf = gl.createBuffer();
      gl.bindVertexArray(this.lineVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.lineBuf);
      gl.bufferData(gl.ARRAY_BUFFER, 24 * 3 * 4, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
      gl.bindVertexArray(null);

      this.cloud = { vao: null, buf: null, count: 0, ox: 1e9, oz: 1e9 };
      this.buildCloudMap();
      this.initTextures();
      this.meshCount = 0;
    }

    initTextures() {
      const gl = this.gl;
      MC.textures.build();
      const layers = MC.textures.layers;
      const S = MC.textures.size;
      this.tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.tex);
      const levels = 5;
      gl.texStorage3D(gl.TEXTURE_2D_ARRAY, levels, gl.RGBA8, S, S, layers.length);
      for (let i = 0; i < layers.length; i++) {
        const d = new Uint8Array(layers[i]);
        // colore medio nei pixel trasparenti per mipmap pulite
        let r = 0, g = 0, b = 0, n = 0;
        for (let k = 0; k < d.length; k += 4) if (d[k + 3] > 0) { r += d[k]; g += d[k + 1]; b += d[k + 2]; n++; }
        if (n) { r /= n; g /= n; b /= n; }
        for (let k = 0; k < d.length; k += 4) if (d[k + 3] === 0) { d[k] = r; d[k + 1] = g; d[k + 2] = b; }
        gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, i, S, S, 1, gl.RGBA, gl.UNSIGNED_BYTE, d);
      }
      gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.NEAREST_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAX_LEVEL, levels - 1);
      // niente filtro anisotropico: forzerebbe il filtraggio lineare e sfocerebbe la pixel-art
    }

    buildCloudMap() {
      const N = 128;
      const s = new MC.Simplex(4242);
      this.cloudMap = new Uint8Array(N * N);
      for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
        // rumore periodico su toro
        const a = (x / N) * Math.PI * 2, b = (z / N) * Math.PI * 2;
        const v = s.noise3D(Math.cos(a) * 3, Math.sin(a) * 3 + Math.cos(b) * 3, Math.sin(b) * 3) * 0.7 +
          s.noise3D(Math.cos(a) * 8 + 10, Math.sin(a) * 8 + Math.cos(b) * 8, Math.sin(b) * 8) * 0.3;
        this.cloudMap[z * N + x] = v > 0.18 ? 1 : 0;
      }
      this.cloudN = N;
    }

    resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2) * this.renderScale;
      const w = Math.max(1, Math.floor(this.canvas.clientWidth * dpr));
      const h = Math.max(1, Math.floor(this.canvas.clientHeight * dpr));
      if (this.canvas.width !== w || this.canvas.height !== h) {
        this.canvas.width = w; this.canvas.height = h;
      }
    }

    // ---------------- Mesh ----------------
    _uploadPart(part, data, verts) {
      const gl = this.gl;
      if (!data) {
        if (part) { gl.deleteBuffer(part.buf); gl.deleteVertexArray(part.vao); }
        return null;
      }
      if (verts / 4 > this.maxQuads) verts = this.maxQuads * 4;
      if (!part) {
        part = { vao: gl.createVertexArray(), buf: gl.createBuffer(), count: 0 };
        gl.bindVertexArray(part.vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, part.buf);
        const S = MC.mesher.STRIDE;
        gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 4, gl.SHORT, false, S, 0);
        gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.UNSIGNED_BYTE, false, S, 8);
        gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.UNSIGNED_BYTE, false, S, 12);
        gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 4, gl.UNSIGNED_BYTE, false, S, 16);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.idx);
        gl.bindVertexArray(null);
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, part.buf);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      part.count = (verts / 4) * 6;
      return part;
    }

    uploadSection(chunk, s, res) {
      let m = chunk.meshes[s];
      if (!m) m = chunk.meshes[s] = { solid: null, trans: null };
      m.solid = this._uploadPart(m.solid, res.solid, res.solidVerts);
      m.trans = this._uploadPart(m.trans, res.trans, res.transVerts);
    }

    freeChunk(chunk) {
      const gl = this.gl;
      for (let s = 0; s < chunk.meshes.length; s++) {
        const m = chunk.meshes[s];
        if (!m) continue;
        for (const part of [m.solid, m.trans]) if (part) { gl.deleteBuffer(part.buf); gl.deleteVertexArray(part.vao); }
        chunk.meshes[s] = null;
      }
    }

    // Aggiorna le sezioni sporche entro il budget
    updateMeshes(world, cam, budgetMs, opts) {
      const t0 = performance.now();
      const pcx = Math.floor(cam.x) >> 4, pcz = Math.floor(cam.z) >> 4;
      const R = world.renderDist;
      const NS = WH / 16;
      let done = 0;
      // prima gli urgenti
      for (let pass = 0; pass < 2; pass++) {
        for (const o of world.offsets) {
          if (o[2] > R + 1) break;
          const c = world.getChunk(pcx + o[0], pcz + o[1]);
          if (!c || c.state !== MC.ST.READY) continue;
          for (let s = 0; s < NS; s++) {
            const dv = c.dirty[s];
            if (!dv || (pass === 0 && dv !== 2)) continue;
            c.dirty[s] = 0;
            const res = MC.mesher.meshSection(world, c, s, opts);
            this.uploadSection(c, s, res);
            done++;
            if (pass === 1 && performance.now() - t0 > budgetMs) return done;
          }
        }
      }
      return done;
    }

    // ---------------- Ombre ----------------
    _initShadow(size) {
      const gl = this.gl;
      if (this.shadowTex) gl.deleteTexture(this.shadowTex);
      if (!this.shadowFbo) this.shadowFbo = gl.createFramebuffer();
      this.shadowTex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.shadowTex);
      gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, size, size);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.shadowTex, 0);
      gl.drawBuffers([gl.NONE]);
      gl.readBuffer(gl.NONE);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      this.shadowSize = size;
    }

    _buildShadowMatrix(cam, L) {
      const E = 72, D = 170;
      const fl = [-L[0], -L[1], -L[2]];
      const up = [0, 0, 1];
      let r = [fl[1] * up[2] - fl[2] * up[1], fl[2] * up[0] - fl[0] * up[2], fl[0] * up[1] - fl[1] * up[0]];
      const rl = Math.hypot(r[0], r[1], r[2]) || 1;
      r = [r[0] / rl, r[1] / rl, r[2] / rl];
      const u = [r[1] * fl[2] - r[2] * fl[1], r[2] * fl[0] - r[0] * fl[2], r[0] * fl[1] - r[1] * fl[0]];
      const m = this.shadowMat;
      const px = r[0] * cam.x + r[1] * cam.y + r[2] * cam.z;
      const py = u[0] * cam.x + u[1] * cam.y + u[2] * cam.z;
      const st = (2 * E) / this.shadowSize;
      const fx = px - Math.floor(px / st) * st, fy = py - Math.floor(py / st) * st;
      // O * T * R
      m.fill(0);
      m[0] = r[0] / E; m[4] = r[1] / E; m[8] = r[2] / E; m[12] = fx / E;
      m[1] = u[0] / E; m[5] = u[1] / E; m[9] = u[2] / E; m[13] = fy / E;
      m[2] = -L[0] / D; m[6] = -L[1] / D; m[10] = -L[2] / D; m[14] = 0;
      m[15] = 1;
      this.shadowExtent = E;
    }

    renderShadows(world, cam, env, time) {
      const gl = this.gl;
      this.shadowOn = !!(this.fx.shaders && this.fx.shadows && env.direct > 0.001);
      if (!this.shadowOn) return;
      const want = this.fx.shadowSize || 2048;
      if (this.shadowSize !== want) this._initShadow(want);
      this._buildShadowMatrix(cam, env.lightDir);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFbo);
      gl.viewport(0, 0, this.shadowSize, this.shadowSize);
      gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      gl.disable(gl.CULL_FACE);
      gl.enable(gl.POLYGON_OFFSET_FILL);
      gl.polygonOffset(1.6, 3.0);
      const pr = this.shadowProg;
      gl.useProgram(pr.p);
      gl.uniformMatrix4fv(pr.u.u_shadowMat, false, this.shadowMat);
      gl.uniform3f(pr.u.u_cam, cam.x, cam.y, cam.z);
      gl.uniform1f(pr.u.u_time, time);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.tex);
      gl.uniform1i(pr.u.u_tex, 0);
      const pcx = Math.floor(cam.x) >> 4, pcz = Math.floor(cam.z) >> 4;
      const RC = Math.ceil(this.shadowExtent / 16) + 1;
      const NS = WH / 16;
      for (const o of world.offsets) {
        if (o[2] > RC) break;
        const c = world.getChunk(pcx + o[0], pcz + o[1]);
        if (!c || c.state !== MC.ST.READY) continue;
        const ox = c.cx * 16 - cam.x, oz = c.cz * 16 - cam.z;
        for (let s = 0; s < NS; s++) {
          const m = c.meshes[s];
          if (!m || !m.solid) continue;
          gl.uniform3f(pr.u.u_off, ox, s * 16 - cam.y, oz);
          gl.bindVertexArray(m.solid.vao);
          gl.drawElements(gl.TRIANGLES, m.solid.count, gl.UNSIGNED_INT, 0);
        }
      }
      gl.bindVertexArray(null);
      gl.disable(gl.POLYGON_OFFSET_FILL);
      gl.enable(gl.CULL_FACE);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.post && this.fx.shaders ? this.post.sceneTarget : null);
    }

    // ---------------- Post-processing ----------------
    _tex(w, h, internal, fmt, type, filter) {
      const gl = this.gl;
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texStorage2D(gl.TEXTURE_2D, 1, internal, w, h);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    }
    _fbo(color, depth) {
      const gl = this.gl;
      const f = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, f);
      if (color) gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, color, 0);
      if (depth) gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depth, 0);
      return f;
    }
    _freePost() {
      const gl = this.gl, P = this.post;
      if (!P) return;
      for (const t of [P.sceneTex, P.depthTex, P.a, P.b, P.r]) gl.deleteTexture(t);
      for (const f of [P.sceneFbo, P.aF, P.bF, P.rF, P.msFbo]) if (f) gl.deleteFramebuffer(f);
      for (const r of [P.msColor, P.msDepth]) if (r) gl.deleteRenderbuffer(r);
      this.post = null;
    }
    _ensurePost() {
      const gl = this.gl;
      const w = this.canvas.width, h = this.canvas.height;
      if (this.post && this.post.w === w && this.post.h === h) return this.post;
      this._freePost();
      const P = { w, h };
      P.sceneTex = this._tex(w, h, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.LINEAR);
      P.depthTex = this._tex(w, h, gl.DEPTH_COMPONENT24, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, gl.NEAREST);
      P.sceneFbo = this._fbo(P.sceneTex, P.depthTex);
      const samples = Math.min(4, gl.getParameter(gl.MAX_SAMPLES) || 0);
      if (samples > 1) {
        P.msFbo = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, P.msFbo);
        P.msColor = gl.createRenderbuffer();
        gl.bindRenderbuffer(gl.RENDERBUFFER, P.msColor);
        gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.RGBA8, w, h);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, P.msColor);
        P.msDepth = gl.createRenderbuffer();
        gl.bindRenderbuffer(gl.RENDERBUFFER, P.msDepth);
        gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.DEPTH_COMPONENT24, w, h);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, P.msDepth);
        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
          gl.deleteFramebuffer(P.msFbo); P.msFbo = null;
        }
      }
      const qw = Math.max(1, w >> 2), qh = Math.max(1, h >> 2);
      P.qw = qw; P.qh = qh;
      P.a = this._tex(qw, qh, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.LINEAR); P.aF = this._fbo(P.a);
      P.b = this._tex(qw, qh, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.LINEAR); P.bF = this._fbo(P.b);
      P.r = this._tex(qw, qh, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.LINEAR); P.rF = this._fbo(P.r);
      P.sceneTarget = P.msFbo || P.sceneFbo;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      this.post = P;
      return P;
    }

    beginScene() {
      const gl = this.gl;
      if (!this.fx.shaders) { gl.bindFramebuffer(gl.FRAMEBUFFER, null); return; }
      const P = this._ensurePost();
      gl.bindFramebuffer(gl.FRAMEBUFFER, P.sceneTarget);
      gl.viewport(0, 0, P.w, P.h);
    }

    _pass(prog, fbo, w, h, setup) {
      const gl = this.gl;
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.viewport(0, 0, w, h);
      gl.useProgram(prog.p);
      setup(prog.u);
      gl.bindVertexArray(this.skyVao);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    _bindTex(unit, tex) { const gl = this.gl; gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex); }

    endScene(env, time) {
      const gl = this.gl;
      if (!this.fx.shaders || !this.post) return;
      const P = this.post;
      if (P.msFbo) {
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, P.msFbo);
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, P.sceneFbo);
        gl.blitFramebuffer(0, 0, P.w, P.h, 0, 0, P.w, P.h, gl.COLOR_BUFFER_BIT, gl.NEAREST);
        gl.blitFramebuffer(0, 0, P.w, P.h, 0, 0, P.w, P.h, gl.DEPTH_BUFFER_BIT, gl.NEAREST);
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
      }
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.BLEND);
      gl.disable(gl.CULL_FACE);
      gl.depthMask(false);
      // bloom
      this._bindTex(0, P.sceneTex);
      this._pass(this.brightProg, P.aF, P.qw, P.qh, (u) => { gl.uniform1i(u.u_src, 0); gl.uniform2f(u.u_texel, 1 / P.w, 1 / P.h); });
      for (let i = 0; i < 2; i++) {
        const k = i + 1;
        this._bindTex(0, P.a);
        this._pass(this.blurProg, P.bF, P.qw, P.qh, (u) => { gl.uniform1i(u.u_src, 0); gl.uniform2f(u.u_dir, k / P.qw, 0); });
        this._bindTex(0, P.b);
        this._pass(this.blurProg, P.aF, P.qw, P.qh, (u) => { gl.uniform1i(u.u_src, 0); gl.uniform2f(u.u_dir, 0, k / P.qh); });
      }
      // raggi di luce
      let rays = 0;
      const L = env.lightDir;
      const cp = [this.vp[0] * L[0] + this.vp[4] * L[1] + this.vp[8] * L[2], this.vp[1] * L[0] + this.vp[5] * L[1] + this.vp[9] * L[2], 0, this.vp[3] * L[0] + this.vp[7] * L[1] + this.vp[11] * L[2]];
      if (cp[3] > 0 && env.direct > 0.01 && !env.underwater) {
        const sx = (cp[0] / cp[3]) * 0.5 + 0.5, sy = (cp[1] / cp[3]) * 0.5 + 0.5;
        const off = Math.max(0, Math.max(Math.abs(sx - 0.5), Math.abs(sy - 0.5)) - 0.5);
        rays = env.direct * Math.max(0, 1 - off * 4) * (env.isMoon ? 0.35 : 1) * (1 - env.rain);
        if (rays > 0.01) {
          this._bindTex(0, P.sceneTex); this._bindTex(1, P.depthTex);
          this._pass(this.raysProg, P.rF, P.qw, P.qh, (u) => { gl.uniform1i(u.u_src, 0); gl.uniform1i(u.u_depth, 1); gl.uniform2f(u.u_sun, sx, sy); gl.uniform1f(u.u_strength, rays * 2.2); });
        }
      }
      if (rays <= 0.01) { gl.bindFramebuffer(gl.FRAMEBUFFER, P.rF); gl.viewport(0, 0, P.qw, P.qh); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT); }
      // composizione finale
      this._bindTex(0, P.sceneTex); this._bindTex(1, P.a); this._bindTex(2, P.r);
      this._pass(this.compProg, null, P.w, P.h, (u) => {
        gl.uniform1i(u.u_scene, 0); gl.uniform1i(u.u_bloom, 1); gl.uniform1i(u.u_rays, 2);
        const warm = env.sunsetAmt;
        gl.uniform3f(u.u_rayCol, 1.0, 0.85 - warm * 0.25, 0.6 - warm * 0.3);
        gl.uniform1f(u.u_time, time);
        gl.uniform1f(u.u_underwater, env.underwater ? 1 : 0);
        gl.uniform1f(u.u_bloomAmt, 0.45);
        gl.uniform1f(u.u_exposure, 1.04);
      });
      gl.bindVertexArray(null);
      gl.activeTexture(gl.TEXTURE0);
      gl.depthMask(true);
      gl.enable(gl.DEPTH_TEST);
      gl.enable(gl.CULL_FACE);
    }

    // ---------------- Frustum ----------------
    _extractPlanes(m) {
      const p = this.planes;
      const set = (i, a, b, c, d) => { const l = Math.hypot(a, b, c); p[i] = a / l; p[i + 1] = b / l; p[i + 2] = c / l; p[i + 3] = d / l; };
      set(0, m[3] + m[0], m[7] + m[4], m[11] + m[8], m[15] + m[12]);
      set(4, m[3] - m[0], m[7] - m[4], m[11] - m[8], m[15] - m[12]);
      set(8, m[3] + m[1], m[7] + m[5], m[11] + m[9], m[15] + m[13]);
      set(12, m[3] - m[1], m[7] - m[5], m[11] - m[9], m[15] - m[13]);
      set(16, m[3] + m[2], m[7] + m[6], m[11] + m[10], m[15] + m[14]);
      set(20, m[3] - m[2], m[7] - m[6], m[11] - m[10], m[15] - m[14]);
    }
    _boxVisible(x0, y0, z0, x1, y1, z1) {
      const p = this.planes;
      for (let i = 0; i < 24; i += 4) {
        const a = p[i], b = p[i + 1], c = p[i + 2], d = p[i + 3];
        if (a * (a > 0 ? x1 : x0) + b * (b > 0 ? y1 : y0) + c * (c > 0 ? z1 : z0) + d < 0) return false;
      }
      return true;
    }

    // ---------------- Ambiente ----------------
    computeEnv(timeTicks, underwater, inLava, renderDist, weather) {
      const t = (timeTicks % 24000) / 24000;
      const a = t * Math.PI * 2;
      const sunY = Math.sin(a);
      const sun = [Math.cos(a), sunY, 0];
      const dayF = MC.util.smoothstep(-0.18, 0.28, sunY);
      const lerp3 = (x, y, k) => [x[0] + (y[0] - x[0]) * k, x[1] + (y[1] - x[1]) * k, x[2] + (y[2] - x[2]) * k];
      let zenith = lerp3([0.012, 0.018, 0.05], [0.42, 0.62, 1.0], dayF);
      let horizon = lerp3([0.04, 0.05, 0.1], [0.72, 0.84, 1.0], dayF);
      const sunsetAmt = Math.pow(1 - Math.min(1, Math.abs(sunY) * 2.2), 2) * (sunY > -0.35 ? 1 : 0);
      const sunsetCol = [1.0, 0.45, 0.15];
      const rain = weather || 0;
      if (rain > 0) {
        const g = (c) => { const m = (c[0] + c[1] + c[2]) / 3; return [m * 0.6, m * 0.62, m * 0.68]; };
        zenith = lerp3(zenith, g(zenith), rain);
        horizon = lerp3(horizon, g(horizon), rain);
      }
      let fogCol = lerp3(horizon, sunsetCol, sunsetAmt * 0.25 * (1 - rain));
      const far = renderDist * 16 - 10;
      let fog = [far * 0.5, far];
      if (rain > 0) fog = [far * (0.5 - 0.3 * rain), far * (1 - 0.3 * rain)];
      if (underwater) { fogCol = [0.05 * (0.3 + dayF), 0.14 * (0.3 + dayF), 0.35 * (0.3 + dayF)]; fog = [0, 28]; }
      if (inLava) { fogCol = [0.8, 0.25, 0.02]; fog = [0, 3]; }
      const day = (0.32 + 0.68 * dayF) * (1 - rain * 0.3);
      const skyCol = lerp3([0.55, 0.65, 1.0], [1.0, 1.0, 1.0], dayF);
      if (sunsetAmt > 0) { skyCol[0] = Math.min(1, skyCol[0] + sunsetAmt * 0.12); skyCol[2] -= sunsetAmt * 0.1; }
      const isMoon = sunY < 0;
      const lightDir = isMoon ? [-sun[0], -sun[1], -sun[2]] : sun;
      const direct = (isMoon ? MC.util.smoothstep(0.03, 0.25, -sunY) * 0.4 : MC.util.smoothstep(0.02, 0.22, sunY)) * (1 - rain * 0.85);
      return { sun, dayF, zenith, horizon, sunsetAmt, sunsetCol, fogCol, fog, day, skyCol, night: 1 - dayF, starRot: a, underwater, rain, lightDir, direct, isMoon };
    }

    // ---------------- Disegno ----------------
    setupCamera(cam) {
      const gl = this.gl;
      const aspect = this.canvas.width / this.canvas.height;
      mat4.perspective(this.proj, (cam.fov * Math.PI) / 180, aspect, 0.05, 1200);
      mat4.rotX(this.tmp, -cam.pitch);
      mat4.rotY(this.tmp2, -cam.yaw);
      mat4.mul(this.view, this.tmp, this.tmp2);
      if (cam.roll) { mat4.rotZ(this.tmp, cam.roll); mat4.mul(this.view, this.tmp, this.view); }
      mat4.mul(this.vp, this.proj, this.view);
      this._extractPlanes(this.vp);
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }

    drawSky(env) {
      const gl = this.gl;
      const pr = this.skyProg;
      gl.useProgram(pr.p);
      const inv = mat4.invert(this.tmp, this.vp);
      gl.uniformMatrix4fv(pr.u.u_inv, false, inv);
      gl.uniform3fv(pr.u.u_sun, env.sun);
      gl.uniform3fv(pr.u.u_zenith, env.zenith);
      gl.uniform3fv(pr.u.u_horizon, env.fogCol);
      gl.uniform3fv(pr.u.u_sunset, env.sunsetCol);
      gl.uniform1f(pr.u.u_sunsetAmt, env.sunsetAmt * (1 - env.rain));
      gl.uniform1f(pr.u.u_night, env.night * (1 - env.rain));
      gl.uniform1f(pr.u.u_starRot, env.starRot);
      gl.uniform1f(pr.u.u_underwater, env.underwater ? 1 : 0);
      gl.uniform3fv(pr.u.u_fogCol, env.fogCol);
      gl.disable(gl.DEPTH_TEST);
      gl.depthMask(false);
      gl.bindVertexArray(this.skyVao);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindVertexArray(null);
      gl.depthMask(true);
      gl.enable(gl.DEPTH_TEST);
    }

    _chunkUniforms(env, cam, time, pass) {
      const gl = this.gl, pr = this.chunkProg;
      gl.useProgram(pr.p);
      gl.uniformMatrix4fv(pr.u.u_vp, false, this.vp);
      gl.uniform3f(pr.u.u_cam, cam.x, cam.y, cam.z);
      gl.uniform1f(pr.u.u_time, time);
      gl.uniform1i(pr.u.u_pass, pass);
      gl.uniform3fv(pr.u.u_fogCol, env.fogCol);
      gl.uniform2fv(pr.u.u_fog, env.fog);
      gl.uniform1f(pr.u.u_day, env.day);
      gl.uniform3fv(pr.u.u_skyCol, env.skyCol);
      gl.uniform1f(pr.u.u_bright, 0.03 + (cam.brightness || 0) * 0.05);
      gl.uniform1f(pr.u.u_gamma, 0.15 + (cam.brightness || 0) * 0.85);
      gl.uniform1f(pr.u.u_flicker, 0.96 + Math.sin(time * 9.1) * 0.02 + Math.sin(time * 23.7) * 0.02);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.tex);
      gl.uniform1i(pr.u.u_tex, 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.shadowTex);
      gl.uniform1i(pr.u.u_shadowTex, 1);
      gl.activeTexture(gl.TEXTURE0);
      gl.uniform1i(pr.u.u_shadows, this.shadowOn ? 1 : 0);
      gl.uniformMatrix4fv(pr.u.u_shadowMat, false, this.shadowMat);
      gl.uniform1f(pr.u.u_shadowTexel, 1 / Math.max(1, this.shadowSize));
      gl.uniform3fv(pr.u.u_lightDir, env.lightDir);
      gl.uniform1f(pr.u.u_direct, env.direct);
      gl.uniform3fv(pr.u.u_sunDir, env.lightDir);
      gl.uniform3fv(pr.u.u_zenith, env.zenith);
      gl.uniform3fv(pr.u.u_horizon, env.fogCol);
      gl.uniform1i(pr.u.u_fancyWater, this.fx.shaders ? 1 : 0);
    }

    drawWorld(world, env, cam, time) {
      const gl = this.gl;
      const pr = this.chunkProg;
      const R = world.renderDist;
      const pcx = Math.floor(cam.x) >> 4, pcz = Math.floor(cam.z) >> 4;
      const NS = WH / 16;
      const vis = [];
      let sections = 0;
      for (const o of world.offsets) {
        if (o[2] > R + 0.5) break;
        const c = world.getChunk(pcx + o[0], pcz + o[1]);
        if (!c || c.state !== MC.ST.READY) continue;
        const ox = c.cx * 16 - cam.x, oz = c.cz * 16 - cam.z;
        if (!this._boxVisible(ox, -cam.y, oz, ox + 16, WH - cam.y, oz + 16)) continue;
        for (let s = 0; s < NS; s++) {
          const m = c.meshes[s];
          if (!m || (!m.solid && !m.trans)) continue;
          const oy = s * 16 - cam.y;
          if (!this._boxVisible(ox, oy, oz, ox + 16, oy + 16, oz + 16)) continue;
          vis.push(m, ox, oy, oz, o[2]);
          sections++;
        }
      }
      this._chunkUniforms(env, cam, time, 0);
      gl.enable(gl.CULL_FACE);
      gl.disable(gl.BLEND);
      let tris = 0;
      for (let i = 0; i < vis.length; i += 5) {
        const m = vis[i];
        if (!m.solid) continue;
        gl.uniform3f(pr.u.u_off, vis[i + 1], vis[i + 2], vis[i + 3]);
        gl.bindVertexArray(m.solid.vao);
        gl.drawElements(gl.TRIANGLES, m.solid.count, gl.UNSIGNED_INT, 0);
        tris += m.solid.count / 3;
      }
      gl.bindVertexArray(null);
      this.stats.sections = sections;
      this.stats.tris = tris;
      this._visible = vis;
    }

    drawTranslucent(env, cam, time) {
      const gl = this.gl, pr = this.chunkProg;
      const vis = this._visible || [];
      const order = [];
      for (let i = 0; i < vis.length; i += 5) {
        if (!vis[i].trans) continue;
        const cx = vis[i + 1] + 8, cy = vis[i + 2] + 8, cz = vis[i + 3] + 8;
        order.push([i, cx * cx + cy * cy + cz * cz]);
      }
      order.sort((a, b) => b[1] - a[1]);
      this._chunkUniforms(env, cam, time, 1);
      gl.disable(gl.CULL_FACE);
      gl.enable(gl.BLEND);
      gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      for (const [i] of order) {
        const m = vis[i];
        gl.uniform3f(pr.u.u_off, vis[i + 1], vis[i + 2], vis[i + 3]);
        gl.bindVertexArray(m.trans.vao);
        gl.drawElements(gl.TRIANGLES, m.trans.count, gl.UNSIGNED_INT, 0);
      }
      gl.bindVertexArray(null);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
      gl.enable(gl.CULL_FACE);
    }

    _buildClouds(cellX, cellZ) {
      const gl = this.gl;
      const N = this.cloudN, map = this.cloudMap;
      const R = 32, CS = 12, CH = 4;
      const data = [];
      const at = (x, z) => map[(((z % N) + N) % N) * N + (((x % N) + N) % N)];
      const push = (f, x0, y0, z0, x1, y1, z1) => {
        const sh = [0.8, 0.8, 1.0, 0.7, 0.9, 0.9][f];
        const c = BOX_FACES[f];
        const v = (k) => { const q = c[k]; data.push(q[0] ? x1 : x0, q[1] ? y1 : y0, q[2] ? z1 : z0, sh); };
        v(0); v(1); v(2); v(0); v(2); v(3);
      };
      for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
        const gx = cellX + dx, gz = cellZ + dz;
        if (!at(gx, gz)) continue;
        const x0 = dx * CS, z0 = dz * CS, x1 = x0 + CS, z1 = z0 + CS;
        push(2, x0, 0, z0, x1, CH, z1);
        push(3, x0, 0, z0, x1, CH, z1);
        if (!at(gx + 1, gz)) push(0, x0, 0, z0, x1, CH, z1);
        if (!at(gx - 1, gz)) push(1, x0, 0, z0, x1, CH, z1);
        if (!at(gx, gz + 1)) push(4, x0, 0, z0, x1, CH, z1);
        if (!at(gx, gz - 1)) push(5, x0, 0, z0, x1, CH, z1);
      }
      const arr = new Float32Array(data);
      if (!this.cloud.vao) {
        this.cloud.vao = gl.createVertexArray();
        this.cloud.buf = gl.createBuffer();
        gl.bindVertexArray(this.cloud.vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.cloud.buf);
        gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 16, 0);
        gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 16, 12);
        gl.bindVertexArray(null);
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, this.cloud.buf);
      gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW);
      this.cloud.count = arr.length / 4;
      this.cloud.ox = cellX; this.cloud.oz = cellZ;
    }

    drawClouds(env, cam, time) {
      const gl = this.gl;
      const CS = 12, Y = 204;
      const drift = time * 1.2;
      const wx = cam.x + drift, wz = cam.z;
      const cellX = Math.floor(wx / CS), cellZ = Math.floor(wz / CS);
      if (cellX !== this.cloud.ox || cellZ !== this.cloud.oz) this._buildClouds(cellX, cellZ);
      const pr = this.cloudProg;
      gl.useProgram(pr.p);
      gl.uniformMatrix4fv(pr.u.u_vp, false, this.vp);
      gl.uniform3f(pr.u.u_off, cellX * CS - wx, Y - cam.y, cellZ * CS - wz);
      const b = 0.25 + 0.75 * env.dayF;
      const rain = env.rain || 0;
      gl.uniform3f(pr.u.u_col, b * (1 - rain * 0.45) + env.sunsetAmt * 0.1, b * (1 - rain * 0.45), b * (1 - rain * 0.42) - env.sunsetAmt * 0.05);
      gl.uniform3fv(pr.u.u_fogCol, env.fogCol);
      gl.uniform1f(pr.u.u_range, 32 * CS);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.enable(gl.CULL_FACE);
      gl.depthMask(false);
      gl.bindVertexArray(this.cloud.vao);
      gl.drawArrays(gl.TRIANGLES, 0, this.cloud.count);
      gl.bindVertexArray(null);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
    }

    beginEnt(env, vp, useTex) {
      const gl = this.gl, pr = this.entProg;
      gl.useProgram(pr.p);
      gl.uniformMatrix4fv(pr.u.u_vp, false, vp || this.vp);
      gl.uniform3fv(pr.u.u_fogCol, env.fogCol);
      gl.uniform2fv(pr.u.u_fog, env.fog);
      gl.uniform1i(pr.u.u_useTex, useTex === false ? 0 : 1);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.tex);
      gl.uniform1i(pr.u.u_tex, 0);
    }

    drawSelection(box, cam) {
      const gl = this.gl;
      const e = 0.003;
      const x0 = box[0] - e - cam.x, y0 = box[1] - e - cam.y, z0 = box[2] - e - cam.z;
      const x1 = box[3] + e - cam.x, y1 = box[4] + e - cam.y, z1 = box[5] + e - cam.z;
      const v = [
        x0, y0, z0, x1, y0, z0, x1, y0, z0, x1, y0, z1, x1, y0, z1, x0, y0, z1, x0, y0, z1, x0, y0, z0,
        x0, y1, z0, x1, y1, z0, x1, y1, z0, x1, y1, z1, x1, y1, z1, x0, y1, z1, x0, y1, z1, x0, y1, z0,
        x0, y0, z0, x0, y1, z0, x1, y0, z0, x1, y1, z0, x1, y0, z1, x1, y1, z1, x0, y0, z1, x0, y1, z1,
      ];
      const pr = this.lineProg;
      gl.useProgram(pr.p);
      gl.uniformMatrix4fv(pr.u.u_vp, false, this.vp);
      gl.uniform4f(pr.u.u_col, 0, 0, 0, 0.55);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.bindVertexArray(this.lineVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.lineBuf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, new Float32Array(v));
      gl.drawArrays(gl.LINES, 0, 24);
      gl.bindVertexArray(null);
      gl.disable(gl.BLEND);
    }
  }

  MC.Renderer = Renderer;
  MC.BOX_FACES = BOX_FACES;
})();
